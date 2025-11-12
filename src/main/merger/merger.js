import { cluster } from '../server/server.js';    
import { MinHeap, relevance } from './sorter.js';  
import { isLiked } from '../core/cache/likedCache.js';  
import { normalizeCondition, normalizeSize } from '../core/utils/utils.js';

const SPECIAL_MARKETS = ['ebay', 'olx', 'vinted', 'kasta']; 

const initMergerForQuery = async (opts) => {
  const sources = [];
  const PROBE_RETRIES = 2;
  const markets = opts.markets || [];
  const requestedStates = opts.condition === '' ? [] : Array.isArray(opts.condition) ? opts.condition : [opts.condition] ;

  const probeMarket = async (market, condition = null) => {
    for (let attempt = 1; attempt <= PROBE_RETRIES; attempt++) {
      try {
        let new_opts = { ...opts, condition };
        const arr = await cluster.execute({ opts: new_opts, pageNum: 1, marketplace: market });
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        if (attempt < PROBE_RETRIES) {
          await new Promise(r => setTimeout(r, 400 + attempt * 200));
        }
      }
    }
    return [];
  };

  try {
    await Promise.all(markets.map(async (marketRaw) => {
      const market = String(marketRaw);
      const marketKey = market.toLowerCase();

      let statesForMarket;
      if (requestedStates && requestedStates.length) {
        statesForMarket = requestedStates;
      } else if (SPECIAL_MARKETS.includes(marketKey)) {
        statesForMarket = [''];
      } else {
        statesForMarket = ['new', 'used'];
      }

      await Promise.all(statesForMarket.map(async (condition) => {
        const firstPageArr = await probeMarket(market, condition);
        if (!firstPageArr.length) {
          console.log(`[initMergerForQuery] ${market} condition=${condition} first page empty - skipping this condition`);
          return null;
        }
        try {
          const src = await makeSource(market, opts, firstPageArr, condition);
          src.name = `${market}${condition ? `:${condition}` : ''}`;
          sources.push(src);
        } catch (e) {
          console.error(`[initMergerForQuery] makeSource error for ${market} condition=${condition}:`, e?.message);
        }
      }));
    }));

    if (!sources.length) {
      console.log('[initMergerForQuery] no sources available - returning empty merger');
      return {
        async nextBatch() { return { items: [], hasMore: false }; },
      };
    }

    let heap;
    if ( opts.order === 'h_l' || opts.order === "l_h" ) {
      heap = new MinHeap((A, B) => opts.order === 'h_l' ? B.item.price - A.item.price : A.item.price - B.item.price);
    } else {
      heap = new MinHeap((A, B) => relevance(B.item, opts.search) - relevance(A.item, opts.search));
    }    

    const results = await Promise.all(
      sources.map(async (s) => {
        try {
          const it = await s.nextItem();
          return it ? { item: it, src: s } : null;
        } catch (e) { console.error('[Merger] init error:', e?.message); }
      })
    );

    for (const { item, src } of results.filter(Boolean)) {
      heap.push({ item, src });
      console.log(`[Merger] initial push from ${src.name} price=${item.price}`);
    }

    const isPriceSort = ['l_h', 'h_l'].includes(opts.order);

    return {
      async nextBatch(limit = 50) {

        const out = [];
        const seen = new Set();

        while (out.length < limit) {
          if (!heap.size) {
            const active = sources.filter(s => !s.ended);
            if (!active.length) break;

            for (const s of active) {
              try {
                const it = await s.nextItem();
                if (it) heap.push({ item: it, src: s });
              } catch (e) { console.error('[Merger] refill error:', e?.message); }
            }
            if (!heap.size) break;
          }

          const { item, src } = heap.pop();
          const key = item.href?.trim() || item.title?.slice(0, 100) || JSON.stringify(item);

          if (seen.has(key)) {
            const nextIt = await src.nextItem().catch(() => null);
            if (nextIt) heap.push({ item: nextIt, src });
            continue;
          }

          seen.add(key);
          out.push(item);

          if (isPriceSort && Number.isFinite(item.price)) src.lastPrice = item.price;

          const next = await src.nextItem().catch(() => null);
          if (next) heap.push({ item: next, src });
        }

        const hasMore = (heap.size > 0 || sources.some(s => !s.ended));
        return { items: out, hasMore };
      },
      async close() {
        await Promise.all(
          [...cluster.workers.values()].map(async (worker) => {
            try {
              if (worker.page && !worker.page.isClosed()) {
                await worker.page.close();
              }
            } catch (err) {
              console.error("Failed to close page:", err.message);
            }
          })
        );
        await Promise.all(sources.map(s => s.close?.().catch(() => {})));
        sources.length = 0;
        console.log('[Merger] sources closed, aborted=true');
      }
    };
  } catch (err) { console.error('[initMergerForQuery] fatal error:', err?.message); throw err; }
};

