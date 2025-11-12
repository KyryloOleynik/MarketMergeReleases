import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { app } from 'electron';
import { initMergerForQuery } from '../merger/merger.js';  
import { addLikedProduct, clearAllLiked, clearLiked, readLikedFile } from '../core/cache/likedCache.js';
import pkg from "electron-updater";
const { autoUpdater } = pkg;
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizePrice } from '../merger/sorter.js';

const serverApp = express();
serverApp.use(cors());
serverApp.use(express.json());
serverApp.use(express.urlencoded({ extended: true }));

let session = null;

const createSessionId = () => crypto.randomBytes(6).toString('hex');

serverApp.get('/get-items/', async (req, res) => {
  const location = req.query.location || '';
  const condition = req.query.condition || '';
  const search = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim() || '';
  const order = req.query.order || 'l_h';
  const priceFrom = Number(req.query.priceFrom || 1);
  const priceTo = Number(req.query.priceTo || 9999999);
  const limit = Math.min(200, Number(req.query.limit || 50));
  const markets = req.query.markets ? (Array.isArray(req.query.markets) ? req.query.markets : req.query.markets.split(',').map(s => s.trim())) : ['OLX', 'Shafa'];
  const sizesShoes = normalizeToArray(req.query, 'sizesShoes');
  const sizesClothes = normalizeToArray(req.query, 'sizesClothes');
  const category = (req.query.category || req.query['category[]'] || '').toLowerCase();
  const aiFeatures = String(req.query.aiFeatures ?? "").trim().toLowerCase() === "true" || false;

  if (req.query.reset === '1' || req.query.reset === 'true' || req.query.reset === 'yes') {
    if (session) {
      console.log('[Server] reset requested, closing previous session');
      try {
        await session.merger.close();
      } catch (e) {
        console.warn('[Server] error closing merger on reset', e && e.message);
      }
      session = null;
    }
  }

  if (!session) {
    console.log('[Server] creating new session');
    try {
      const merger = await initMergerForQuery({ search, priceFrom, priceTo, markets, order, sizesShoes, sizesClothes, category, location, condition });
      session = { id: createSessionId(), merger: merger };
    } catch (err) {
      console.error('[Server] init merger failed', err && err.message);
      return res.status(500).json({ error: 'failed to initialize merger' });
    }
  }

  try {
    let message = {}
    const result = await session.merger.nextBatch(limit);
    if (aiFeatures){
      try {
        result.items = await predictBatch(result.items);
        result.items = await Promise.all((result.items || []).map(async (item) => ({
          ...(item || {}),
          recommendedPrice: await normalizePrice(item.recommendedPrice),
        })))
      } catch (error) {
        console.error(error)
        message = {
          text: 'Виникла помилка при використанні AI алгоритму',
          type: 'error'
        }
      }
    }
    return res.json({ items: result.items, hasMore: result.hasMore, total: result.items.length, sessionId: session.id, message: message });
  } catch (err) {
    console.error('[Server] nextBatch error', err && err.message);
    return res.status(500).json({ error: 'failed to fetch items' });
  }
});

serverApp.post('/add-liked/', async (req, res) => {
  try {
    await addLikedProduct(req.body);
    return res.json({ success: true });
  } catch (e) {
    console.error('[Liked] adding error', e?.message);
    return res.status(500).json({ error: 'failed to add liked', success: false });
  }
});

serverApp.post('/clear-all-liked/', async (req, res) => {
  try {
    await clearAllLiked();
    return res.json({ success: true });
  } catch (e) {
    console.error('[Liked] clearing all error', e?.message);
    return res.status(500).json({ error: 'failed to clear all liked', success: false });
  }
});

serverApp.post('/clear-liked/', async (req, res) => {
  try {
    await clearLiked(req.body.href);
    return res.json({ success: true });
  } catch (e) {
    console.error('[Liked] clearing error', e?.message);
    return res.status(500).json({ error: 'failed to clear liked', success: false });
  }
});

