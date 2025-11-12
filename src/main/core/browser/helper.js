import { sleep } from '../utils/utils.js';

const runExtractor = async (page, extractorStr, ...selectors) => {
  const extractorFunc = new Function('return (' + extractorStr + ')')();
  return await page.evaluate(extractorFunc, ...selectors).catch(e => {
    console.error('[extractor] eval err', e && e.message);
    return [];
  });
};

const autoScroll = async (page, step = 100000, delay_ms = 75) => {
  await page.evaluate(async (scrollStep, DelayMS) => {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    let total = 0;
    while (total < document.body.scrollHeight) {
      window.scrollBy(0, scrollStep);
      total += scrollStep;
      await delay(DelayMS);
    }
  }, step, delay_ms);
};

const scrollUntilItemsCount = async (page, itemSelector, minCount, opts = {}) => {
  const {
    maxScrolls = 200,
    scrollDelay = 50,
    stableThreshold = 5,
    step = null
  } = opts || {};
  try {
    const viewportHeight = await page.evaluate(() => window.innerHeight).catch(() => 800);
    const scrollStep = step || viewportHeight;
    let lastCount = await page
      .evaluate(sel => {
        try {
          return document.querySelectorAll(sel).length;
        } catch (e) {
          return 0;
        }
      }, itemSelector)
      .catch(() => 0);
    if (lastCount >= minCount) return lastCount;
    let stable = 0;
    for (let i = 0; i < maxScrolls; i++) {
      try {
        await page.evaluate(
          (sel, stepVal) => {
            const items = document.querySelectorAll(sel);
            let container = null;
            if (items && items.length) {
              let el = items[0].parentElement;
              while (el && el !== document) {
                const style = window.getComputedStyle(el);
                const overflowY = style && style.overflowY;
                if (el.scrollHeight > el.clientHeight && (overflowY === 'auto' || overflowY === 'scroll')) {
                  container = el;
                  break;
                }
                el = el.parentElement;
              }
            }
            if (!container) container = document.scrollingElement || document.documentElement;
            try {
              container.scrollBy(0, stepVal);
            } catch (e) {
              window.scrollBy(0, stepVal);
            }
          },
          itemSelector,
          scrollStep
        );
      } catch (e) {}
      try {
        await page.waitForFunction(
          (sel, prev) => {
            try {
              return document.querySelectorAll(sel).length > prev;
            } catch (e) {
              return false;
            }
          },
          { timeout: scrollDelay },
          itemSelector,
          lastCount
        );
      } catch (e) {}
      const current = await page
        .evaluate(sel => {
          try {
            return document.querySelectorAll(sel).length;
          } catch (e) {
            return 0;
          }
        }, itemSelector)
        .catch(() => 0);
      if (current >= minCount) {
        await sleep(250);
        return current;
      }
      if (current === lastCount) {
        stable += 1;
      } else {
        stable = 0;
        lastCount = current;
      }
      if (stable >= stableThreshold) {
        await sleep(200);
        return current;
      }
    }
    return await page
      .evaluate(sel => {
        try {
          return document.querySelectorAll(sel).length;
        } catch (e) {
          return 0;
        }
      }, itemSelector)
      .catch(() => 0);
  } catch (e) {
    console.warn('[scrollUntilItemsCount] err', e && e.message);
    return await page
      .evaluate(sel => {
        try {
          return document.querySelectorAll(sel).length;
        } catch (e) {
          return 0;
        }
      }, itemSelector)
      .catch(() => 0);
  }
};

const makeExtractorCandidateSelectors = () =>
  function cardsExtractor(cardsSel, priceSelArr, titleSelArr, hrefSelArr, imgSelArr, conditionSel, locationSel, sizeSel) {
    return (() => {
      const out = [];
      try {
        const cards = Array.from(document.querySelectorAll(cardsSel)).filter(card => !['top', 'ТОП'].some(t => card.textContent.includes(t)));
        if (cards && cards.length) {
          cards.forEach(el => {
            try {
              let price = null;
              for (const ps of priceSelArr) {
                const p = el.querySelector(ps);
                if (p && p.innerText) {
                  price = p.innerText.trim();
                  break;
                }
              }
              if (!price) return;
              let title = null;
              for (const ts of titleSelArr) {
                const t = el.querySelector(ts);
                if (t && t.innerText) {
                  title = t.innerText.trim();
                  break;
                }
              }
              let a = null;
              for (const hs of hrefSelArr) {
                const hn = el.querySelector(hs);
                if (hn && hn.href) {
                  a = hn;
                  break;
                }
              }
              if (!a) a = el.querySelector('a[href]') || el;
              const href = a && a.href ? a.href : null;
              let img = null;
              for (const is of imgSelArr) {
                const im = el.querySelector(is);
                if (im && (im.getAttribute('data-src') || im.src || im.getAttribute('data-src'))) {
                  img = im.getAttribute('data-src') || im.src || im.getAttribute('data-src');
                  break;
                }
              }              
              let condition = null;
              if (conditionSel && conditionSel.trim()) {
                const condEl = el.querySelector(conditionSel);
                if (condEl && condEl.innerText.trim()) {
                  condition = condEl.innerText.trim();
                }
              }
              let location = null;
              if (locationSel && locationSel.trim()) {
                const locationEl = el.querySelector(locationSel);
                if (locationEl && locationEl.innerText) {
                  location = locationEl.innerText.trim();
                }
              }
              let size = null;
              if (sizeSel && sizeSel.trim()) {
                const locationEl = el.querySelector(sizeSel);
                if (locationEl && locationEl.innerText) {
                  size = locationEl.innerText.trim();
                }
              }
              out.push({ title: title || null, href, price, img, marketplace: null, condition, location, size });
            } catch (e) {
              console.warn('extract item err', e && e.message);
            }
          });
          if (out.length) return out;
        }
      } catch (e) {
        console.warn('extract cards err', e && e.message);
      }
      try {
        const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
        for (const s of scripts) {
          try {
            const parsed = JSON.parse(s.innerText);
            if (!parsed) continue;
            if (parsed.itemListElement && Array.isArray(parsed.itemListElement)) {
              parsed.itemListElement.forEach(it => {
                const itm = it.item || it;
                const price = itm?.offers?.price || itm?.price;
                if (price)
                  out.push({
                    title: itm.name || itm.title || null,
                    href: itm.url || itm['@id'] || null,
                    price,
                    img: Array.isArray(itm.image) ? itm.image[0] : itm.image || null,
                    marketplace: null
                  });
              });
              if (out.length) return out;
            }
            if (parsed['@type'] && (parsed['@type'] === 'Product' || parsed['@type'] === 'Offer')) {
              const price = parsed.offers?.price || parsed.price;
              if (price) {
                out.push({
                  title: parsed.name || parsed.title || null,
                  href: parsed.url || null,
                  price,
                  img: Array.isArray(parsed.image) ? parsed.image[0] : parsed.image || null,
                  marketplace: null
                });
                return out;
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
      return out;
    })();
  }.toString();

export { makeExtractorCandidateSelectors, scrollUntilItemsCount, autoScroll, runExtractor };