const makeSource = async (market, opts = {}, initialPageArr = null, condition = null) => {
  const isPriceSort = ['l_h', 'h_l'].includes(opts.order);
  const _seenPageSignatures = new Set();

  const _fetchPage = async (pn) => {
    try {
      let new_opts = { ...opts, condition };
      const arr = pn === 1 && Array.isArray(initialPageArr)
        ? initialPageArr
        : await cluster.execute({ opts: new_opts, pageNum: pn, marketplace: market });

      if (!Array.isArray(arr) || arr.length === 0) return [];

      const sig = arr.slice(0, 8).map((it) =>
        (it?.href || (it?.title + it?.price) || JSON.stringify(it)).toString().slice(0, 80)
      ).join('|');

      if (sig && _seenPageSignatures.has(sig)) {
        console.log(`[Source ${market}${condition ? `:${condition}` : ''}] repeated page sig (pn=${pn}) - stop`);
        return [];
      }
      if (sig) _seenPageSignatures.add(sig);

      return arr;
    } catch (e) { console.error(`[Source ${market}${condition ? `:${condition}` : ''}] _fetchPage error`, e?.message); return []; }
  };

  const normalizeArr = async (arr, lastPrice) => {
    if (!arr?.length) return [];

    let out = await Promise.all(
      arr.map(async el => {
        el.condition = normalizeCondition(el.condition);
        el.size = normalizeSize(el.size, el.marketplace);
        el.liked = await isLiked(el.href);
        return el;
      })
    );

    out = out.filter(it => it.price != null && Number.isFinite(it.price));

    if (isPriceSort && Number.isFinite(lastPrice)) {
      out = out.filter(it =>
        opts.order === 'l_h' ? it.price >= lastPrice : it.price <= lastPrice
      );
    }

    if (isPriceSort) {
      out.sort((a, b) =>
        opts.order === 'l_h' ? a.price - b.price : b.price - a.price
      );
    }
    return out;
  };

  const src = {
    name: market,
    buf: [],
    idx: 0,
    page: 0,
    ended: false,
    lastPrice: isPriceSort ? (opts.order === 'l_h' ? -Infinity : Infinity) : null,
    _condition: condition, 
    async nextItem() {

      if (this.idx < this.buf.length) return this.buf[this.idx++];
      if (this.ended) return null;

      this.page++;
      const arr = await _fetchPage(this.page);
      if (!arr.length) return (this.ended = true, null);

      const valid = await normalizeArr(arr, this.lastPrice);
      if (!valid.length) return (this.ended = true, null);

      this.lastPrice = valid[valid.length - 1].price;
      this.buf = valid;
      this.idx = 0;

      return this.buf[this.idx++];
    },

    async close() {
      this.ended = true;
      this.buf = [];
      this.idx = 0;
      console.log(`[Source ${market}${condition ? `:${condition}` : ''}] closed`);
    }
  };

  try {
    src.page = 1;
    const arr = Array.isArray(initialPageArr) && initialPageArr.length
      ? initialPageArr
      : await _fetchPage(1);

    const valid = await normalizeArr(arr, src.lastPrice);
    if (valid.length) {
      src.buf = valid;
      src.lastPrice = valid[valid.length - 1].price;
    } else {
      src.ended = true;
    }
  } catch (e) { console.error(`[Source ${market}${condition ? `:${condition}` : ''}] init error`, e?.message); src.ended = true; }

  return src;
};

export { makeSource, initMergerForQuery };