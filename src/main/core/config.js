import path from 'path';
import { app } from 'electron';
import { fileURLToPath } from 'url';

const isDebug = !!process.defaultApp;

const getLikedFile = () => path.join(app.getPath('userData'), 'liked-products.json');
const getCacheFile = () => path.join(app.getPath('userData'), 'currency-cache.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

let chromePath;
if (isDebug) {
    chromePath = path.join(rootDir, "app", "chrome", "chrome-win64", "chrome.exe");
    console.log(`[Cluster] Debug mode, chromePath = ${chromePath}`);
} else {
    chromePath = path.join(process.resourcesPath, "chrome", "chrome-win64", "chrome.exe");
    console.log(`[Cluster] Production mode, chromePath = ${chromePath}`);
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';

const GRAILED_CHUNK_SIZE = 50;
const MERCARI_CHUNK_SIZE = 48;

const mapOrderToMarket = (order, market) => {
  const o = String(order || '');
  const maps = {
    OLX: {
      relevant: 'relevance:desc',
      l_h: 'filter_float_price:asc',
      h_l: 'filter_float_price:desc',
      __default: 'filter_float_price:asc'
    },
    Shafa: {
      relevant: '1',
      l_h: '2',
      h_l: '3',
      __default: '2'
    },
    Vinted: {
      relevant: 'relevance',
      l_h: 'price_low_to_high',
      h_l: 'price_high_to_low',
      __default: 'price_low_to_high'
    },
    Grailed: {
      relevant: '',
      l_h: 'low-price',
      h_l: 'high-price',
      __default: 'low-price'
    },
    Vestiaire: {
      relevant: '',
      l_h: '1',
      h_l: '2',
      __default: '1'
    },
    Mercari: {
      relevant: '',
      l_h: '3',
      h_l: '4',
      __default: '3'
    },
    Kasta: {
      relevant: '',
      l_h: 'price-asc',
      h_l: 'price-desc',
      __default: ''
    },
    eBay: {
      relevant: '',
      l_h: '15',
      h_l: '16',
      __default: ''
    }
  };
  const table = maps[market];
  if (!table) return null;
  return table[o] !== undefined ? table[o] : table.__default;
};

export { getCacheFile, getLikedFile, chromePath, DEFAULT_USER_AGENT, GRAILED_CHUNK_SIZE, mapOrderToMarket, isDebug, __dirname, MERCARI_CHUNK_SIZE };