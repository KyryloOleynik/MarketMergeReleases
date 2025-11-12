import { mapOrderToMarket } from '../../core/config.js';
import { autoScroll, makeExtractorCandidateSelectors, runExtractor } from '../../core/browser/helper.js';
import { normalizePrice } from '../../merger/sorter.js';

const SHAFA_SIZE_ID_WOMEN={34:31,34.5:227,35:32,35.5:228,36:33,36.5:248,37:34,37.5:229,38:35,38.5:230,39:36,39.5:231,40:37,40.5:232,41:38,41.5:233,42:39,42.5:234,43:40,43.5:451,44:235,44.5:452,45:236,45.5:453,46:237,'One size':47,'Другой':48};  
const SHAFA_SIZE_ID_MEN={36:171,37:172,38:173,38.5:238,39:174,39.5:239,40:175,40.5:240,41:176,41.5:241,42:177,42.5:242,43:178,43.5:243,44:179,44.5:244,45:180,45.5:245,46:181,47:182,47.5:246,48:183,49:184,'One size':185,'Другой':186};

const fetchShafaPage = async (opts = {}, pageNum = 1, page) => {
  try {
    const { search, priceFrom, priceTo, order, sizesClothes, sizesShoes, category, location, condition } = opts;

    if (location !== '' && location !== 'europe' && location !== 'ukraine') {
      return [];
    }
    
    let categoryPath;
    if (category.includes('wom') || category.includes('women') || category.includes('womens')) {
      categoryPath = 'women';
    } else if (category.includes('men') || category.includes('mens')) {
      categoryPath = 'men';
    } else {
      categoryPath = 'clothes';
    }
    let path = categoryPath;
    if (category.includes('sneak') || category.includes('shoe') || category.includes('obuv')) {
      path += categoryPath === 'women' ? '/zhenskaya-obuv' : '/obuv';
    }
    const params = new URLSearchParams({
      price_from: priceFrom,
      price_to: priceTo,
      ...(pageNum > 1 && { page: pageNum }),
      ...(search && { search_text: search }),
      ...(mapOrderToMarket(order, 'Shafa') && { sort: mapOrderToMarket(order, 'Shafa') })
    });

    if (condition === 'new') {
      params.append('conditions', '1'); 
    } else if (condition === 'used') {
      for (const p of ['5', '4', '3', '2']) {
        params.append('conditions', p);  
      }
    }

    for (const s of [...sizesShoes, ...sizesClothes].map(x => String(x).trim()).filter(Boolean)) {
      if (categoryPath == 'men') {
        if (SHAFA_SIZE_ID_MEN[s]) params.append('sizes', SHAFA_SIZE_ID_MEN[s]);
      } else {
        if (SHAFA_SIZE_ID_WOMEN[s]) params.append('sizes', SHAFA_SIZE_ID_WOMEN[s]);
      }
    }
    const url = `https://shafa.ua/uk/${path}?${params}`;
    const itemSelector = '.dqgIPe';
    console.log(`[Shafa] goto ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 }).catch(e => console.warn(`[goto] ${url} err:`, e.message));
    await page.waitForSelector(itemSelector, { timeout: 4000 });
    await autoScroll(page);
    const extractorStr = makeExtractorCandidateSelectors();
    const items = await runExtractor(
      page,
      extractorStr,
      itemSelector,
      ['.D8o9s7 p'],
      ['.CnMTkD'],
      ['a.p1SYwW[href]'],
      ['img.wD1fsK'],
      '',
      '',
      'p.NyHfpp'
    );
    console.log(`[Shafa] page ${pageNum} found ${items.length}`);
    return await Promise.all(
      items.map(async it => ({
        ...it,
        price: await normalizePrice(it.price),
        marketplace: 'Shafa',
        condition,
        location: "Україна"
      }))
    );
  } catch (e) {
    console.error('[Shafa] fetch error', e?.message);
    return [];
  }
}

export { fetchShafaPage };