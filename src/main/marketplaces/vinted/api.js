import { mapOrderToMarket } from '../../core/config.js';
import { autoScroll, makeExtractorCandidateSelectors, runExtractor } from '../../core/browser/helper.js';
import { getCurrency, safeCurrencyMultiplier } from '../../merger/sorter.js';
import { convertEUtoUS, findId } from '../../core/utils/sizes.js';
import { normalizePrice } from '../../merger/sorter.js';

const Vinted_Women_ClothingSizeMap = { "XXL": 1400, "XL": 1399, "L": 1398, "M": 1397, "S": 1396, "XS": 1395, "XXS": 1394 };
const Vinted_Women_FootwearSizeMap = { "3": 1364, "3.5": 1580, "4": 55, "4.5": 1195, "5": 56, "5.5": 1196, "6": 57, "6.5": 1197, "7": 58, "7.5": 1198, "8": 59, "8.5": 1199, "9": 60, "9.5": 1200, "10": 61, "10.5": 1201, "11": 62, "11.5": 1579, "12": 63, "12.5": 1573, "13": 1574, "13.5": 1575, "14": 1576, "14.5": 1577, "15": 1578, "One size": 94, "Other": 99 };
const Vinted_Men_ClothingSizeMap = { "XXS": 206, "XS": 206, "S": 207, "M": 208, "L": 209, "XL": 210, "XXL": 211 };
const Vinted_Men_FootwearSizeMap = { "5": 776, "5.5": 777, "6": 778, "6.5": 779, "7": 780, "7.5": 781, "8": 782, "8.5": 783, "9": 784, "9.5": 785, "10": 786, "10.5": 787, "11": 788, "11.5": 789, "12": 790, "12.5": 791, "13": 792, "13.5": 793, "14": 794, "14.5": 795, "15": 1190, "15.5": 1621, "16": 1191, "16.5": 1327, "17": 1622, "17.5": 1623, "One size": 1624, "Other": 1625 };

const fetchVintedPage = async (opts = {}, pageNum, page) => {
  try {
    const { search, priceFrom, priceTo, order, sizesClothes, sizesShoes, category, location, condition } = opts;
  
    let gender;
    const currency = await getCurrency('$').catch(() => NaN);
    const mult = safeCurrencyMultiplier(currency);
    const marketOrder = mapOrderToMarket(order, 'Vinted');
    const params = new URLSearchParams({
      page: pageNum,
      order: marketOrder,
      time: String(Math.floor(Date.now() / 1000)),
      search_text: String(search || ''),
      price_from: String(parseInt(priceFrom / mult)),
      currency: 'USD',
      price_to: String(parseInt(priceTo / mult))
    });

    if (condition === "new") {
      params.append('status_ids[]', '6');
      params.append('status_ids[]', '1');
    } else if(condition === 'used' ) {
      params.append('status_ids[]', '2');
      params.append('status_ids[]', '3');
      params.append('status_ids[]', '4');
    }
  
    const buildSizeFragments = (clothesArr, shoesArr, gender) => {
      if (shoesArr.length) {
        shoesArr.forEach(sizeVal => {
          let sizeId;
          const converted = convertEUtoUS(sizeVal, gender);
          if (converted) {
            sizeId = findId(gender === 'women' ? Vinted_Women_FootwearSizeMap : Vinted_Men_FootwearSizeMap, converted);
            sizeVal = converted;
          } else {
            sizeId = findId(gender === 'women' ? Vinted_Women_FootwearSizeMap : Vinted_Men_FootwearSizeMap, sizeVal.replace('.', ','));
          }
          if (sizeId) params.append('size_ids[]', sizeId);
        });
      }
      if (clothesArr.length) {
        clothesArr.forEach(sizeVal => {
          const finalId = findId(gender === 'women' ? Vinted_Women_ClothingSizeMap : Vinted_Men_ClothingSizeMap, sizeVal);
          if (sizeVal) params.append('size_ids[]', finalId);
        });
      }
    };

    let categoryparam;
    if (category.includes('women')) {
      gender = 'women';
      if (category.includes('sneak')) categoryparam = '16';
      else if (category.includes('cloth')) categoryparam = '4';
    } else if (category.includes('men')) {
      gender = 'men';
      if (category.includes('sneak')) categoryparam = '1231';
      else if (category.includes('cloth')) categoryparam = '2050';
    }

    if (categoryparam) params.append('catalog[]', categoryparam);
    buildSizeFragments(sizesClothes, sizesShoes, gender);
    const url = `https://www.vinted.com/catalog?${params}`;
    console.log(`[Vinted] goto ${url}`);
    const itemSelector = '[data-testid="grid-item"]';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(e => console.warn(`[goto] ${url} err:`, e.message));
    await page.waitForSelector(itemSelector, { timeout: 4000 });
    await autoScroll(page);
    const extractorStr = makeExtractorCandidateSelectors();
    const items = await runExtractor(
      page,
      extractorStr,
      itemSelector,
      ['button[aria-label*="includes Buyer Protection"] span.web_ui__Text__subtitle'],
      ['[data-testid$="--description-title"]'],
      ['a[data-testid$="--overlay-link"][href]'],
      ['img[data-testid$="--image--img"]'],
      '[data-testid$="--description-subtitle"]',
      '',
      '[data-testid$="--description-subtitle"]'
    );
    console.log(`[Vinted] page ${pageNum} found ${Array.isArray(items) ? items.length : 0}`);
    const normalized = await Promise.all(
      (items || []).map(async it => ({ ...(it || {}), price: await normalizePrice(it.price), marketplace: 'Vinted' }))
    );
    return normalized;
  } catch (err) {
    console.error('[Vinted] fetch error', err && err.message);
    return [];
  }
}

export { fetchVintedPage };