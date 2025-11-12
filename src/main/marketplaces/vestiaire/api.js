import { mapOrderToMarket } from '../../core/config.js';
import { autoScroll, makeExtractorCandidateSelectors, runExtractor } from '../../core/browser/helper.js';
import { getCurrency, safeCurrencyMultiplier } from '../../merger/sorter.js';
import { convertEUtoUS, findId } from '../../core/utils/sizes.js';
import { normalizePrice } from '../../merger/sorter.js';

const fetchVestiairePage = async (opts = {}, pageNum, page) => {
  try {
    const { search, priceFrom, priceTo, order, sizesClothes, sizesShoes, category, location, condition } = opts;

    let gender;
    const searchQuery = encodeURIComponent(String(search));
    const currency = await getCurrency('$').catch(() => NaN);
    const currencyMultiplier = safeCurrencyMultiplier(currency);
    const marketOrder = mapOrderToMarket(order, 'Vestiaire');
    const WOMEN_SHOE_IDS = { '3': '186', '4': '63', '5': '31', '6': '33', '7': '35', '8': '37', '9': '39', '10': '41', '11': '43', '12': '45' };
    const MEN_SHOE_IDS = { '4': '262', '4.5': '263', '5': '261', '5.5': '260', '6': '46', '7': '48', '8': '50', '9': '52', '10': '54', '11': '56', '12': '58', '13': '60', '14.5': '259', '15': '258' };
    const WOMEN_CLOTHES_IDS = { XXS: '189', XS: '1', S: '2', M: '3', L: '4', XL: '5', XXL: '6' };
    const MEN_CLOTHES_IDS = { XS: '193', S: '180', M: '181', L: '182', XL: '183', XXL: '191' };
    const normalizeSize = size => {
      if (Array.isArray(size)) return [String(size[0]), size[1] != null ? String(size[1]) : null];
      if (size && typeof size === 'object') {
        const val = size.value ?? size.val ?? size.size ?? size[0];
        const id = size.id ?? size.optionId ?? size.option_id ?? size[1];
        return [String(val), id != null ? String(id) : null];
      }
      if (typeof size === 'string') {
        if (size.includes('#')) return size.split('#');
        return [size, null];
      }
      return [String(size), null];
    };
    const buildSizeFragments = (clothesArr, shoesArr, gender) => {
      const fragments = [];
      if (shoesArr.length) {
        const key = gender === 'women' ? '_size3' : '_size4';
        const parts = shoesArr
          .map(raw => {
            let [sizeVal, sizeId] = normalizeSize(raw);
            if (!sizeVal) return null;
            if (sizeVal.includes('#')) return sizeVal;
            const converted = convertEUtoUS(sizeVal, gender);
            if (converted) {
              sizeId = findId(gender === 'women' ? WOMEN_SHOE_IDS : MEN_SHOE_IDS, converted);
              sizeVal = converted;
            } else {
              sizeId = findId(gender === 'women' ? WOMEN_SHOE_IDS : MEN_SHOE_IDS, sizeVal.replace('.', ','));
            }
            return sizeId ? `${sizeVal}#${sizeId}` : null;
          })
          .filter(Boolean);
        if (parts.length) fragments.push(`${key}=${encodeURIComponent(parts.join('-'))}`);
      }
      if (clothesArr.length) {
        const key = gender === 'women' ? '_size1' : '_size10';
        const parts = clothesArr
          .map(raw => {
            const [sizeVal, sizeId] = normalizeSize(raw);
            const finalId = sizeId || findId(gender === 'women' ? WOMEN_CLOTHES_IDS : MEN_CLOTHES_IDS, sizeVal);
            return finalId ? `${sizeVal}#${finalId}` : null;
          })
          .filter(Boolean);
        if (parts.length) fragments.push(`${key}=${encodeURIComponent(parts.join('-'))}`);
      }
      return fragments;
    };
    let categoryFragment = '';
    if (category.includes('women')) {
      gender = 'women';
      categoryFragment = '_gender=Women%231';
      if (category.includes('sneak')) categoryFragment += '_categoryParent=Shoes%233';
      else if (category.includes('cloth')) categoryFragment += '_categoryParent=Clothing%232';
    } else if (category.includes('men')) {
      gender = 'men';
      categoryFragment = '_gender=Men%232';
      if (category.includes('sneak')) categoryFragment += '_categoryParent=Shoes%2313';
      else if (category.includes('cloth')) categoryFragment += '_categoryParent=Clothing%2312';
    }

    let conditionFragment = '';
    if (condition === 'new') {
      conditionFragment = '_condition=Never%20worn%2C%20with%20tag%231-Never%20worn%232';
    } else if (condition === 'used') {
      conditionFragment = '_condition=Very%20good%20condition%233-Good%20condition%234-Fair%20condition%235';
    }

    const locationMap = {
      ukraine: '_country=AT%23AT-BE%23BE-BG%23BG-CY%23CY-CZ%23CZ-DK%23DK-EE%23EE-FI%23FI-FR%23FR-DE%23DE-GR%23GR-HU%23HU-IE%23IE-IT%23IT-LV%23LV-LT%23LT-LU%23LU-NL%23NL-NO%23NO-PL%23PL-PT%23PT-RO%23RO-SK%23SK-SI%23SI-ES%23ES-SE%23SE-CH%23CH-GB%23GB',
      europe: '_country=AT%23AT-BE%23BE-BG%23BG-CY%23CY-CZ%23CZ-DK%23DK-EE%23EE-FI%23FI-FR%23FR-DE%23DE-GR%23GR-HU%23HU-IE%23IE-IT%23IT-LV%23LV-LT%23LT-LU%23LU-NL%23NL-NO%23NO-PL%23PL-PT%23PT-RO%23RO-SK%23SK-SI%23SI-ES%23ES-SE%23SE-CH%23CH-GB%23GB',
      usa: '_country=US%23US-CA%23CA',
      other: '_country=AU%23AU-HK%23HK-ID%23ID-SG%23SG'
    };

    let locationFragment = '';
    if (locationMap[location]) {
      locationFragment = locationMap[location];
    }

    const minPrice = parseInt(priceFrom / currencyMultiplier);
    const maxPrice = parseInt(priceTo / currencyMultiplier);
    let url = `https://us.vestiairecollective.com/search/${pageNum > 1 ? `p-${pageNum}/` : ''}?q=${searchQuery}&sortBy=${marketOrder}#priceMin=${minPrice}00_priceMax=${maxPrice}00${conditionFragment}${locationFragment}${categoryFragment}`;
    const sizeFragments = buildSizeFragments(sizesClothes, sizesShoes, gender);
    const itemSelector = '[data-cy^="catalog__productCard__"]';
    if (sizeFragments.length) {
      const sizeStr = sizeFragments.join('_');
      url += url.includes('#') ? sizeStr : '#' + sizeStr;
    }
    console.log(`[Vestiaire] goto ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(e => console.warn(`[goto] ${url} err:`, e.message));
    await page.waitForSelector(itemSelector, { timeout: 4000 });
    await autoScroll(page);

    const extractorSelectors = makeExtractorCandidateSelectors();
    const items = await runExtractor(
      page,
      extractorSelectors,
      itemSelector,
      ['[data-cy="productCard__text__price__discount"]'],
      ['[data-cy="productCard__text__name"]'],
      ['[data-cy="productCard__image"][href]'],
      ['[data-cy="productCard__imageContainer"] img'],
      '',
      'span[class*="product-card_productCard__text__bottom__location__label"]',
      'p[data-cy="productCard__text__size"]'
    );
    return await Promise.all(
      (items || []).map(async item => ({
        ...(item || {}),
        price: await normalizePrice(item.price),
        marketplace: 'Vestiaire',
        condition,
      }))
    );
  } catch (err) {
    console.error('[Vestiaire] fetch error', err?.message);
    return [];
  }
}

export { fetchVestiairePage };