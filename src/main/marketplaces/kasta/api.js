import { mapOrderToMarket, GRAILED_CHUNK_SIZE } from '../../core/config.js';
import { makeExtractorCandidateSelectors, runExtractor, scrollUntilItemsCount } from '../../core/browser/helper.js';
import { normalizePrice } from '../../merger/sorter.js';

const CLOTHES_LABEL_TO_EU = { XXS: 32, XS: 34, S: 36, M: 38, L: 40, XL: 42, XXL: 44, XXXL: 46 };
const KASTA_SIZE_GROUP_ID = 13;

function normalizeSizeValueForKasta(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s.includes('|')) return s.split('|')[1] || s;
  const dot = s.replace(',', '.');
  if (!isNaN(Number(dot))) return dot;
  return CLOTHES_LABEL_TO_EU[s.toUpperCase()] || s;
}

function buildKastaSizeParams(arr = []) {
  return Array.from(
    new Set(
      arr.map(x => normalizeSizeValueForKasta(x))
        .filter(Boolean)
        .map(v => `${KASTA_SIZE_GROUP_ID}|${v}`)
    )
  );
}

const fetchKastaPage = async (opts = {}, pageNum = 1, page) => {
  try {
    const { search, priceFrom, priceTo, order, sizesClothes, sizesShoes, category, location, condition } = opts;
    
    if (location !== '' && location !== 'europe' && location !== 'ukraine') {
      return [];
    }

    const menu = category.includes('sneak') || category.includes('shoe') || category.includes('obuv') ? 'obuv' : category.includes('cloth') || category.includes('clothes') ? 'odezhda' : '';
    const affiliation = category.includes('women') || category.includes('wom') ? 'zhinkam' : category.includes('men') || category.includes('cholov') ? 'cholovikam' : '';

    if (condition === 'used') {
      return [];
    }

    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (menu) params.set('menu', menu);
    if (affiliation) params.set('affiliation', affiliation);
    if (priceFrom != null) params.set('price-min', priceFrom);
    if (priceTo != null) params.set('price-max', priceTo);

    const marketOrder = mapOrderToMarket(order, 'Kasta');
    if (marketOrder) params.set('sort', marketOrder);

    [...buildKastaSizeParams(sizesShoes), ...buildKastaSizeParams(sizesClothes)]
      .forEach(s => params.append('size', `${s.replace('.', ',')}`));

    const url = `https://kasta.ua/uk/search/?${params.toString()}`;
    const itemSelector = '[chua-view="product_impression"]';

    console.log(`[Kasta] goto ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(e => console.warn(`[Kasta] goto err:`, e.message));
    await page.waitForSelector(itemSelector, { timeout: 4000 }).catch(() => {});

    const desiredCount = pageNum * (typeof GRAILED_CHUNK_SIZE === 'number' ? GRAILED_CHUNK_SIZE : 48);
    const found = await scrollUntilItemsCount(page, itemSelector, desiredCount, {
      maxScrolls: 100,
      scrollDelay: 100,
      stableThreshold: 5,
      step: 3000,
    });

    console.log(`[Kasta] after scroll found ${found} items (needed ${desiredCount})`);

    const extractorStr = makeExtractorCandidateSelectors();
    const allItems = await runExtractor(
      page,
      extractorStr,
      itemSelector,
      ['div.p__info_container span.t-bold.mr-8', 'div.p__price_currency'],
      ['header.p__info_name', 'a.p__name'],
      ['div.p__img a[href]'],
      ['div.p__img img'],
      '',
      '',
      'div.product-size-list'
    );

    const itemsArr = Array.isArray(allItems) ? allItems : [];
    const start = (pageNum - 1) * (typeof GRAILED_CHUNK_SIZE === 'number' ? GRAILED_CHUNK_SIZE : 48);
    const chunk = itemsArr.slice(start, start + (typeof GRAILED_CHUNK_SIZE === 'number' ? GRAILED_CHUNK_SIZE : 48));

    console.log(`[Kasta] chunk ${pageNum} returning ${chunk.length} items (from ${itemsArr.length} total extracted)`);

    return await Promise.all(
      chunk.map(async it => ({
        ...it,
        price: await normalizePrice(it.price),
        marketplace: 'Kasta',
        condition: 'Нове',
        location: 'Україна'
      }))
    );
  } catch (e) {
    console.error('[Kasta] fetch error', e.message);
    return [];
  }
};

export { fetchKastaPage };