import { mapOrderToMarket } from '../../core/config.js';
import { autoScroll, makeExtractorCandidateSelectors, runExtractor } from '../../core/browser/helper.js';
import { normalizePrice } from '../../merger/sorter.js';
import { sleep } from '../../core/utils/utils.js';

const fetchOlxPage = async (opts = {}, pageNum = 1, page) => {
  try {
    const { search, priceFrom, priceTo, order, sizesClothes, sizesShoes, category, location, condition } = opts;

    if (location !== '' && location !== 'europe' && location !== 'ukraine') {
      return [];
    }

    const q = encodeURIComponent(String(search || ''));
    const marketOrder = mapOrderToMarket(order, 'OLX') || 'filter_float_price:asc';
    const pf = Number.isFinite(Number(priceFrom)) ? Number(priceFrom) : 1;
    const pt = Number.isFinite(Number(priceTo)) ? Number(priceTo) : 9999999;
    const params = new URLSearchParams({
      currency: 'UAH',
      page: String(pageNum),
      'search[filter_float_price:from]': String(pf),
      'search[filter_float_price:to]': String(pt),
      'search[order]': marketOrder,
    });
    if (condition) {
      params.append(`search[filter_enum_state][0]`, condition);
    }
    const categoryPaths = {
      mens_clothes: '/muzhskaya-odezhda',
      womens_clothes: '/zhenskaya-odezhda',
      mens_sneakers: '/muzhskaya-obuv',
      womens_sneakers: '/zhenskaya-obuv'
    };
    const catPath = category && categoryPaths[category] ? categoryPaths[category] : '';
    (sizesShoes || []).forEach((size, idx) => {
      if (String(size) === 'Другой') {
        size = 'other';
      } else if (String(size) === 'One size') {
        size = 'one_size';
      }
      params.append(`search[filter_enum_size][${idx}]`, String(size).replace('.', '_'));
    });
    (sizesClothes || []).forEach((size, idx) => {
      params.append(`search[filter_enum_size][${idx}]`, String(size).toLowerCase());
    });
    const url = `https://www.olx.ua/uk/moda-i-stil${catPath}/q-${q}/?${params}`;
    const itemSelector = '[data-cy="l-card"]';
    console.log(`[OLX] goto ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(e => console.warn(`[goto] ${url} err:`, e.message));
    await page.waitForSelector(itemSelector, { timeout: 4000 });
    const hasItems = await page
      .evaluate(() => {
        try {
          const el = document.querySelector('[data-testid="total-count"]');
          if (el && typeof el.innerText === 'string') {
            const txt = el.innerText.replace(/\s+/g, ' ').trim();
            if (txt && !/0\s*оголошень|0\s*объявлений|Ми знайшли 0 оголошень/i.test(txt)) return true;
          }
          return !!document.querySelector('[data-cy="l-card"]');
        } catch (e) {
          return false;
        }
      })
      .catch(e => {
        console.error('[OLX] eval err', e && e.message);
        return false;
      });
    if (!hasItems) {
      console.log(`[OLX] page ${pageNum} - there are no items`);
      return [];
    }
    await autoScroll(page, 400, 200);
    await sleep(250);
    const extractorStr = makeExtractorCandidateSelectors();
    const items = await runExtractor(
      page,
      extractorStr,
      itemSelector,
      ['[data-testid="ad-price"]'],
      ['[data-cy="ad-card-title"] h4'],
      ['[data-cy="l-card"] a[href]'],
      ['[data-cy="l-card"] a[href] img'],
      'div:has([data-testid="slot-wrapper"]) > span span span',
      '[data-testid="location-date"]',
      'span[data-testid="param-value"]'
    );
    const foundCount = Array.isArray(items) ? items.length : 0;
    console.log(`[OLX] page ${pageNum} found ${foundCount}`);
    const normalized = await Promise.all(
      (items || []).map(async it => ({
        ...(it || {}),
        price: await normalizePrice(it.price),
        marketplace: 'OLX'
      }))
    );
    return normalized;
  } catch (err) {
    console.error('[OLX] fetch error', err && err.message);
    return [];
  }
}

export { fetchOlxPage };