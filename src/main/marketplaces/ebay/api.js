import { mapOrderToMarket } from '../../core/config.js';
import { autoScroll, makeExtractorCandidateSelectors, runExtractor } from '../../core/browser/helper.js';
import { getCurrency, safeCurrencyMultiplier } from '../../merger/sorter.js';
import { normalizePrice } from '../../merger/sorter.js';
import { convertEUtoUS } from '../../core/utils/sizes.js';
import { sleep } from '../../core/utils/utils.js';

const fetcheBayPage = async (opts = {}, pageNum, page) => {
  try {
    const { search, priceFrom, priceTo, order, sizesClothes, sizesShoes, category, location, condition } = opts;
    
    let gender;
    gender = category.includes('men') ? 'men' : category.includes('women') ? 'women' : '';
    const searchQuery = encodeURIComponent(String(search || ''));
    const currency = await getCurrency('$').catch(() => NaN);
    const currencyMultiplier = safeCurrencyMultiplier(currency);

    let marketOrder = mapOrderToMarket(order, 'eBay');

    const pushUnique = (arr, v) => {
      if (v == null) return;
      const s = String(v).trim();
      if (!s || arr.includes(s)) return;
      arr.push(s);
    };

    const buildEbayClothesSizeParam = clothesArr => {
      if (!Array.isArray(clothesArr) || !clothesArr.length) return '';
      const sizes = [];
      for (const raw of clothesArr) {
        const val = raw === 'XXL' ? '2XL' : raw === 'XXS' ? '2XS' : raw;
        if (val) pushUnique(sizes, String(val).replace(/[^\w\.\-\s&]/g, '').trim());
      }
      const parts = [];
      if (sizes.length) parts.push(`${encodeURIComponent('Size')}=${sizes.map(s => encodeURIComponent(s)).join('%7C')}`);
      return parts.join('&');
    };

    const buildEbayShoeSizeParam = (shoesArr, gender) => {
      if (!Array.isArray(shoesArr) || !shoesArr.length) return '';
      const eu = [];
      const us = [];
      for (const raw of shoesArr) {
        if (!raw) continue;
        let n = String(raw).replace(',', '.').trim().replace(/[^\d.]/g, '');
        if (!n) continue;
        pushUnique(eu, n.replace('.', '%252E'));

        const usSize = convertEUtoUS(n, gender);
        if (usSize != null) pushUnique(us, String(usSize).replace('.', '%252E'));
      }

      const parts = [];
      if (eu.length) parts.push(`${encodeURIComponent('EU%20Shoe%20Size')}=${eu.join('%7C')}`);
      if (us.length) parts.push(`${encodeURIComponent('US%20Shoe%20Size')}=${us.join('%7C')}`);

      return parts.join('&');
    };

    const categoryMap = {
      mens_clothes: '1059',
      womens_clothes: '15724',
      mens_sneakers: '93427',
      womens_sneakers: '3034',
    };
    const effectiveCategory = categoryMap[category] || '';

    let conditionParam = condition === 'new' ? 'LH_ItemCondition=1000%7C1500%7C1750' : condition === 'used' ? 'LH_ItemCondition=3000%7C10' : ''; 

    const locationParam = location === 'usa' ? 'LH_PrefLoc=4' : location === 'europe' ? 'LH_PrefLoc=5' : location === 'other' ? 'LH_PrefLoc=6' : location === 'ukraine' ? 'LH_PrefLoc=5' : '';
    const minPrice = priceFrom ? parseInt(Number(priceFrom) / (currencyMultiplier || 1)) : null;
    const maxPrice = priceTo ? parseInt(Number(priceTo) / (currencyMultiplier || 1)) : null;
    const pageParam = pageNum && pageNum > 1 ? `_pgn=${pageNum}` : '';

    const params = [`_nkw=${searchQuery}`, '_fsrp=1'];
    if (effectiveCategory) {
      params.push(`_sacat=${encodeURIComponent(String(effectiveCategory))}`);
      if (/^\d+$/.test(String(effectiveCategory))) params.push(`_dcat=${encodeURIComponent(String(effectiveCategory))}`);
    }
    if (minPrice != null && !Number.isNaN(minPrice)) params.push(`_udlo=${minPrice}`);
    if (maxPrice != null && !Number.isNaN(maxPrice)) params.push(`_udhi=${maxPrice}`);
    if (marketOrder) params.push(`_sop=${encodeURIComponent(String(marketOrder))}`);

    const clothesParam = buildEbayClothesSizeParam(sizesClothes);
    if (clothesParam) params.push(clothesParam);

    const shoeParam = buildEbayShoeSizeParam(sizesShoes, gender);
    if (shoeParam) params.push(shoeParam);

    if (conditionParam) params.push(conditionParam);
    if (locationParam) params.push(locationParam);
    if (pageNum && pageNum > 1) params.push('_from=R40');
    if (pageParam) params.push(pageParam);

    const url = `https://www.ebay.com/sch/i.html?${params.join('&')}`;

    console.log('[eBay] goto', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    const itemSelector = 'li.s-card';
    try { await page.waitForSelector(itemSelector, { timeout: 4000 }); } catch { console.warn('[eBay] items selector not found, continuing extraction'); }
    await sleep(500);
    await autoScroll(page);

    const extractorSelectors = makeExtractorCandidateSelectors();
    const items = await runExtractor(
      page,
      extractorSelectors,
      itemSelector,
      ['.su-styled-text.primary.bold.s-card__price'],
      ['div[role="heading"].s-card__title span'],
      ['.image-treatment'],
      ['.image-treatment img.s-card__image[src]'],
      'div.s-card__subtitle span.su-styled-text.secondary.default:first-of-type',
      '.su-card-container__attributes__primary :nth-child(4 of div.s-card__attribute-row) span.su-styled-text.secondary.large',
      'div[role="heading"].s-card__title span'
    );

    return await Promise.all((items || []).map(async item => ({ ...(item || {}), price: await normalizePrice(item.price), marketplace: 'eBay', condition: item.condition || null })));
  } catch (err) {
    console.log('[eBay] fetching error: ', err)
    return [];
  }
};

export { fetcheBayPage };
