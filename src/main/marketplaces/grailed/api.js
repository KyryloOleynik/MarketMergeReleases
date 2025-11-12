import { getCurrency, safeCurrencyMultiplier } from '../../merger/sorter.js';
import { mapOrderToMarket, GRAILED_CHUNK_SIZE } from '../../core/config.js';
import { convertEUtoUS } from '../../core/utils/sizes.js';
import { sleep } from '../../core/utils/utils.js';
import { makeExtractorCandidateSelectors, runExtractor, scrollUntilItemsCount } from '../../core/browser/helper.js';
import { normalizePrice } from '../../merger/sorter.js';

const GRAILED_CATEGORY_MAP = {
  mens_clothes:
    'tops.long_sleeve_shirts,tops.polos,tops.short_sleeve_shirts,tops.sweaters_knitwear,tops.sweatshirts_hoodies,tops.sleeveless,tops.jerseys,bottoms.casual_pants,bottoms.shorts,bottoms.sweatpants_joggers,bottoms.swimwear,outerwear.bombers,outerwear.light_jackets',
  womens_clothes:
    'womens_tops.hoodies,womens_tops.long_sleeve_shirts,womens_tops.short_sleeve_shirts,womens_tops.sweatshirts,womens_outerwear.bombers,womens_outerwear.jackets',
  mens_sneakers:
    'footwear.boots,footwear.leather,footwear.formal_shoes,footwear.hitop_sneakers,footwear.lowtop_sneakers,footwear.sandals,footwear.slip_ons',
  womens_sneakers: 'womens_footwear.hitop_sneakers,womens_footwear.lowtop_sneakers,womens_footwear.slip_ons'
};

const fetchGrailedPage = async (opts = {}, pageNum, page) => {
  try {
    const { search, priceFrom, priceTo, order, sizesClothes, sizesShoes, category, location, condition } = opts;

    const currency = await getCurrency('$').catch(() => NaN);
    const mult = safeCurrencyMultiplier(currency);
    const priceUSDFrom = parseInt(priceFrom / mult);
    const priceUSDTo = parseInt(priceTo / mult);
    const marketOrder = mapOrderToMarket(order, 'Grailed');
    const paramsObj = {
      query: String(search || ''),
      price: `${priceUSDFrom}:${priceUSDTo}`,
      sort: marketOrder
    };
    const catKey = GRAILED_CATEGORY_MAP[category] ? category : null;
    const isWomen = (catKey && catKey.startsWith('womens')) || category.includes('womens');
    if (catKey) {
      if (catKey.startsWith('mens')) paramsObj.department = 'menswear';
      else if (catKey.startsWith('womens')) paramsObj.department = 'womenswear';
    } else {
      if (isWomen) paramsObj.department = 'womenswear';
      else if (category.includes('mens')) paramsObj.department = 'menswear';
    }
    const params = new URLSearchParams(paramsObj);

    if (catKey) params.append('category', GRAILED_CATEGORY_MAP[catKey]);
    else if (category) params.append('category', category);

    const locationMap = {
      usa: ['Canada', 'United States'],
      europe: ['Europe', 'United Kingdom'],
      ukraine: ['Europe'],
      other: ['Other']
    };

    if (locationMap[location]) {
      params.set('location', locationMap[location].join(','));
    }

    const sizeTokens = [];
    if (Array.isArray(sizesClothes) && sizesClothes.length) {
      let footwearPrefixes;
      if (!category) {
        footwearPrefixes = ['tops', 'bottoms', 'outerwear'].flatMap(c => [c, `womens_${c}`]);
      } else {
        footwearPrefixes = ['tops', 'bottoms', 'outerwear'].map(c => (isWomen ? `womens_${c}` : c));
      }
      footwearPrefixes.forEach(prefix => {
        sizesClothes.forEach(s => {
          const v = `${prefix}.${String(s).trim().toLowerCase()}`;
          if (v) sizeTokens.push(v);
        });
      });
    }
    if (Array.isArray(sizesShoes) && sizesShoes.length) {
      const footwearPrefix = isWomen ? 'womens_footwear' : 'footwear';
      const shoesTokens = sizesShoes
        .map(x => convertEUtoUS(x, isWomen ? 'women' : 'men'))
        .filter(Boolean)
        .map(us => `${footwearPrefix}.${us}`);
      if (shoesTokens.length) sizeTokens.push(...shoesTokens);
    }
    if (sizeTokens.length) {
      params.append('size', Array.from(new Set(sizeTokens)).join(','));
    }

    if (condition === 'new') {
      params.append('condition', 'is_new');
    } else if (condition === 'used') {
      params.append('condition', 'is_gently_used,is_used,is_worn,is_not_specified');
    }

    const url = `https://www.grailed.com/shop?${params.toString()}`;
    const itemSelector = 'div[class*="UserItemForShopFeed_feedItem__"], div[class*="UserItemForFeed_feedItem__"]';
    console.log(`[Grailed] goto ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(e => console.warn(`[goto] ${url} err:`, e.message));
    await page.waitForSelector(itemSelector, { timeout: 4000 });
    const hasItems = await page.evaluate(sel => !!document.querySelector(sel), itemSelector).catch(() => false);
    if (!hasItems) {
      console.log(`[Grailed] page ${pageNum} - there are no items`);
      return [];
    }
    const desiredCount = pageNum * (typeof GRAILED_CHUNK_SIZE === 'number' ? GRAILED_CHUNK_SIZE : 48);
    const found = await scrollUntilItemsCount(page, itemSelector, desiredCount, {
      maxScrolls: 100,
      scrollDelay: 10,
      stableThreshold: 5,
      step: 100000,
    });
    console.log(`[Grailed] after scroll found ${found} items (needed ${desiredCount})`);
    await sleep(700);
    const extractorStr = makeExtractorCandidateSelectors();
    const allItems = await runExtractor(
      page,
      extractorStr,
      itemSelector,
      ['span[class*="Money_root__"][data-testid="Current"]'],
      ['p[class*="UserItem_title__"]'],
      ['a[href]'],
      ['img'],
      '',
      '.listing-item-location',
      'p[class*="UserItem_size__"]'
    );
    const itemsArr = Array.isArray(allItems) ? allItems : [];
    const start = (pageNum - 1) * (typeof GRAILED_CHUNK_SIZE === 'number' ? GRAILED_CHUNK_SIZE : 48);
    const chunk = itemsArr.slice(start, start + (typeof GRAILED_CHUNK_SIZE === 'number' ? GRAILED_CHUNK_SIZE : 48));
    console.log(`[Grailed] chunk ${pageNum} returning ${chunk.length} items (from ${itemsArr.length} total extracted)`);
    return await Promise.all(
      (chunk || []).map(async it => ({
        ...(it || {}),
        price: await normalizePrice(it.price),
        marketplace: 'Grailed',
        condition,
      }))
    );
  } catch (err) {
    console.error('[Grailed] fetch error', err?.message);
    return [];
  }
}

export { fetchGrailedPage };