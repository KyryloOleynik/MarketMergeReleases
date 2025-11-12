import puppeteer from 'puppeteer-extra';
import { Cluster } from 'puppeteer-cluster';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import BlockResourcesPlugin from 'puppeteer-extra-plugin-block-resources';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { DEFAULT_USER_AGENT, chromePath } from '../config.js';

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(BlockResourcesPlugin({blockedTypes: new Set(['media', 'font']), }));

const initCluster = async () => {
  console.log("[Cluster] init started");

  const userDataDir = path.join(os.tmpdir(), "puppeteer_profile");
  const cacheDir = path.join(os.tmpdir(), "puppeteer_cache");

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
    console.log(`[Cluster] created userDataDir: ${userDataDir}`);
  } else {
    console.log(`[Cluster] userDataDir already exists: ${userDataDir}`);
  }

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    console.log(`[Cluster] created cacheDir: ${cacheDir}`);
  } else {
    console.log(`[Cluster] cacheDir already exists: ${cacheDir}`);
  }

  console.log("[Cluster] launching...");
  const cluster = await Cluster.launch({
    puppeteer,
    concurrency: Cluster.CONCURRENCY_PAGE, 
    maxConcurrency: 10,
    puppeteerOptions: {
      headless: "new",
      args: [
        "--mute-audio",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--disable-gpu",
        "--no-first-run",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-translate",
        `--user-data-dir=${userDataDir}`,
        `--disk-cache-dir=${cacheDir}`,
      ],
      defaultViewport: { width: 1366, height: 768 },
      ignoreHTTPSErrors: true,
      executablePath: chromePath,
    },
    timeout: 60 * 1000,
  });

  console.log("[Cluster] successfully launched");

  return cluster;
};

const withPage = async (page, opts = {}) => {
  const { width = 1366, height = 768, userAgent = DEFAULT_USER_AGENT } = opts;
  if (userAgent) await page.setUserAgent(userAgent).catch(() => {});
  await page.setViewport({ width, height }).catch(() => {});
};

export { withPage, initCluster };