serverApp.get('/get-liked/', async (req, res) => {
  try {
    const liked = await readLikedFile();
    return res.json(liked);
  } catch (e) {
    console.error('[Liked] error', e?.message);
    return res.status(500).json({ error: 'failed to get liked' });
  }
});

serverApp.get('/get-app-version/', async (req, res) => {
  try {
    const version = app.getVersion();
    console.log('[Version] successfully fetched:', version);
    return res.json({ version: version })
  } catch(e) {
    console.error('[Version] error', e?.message);
    return res.status(500).json({ error: 'failed to get version' });
  }  
});

serverApp.get('/get-latest-version/', async (req, res) => {
  try {
    const updateCheck = await autoUpdater.checkForUpdates().catch(err => {
      console.error("Update check failed:", err);
      return null;
    });

    const latestVersion = updateCheck?.updateInfo?.version || null;

    console.log('[Version] successfully fetched:', latestVersion);

    return res.json({ latestVersion });
  } catch (e) {
    console.error('[Version] error', e?.message);
    return res.status(500).json({ error: 'failed to get version' });
  }
});


serverApp.get('/download-update/', async (req, res) => {
  try {
    autoUpdater.downloadUpdate();

    return res.json({ success: true, message: 'Загрузка обновления запущена' });
  } catch (e) {
    console.error('[Download] error', e?.message);
    return res.status(500).json({ error: 'failed to download update' });
  }
});

serverApp.get('/init-ai-using/', async (req, res) => {
  try {
    await ensureAIReady(); 
    return res.json({ success: true, message: 'Скрипт використання AI запущений' });
  } catch (e) {
    console.error('[Init AI] error', e?.message);
    return res.status(500).json({ error: 'Помилка ініціалізаціі AI скрипту' });
  }
});

let aiProcess = null;
let aiReady = false;  
let pendingBatches = [];  
let initMutex = null;
let messageBuffer = ''; 
let globalStdoutHandler = null;

async function ensureAIReady() {
  if (aiReady) return;
  if (initMutex) return await initMutex;
  initMutex = startAIProcess().finally(() => { initMutex = null; });
  await initMutex;
}

