import { readCurrencyCache, writeCurrencyCache } from "../core/cache/currencyCache.js";

const inFlight = {};
const priceCache = new Map();

const getCurrency = async currency => {
  const today = new Date().toISOString().slice(0, 10);
  const cache = await readCurrencyCache();
  if (cache?.[currency]?.date === today && Number.isFinite(cache[currency].rate)) {
    return cache[currency].rate;
  }
  if (inFlight[currency]) return inFlight[currency];
  inFlight[currency] = (async () => {
    try {
      const rate = await fetchCurrency(currency);
      if (Number.isFinite(rate)) {
        cache[currency] = { date: today, rate };
        await writeCurrencyCache(cache);
      }
      return rate;
    } finally {
      delete inFlight[currency];
    }
  })();
  return inFlight[currency];
};

const fetchCurrency = async currency => {
  try {
    const res = await fetch('https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11');
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn('[fetchCurrency] parse as JSON failed, snippet:', text && text.slice(0, 200));
      return NaN;
    }
    if (!Array.isArray(data)) {
      console.warn('[fetchCurrency] unexpected response shape');
      return NaN;
    }
    if (currency === '$') {
      const usd = data.find(item => item.ccy === 'USD' && item.base_ccy === 'UAH');
      return usd ? parseFloat(usd.buy) : NaN;
    }
    if (currency === '¥') {
      const cny = data.find(item => item.ccy === 'CNY' && item.base_ccy === 'UAH');
      return cny ? parseFloat(cny.buy) : NaN;
    }
    return NaN;
  } catch (e) {
    console.error('[fetchCurrency] error', e && e.message);
    return NaN;
  }
};

const normalizePrice = async raw => {
  if (raw == null) return NaN;
  if (priceCache.has(raw)) return priceCache.get(raw);

  const s = String(raw).replace(/\u00A0/g, " ").trim();
  const num = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num)) {
    priceCache.set(raw, NaN);
    return NaN;
  }

  let rate = 1;
  if (s.includes("$")) rate = await getCurrency("$");

  const result = Number.isFinite(rate) ? Math.round(num * rate) : NaN;
  priceCache.set(raw, result);
  return result;
};

class MinHeap {
  constructor(cmp) {
    this.h = [];
    this.cmp = cmp || ((a, b) => a - b);
  }
  push(v) {
    this.h.push(v);
    this._up(this.h.length - 1);
  }
  pop() {
    if (!this.h.length) return null;
    const top = this.h[0];
    const last = this.h.pop();
    if (this.h.length) {
      this.h[0] = last;
      this._down(0);
    }
    return top;
  }
  peek() {
    return this.h[0] || null;
  }
  get size() {
    return this.h.length;
  }
  _swap(i, j) {
    [this.h[i], this.h[j]] = [this.h[j], this.h[i]];
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cmp(this.h[i], this.h[p]) >= 0) break;
      this._swap(i, p);
      i = p;
    }
  }
  _down(i) {
    const n = this.h.length;
    while (true) {
      let l = i * 2 + 1;
      let r = l + 1;
      let s = i;
      if (l < n && this.cmp(this.h[l], this.h[s]) < 0) s = l;
      if (r < n && this.cmp(this.h[r], this.h[s]) < 0) s = r;
      if (s === i) break;
      this._swap(i, s);
      i = s;
    }
  }
}

function safeCurrencyMultiplier(currency) {
  if (!currency || typeof currency !== 'number' || !Number.isFinite(currency)) {
    return 1;
  }
  return currency;
}

// Меньше балов - релевантнее
const relevance = (item, search) => {
  let score = 0;
 
  score += Math.log(item.price + 1);

  score += Math.random() * 5;
  search = new RegExp(search, 'i');
  if ((search).test(item.title)) score += 50;
  return score
}

export { getCurrency, fetchCurrency, normalizePrice, MinHeap, safeCurrencyMultiplier, relevance };