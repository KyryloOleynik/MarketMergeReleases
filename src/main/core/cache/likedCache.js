import { promises as fsPromises } from 'fs';
import { getLikedFile } from '../config.js';

let LikedFile = null;
let LikedSet = null;

const readLikedFile = async () => {
  if (LikedFile) return LikedFile;

  try {
    const file = getLikedFile();
    const raw = await fsPromises.readFile(file, 'utf-8').catch(() => null);
    LikedFile = raw ? JSON.parse(raw) : [];
    LikedSet = new Set(LikedFile.map(p => p.href)); 
    return LikedFile;
  } catch (e) {
    console.warn('[liked] read cache err', e?.message);
    LikedFile = [];
    LikedSet = new Set();
    return LikedFile;
  }
};

const writeLikedFile = async (liked) => {
  try {
    const file = getLikedFile();
    await fsPromises.writeFile(file, JSON.stringify(liked, null, 2), 'utf-8');
    console.log('[liked] cache saved to', file);
  } catch (e) {
    console.warn('[liked] write file err', e?.message);
  }
};

const clearAllLiked = async () => {
  LikedFile = [];
  LikedSet = new Set();
  await writeLikedFile(LikedFile);
  console.log('[liked] all liked cleared');
};

const clearLiked = async (href) => {
  await readLikedFile();
  LikedFile = LikedFile.filter(obj => obj.href !== href);
  LikedSet.delete(href);
  await writeLikedFile(LikedFile);
  console.log('[liked] liked product cleared');
};

const addLikedProduct = async (product) => {
  await readLikedFile();
  if (!LikedSet.has(product.href)) {
    LikedFile.push(product);
    LikedSet.add(product.href);
    await writeLikedFile(LikedFile);
  }
};

const isLiked = async (href) => {
  if (!LikedSet) await readLikedFile();
  return LikedSet.has(href);
};

export { clearAllLiked, clearLiked, addLikedProduct, isLiked, readLikedFile };