async function startAIProcess() {
  return new Promise((resolve, reject) => {
    if (aiProcess && aiProcess.pid && !aiProcess.killed && aiProcess.exitCode === null && aiReady) {
      return resolve({ success: true, message: 'Процесс уже запущен' });
    }

    if (aiProcess) {
      try { aiProcess.kill('SIGTERM'); } catch {}  
      setTimeout(() => { try { aiProcess.kill('SIGKILL'); } catch {} }, 5000);  
      aiProcess = null;
      aiReady = false;
      pendingBatches = [];
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const isProd = app.isPackaged;
    const resourcesRoot = isProd ? process.resourcesPath : path.resolve(__dirname, '..', '..', '..');

    const exePath = path.join(resourcesRoot, 'AI', 'dist', 'AI_using.exe');
    const catBoostPath = path.join(resourcesRoot, 'AI', 'MarketMergeAI.cbm');
    const nerPath = path.join(resourcesRoot, 'AI', 'fashion_model');

    proceedToSpawn();

    function proceedToSpawn() {
      aiProcess = spawn(
        exePath,
        ['--io', 'json', '--from-bytes', '1'],
        { cwd: path.dirname(exePath), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } } 
      );

      let errBuf = '';

      const killWith = (msg) => {
        try { aiProcess.kill('SIGTERM'); } catch {}
        setTimeout(() => { try { aiProcess.kill('SIGKILL'); } catch {} }, 2000);
        aiProcess = null;
        aiReady = false;
        pendingBatches.forEach(({ reject }) => reject(new Error('AI process killed during init')));
        pendingBatches = [];
        reject(new Error(msg));
      };

      const t = setTimeout(() => killWith(`Timeout init: no response from Python; exe=${exePath}`), 30000);  

      aiProcess.on('error', (err) => {
        clearTimeout(t);
        killWith(`Spawn error: ${err.message}`);
      });

      aiProcess.on('close', (code) => {
        clearTimeout(t);
        aiReady = false;
        pendingBatches.forEach(({ reject }) => reject(new Error(`Process died during init ${code}`)));
        pendingBatches = [];
        aiProcess = null;
        if (code !== 0 || !aiReady) {
          reject(new Error(`Init failed: Python exited ${code} without success; stderr=${errBuf || '<empty>'}`));
        }
      });

      if (globalStdoutHandler) {
        aiProcess.stdout.removeListener('data', globalStdoutHandler);
        aiProcess.stderr.removeListener('data', globalStdoutHandler);
      }
      globalStdoutHandler = setupGlobalStdoutHandler(resolve, reject, t, killWith, errBuf);
      aiProcess.stdout.on('data', globalStdoutHandler);
      aiProcess.stderr.on('data', globalStdoutHandler);

      try {
        const initData = { 
          type: 'init',
          nerPath, 
          catBoostPath
        };
        aiProcess.stdin.write(JSON.stringify(initData) + '\n');
      } catch (e) {
        clearTimeout(t);
        killWith(`STDIN write failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  });
}

function setupGlobalStdoutHandler(initResolve, initReject, initTimeout, killWith, errBuf) {
  return (d) => {
    messageBuffer += d.toString();
    const lines = messageBuffer.split('\n');
    messageBuffer = lines.pop();  
    lines.forEach(line => {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line);
          const requestId = parsed.requestId;
          if (parsed.type === 'init_success') {
            clearTimeout(initTimeout);
            aiReady = true; 
            initResolve(parsed);
            processQueue();
          } else if (parsed.type === 'init_error') {
            clearTimeout(initTimeout);
            killWith(`Init error: ${parsed.error}`);
          } else if (parsed.type === 'batch_result' && requestId) {
            const pending = pendingBatches.find(p => p.requestId === requestId);
            if (pending) {
              pending.resolve(parsed.result);
              pendingBatches = pendingBatches.filter(p => p.requestId !== requestId);
            }
          } else if (parsed.type === 'batch_error' && requestId) {
            const pending = pendingBatches.find(p => p.requestId === requestId);
            if (pending) {
              pending.reject(new Error(`Batch error: ${parsed.error}`));
              pendingBatches = pendingBatches.filter(p => p.requestId !== requestId);
            }
          }
        } catch (e) {
        }
      }
    });
  };
}

function processQueue() {
  if (pendingBatches.length > 0 && aiReady && aiProcess && !aiProcess.killed) {
    const next = pendingBatches[0];
    try {
      const batchData = { type: 'batch', batch: next.batch, requestId: next.requestId };
      aiProcess.stdin.write(JSON.stringify(batchData) + '\n');
    } catch (e) {
      next.reject(new Error(`Queue send failed: ${e.message}`));
      pendingBatches.shift();  
      processQueue(); 
    }
  }
}

async function predictBatch(batch) {
  return new Promise(async (resolve, reject) => {
    if (!aiReady) {
      try {
        await ensureAIReady();
      } catch (e) {
        return reject(e);
      }
    }

    if (!aiProcess || aiProcess.killed || aiProcess.exitCode !== null) {
      return reject(new Error('AI process died unexpectedly'));
    }

    const requestId = Date.now() + Math.random();
    const timeout = setTimeout(() => {
      const pending = pendingBatches.find(p => p.requestId === requestId);
      if (pending) {
        pending.reject(new Error(`Timeout for batch ${requestId}`));
        pendingBatches = pendingBatches.filter(p => p.requestId !== requestId);
      }
    }, 60000);

    const queueEntry = { batch, resolve: (result) => { clearTimeout(timeout); resolve(result); }, 
                         reject: (err) => { clearTimeout(timeout); reject(err); }, requestId };
    pendingBatches.push(queueEntry);

    if (aiReady) {
      processQueue();
    }
  });
}

const normalizeToArray = (q, key) => {
  if (!q) return [];
  const v = q[key] !== undefined ? q[key] : q[`${key}[]`] !== undefined ? q[`${key}[]`] : undefined;
  if (v === undefined) return [];
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return String(v).split(',').map(x => x.trim()).filter(Boolean);
  return [];
};

export { serverApp };