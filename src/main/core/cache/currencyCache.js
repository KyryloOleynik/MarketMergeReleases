import { promises as fsPromises } from 'fs';
import { getCacheFile } from '../config.js';

let CurrencyCache = null;

const readCurrencyCache = async () => {
  if (CurrencyCache) return CurrencyCache;

  try {
    const file = getCacheFile();
    const raw = await fsPromises.readFile(file, 'utf-8').catch(() => null);
    CurrencyCache = raw ? JSON.parse(raw) : {};
    return CurrencyCache;
  } catch (e) {
    console.warn('[currency] read cache err', e && e.message);
    CurrencyCache = {};
    return CurrencyCache;
  }
};

const writeCurrencyCache = async (cache) => {
  try {
    const file = getCacheFile();
    await fsPromises.writeFile(file, JSON.stringify(cache, null, 2), 'utf-8');
    CurrencyCache = cache; 
    console.log('[currency] cache saved');
  } catch (e) {
    console.warn('[currency] write cache err', e && e.message);
  }
};

export { writeCurrencyCache, readCurrencyCache };