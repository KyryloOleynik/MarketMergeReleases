
import { app, BrowserWindow, Menu, dialog } from 'electron';
import pkg from "electron-updater";
const { autoUpdater } = pkg;
import path from 'path';
import { initCluster, withPage } from '../core/browser/puppeteer.js';
import log from "electron-log";
import { serverApp } from './api.js';

import { fetchOlxPage } from '../marketplaces/olx/api.js';
import { fetchShafaPage } from '../marketplaces/shafa/api.js';
import { fetchVintedPage } from '../marketplaces/vinted/api.js';
import { fetchVestiairePage } from '../marketplaces/vestiaire/api.js';
import { fetchGrailedPage } from '../marketplaces/grailed/api.js';
import { fetchKastaPage } from '../marketplaces/kasta/api.js';
import { fetcheBayPage } from '../marketplaces/ebay/api.js';

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "debug";

autoUpdater.allowPrerelease = true;
autoUpdater.autoDownload = false; 
autoUpdater.autoInstallOnAppQuit = true;

let cluster;

const PORT = process.env.PORT || 3000;

function createWindow() {
  const win = new BrowserWindow({
    width: 1250,
    height: 1000,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  Menu.setApplicationMenu(null);

  const indexPath = path.join(app.getAppPath(), 'src/renderer/index.html');
  win.loadFile(indexPath).catch(err => console.error(err));
}

app.whenReady().then(async () => {
  autoUpdater.on("update-downloaded", () => {
    autoUpdater.quitAndInstall(); 
  });
  cluster = await initCluster();

  await cluster.task(async ({ page, data }) => {
    const { opts, pageNum, marketplace } = data;
    await withPage(page); 

    switch (marketplace) {
      case 'OLX':
        return await fetchOlxPage(opts, pageNum, page);
      case 'Shafa':
        return await fetchShafaPage(opts, pageNum, page);
      case 'Vinted':
        return await fetchVintedPage(opts, pageNum, page);
      case 'Vestiaire':
        return await fetchVestiairePage(opts, pageNum, page);
      case 'Grailed':
        return await fetchGrailedPage(opts, pageNum, page);
      case 'Kasta':
         return await fetchKastaPage(opts, pageNum, page);
      case 'eBay':
         return await fetcheBayPage(opts, pageNum, page);
      default:
        console.warn(`[Cluster] Unknown task marketplace: ${marketplace}`);
        return [];
    }
  });

  cluster.on('taskerror', (err, data) => {
    console.error('Cluster task error', err, data);
  });

  createWindow();
  serverApp.listen(PORT, ()=> {
    console.log(`Server listening http://localhost:${PORT}`);
  });
  app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

async function shutdownGracefully() {
  console.log('[App] shutting down gracefully: closing cluster...');
  try {
    await cluster.close();
    console.log('[App] cluster closed');
  } catch (e) {
    console.warn('[App] error closing cluster', e && e.message);
  }
}

app.on('before-quit', (e) => {
  shutdownGracefully().catch(() => {});
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received - shutting down gracefully');
  try { await shutdownGracefully(); } catch (e) { console.warn('error during shutdown', e && e.message); }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received - shutting down gracefully');
  try { await shutdownGracefully(); } catch (e) { console.warn('error during shutdown', e && e.message); }
  process.exit(0);
});

export { cluster };