const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const normalizeCondition = (condition) => {
    if (!condition) return null;
    const lower = condition.toLowerCase();
    if (lower.includes('new') || lower.includes('нов')) return 'Нове';
    return 'Вживане';
};

const MARKETPLACE_SYSTEM = {
  OLX: 'EU',
  Shafa: 'EU',
  Vinted: 'US',
  Kasta: 'EU'
};

const normalizeSize = (size, marketplace) => {
  if (!size || typeof size !== 'string') return '';

  let sizeUpper = size.trim().toUpperCase()
  if (sizeUpper.includes('·')){
    sizeUpper = size.split('·')[0].trim()
  }
  
  sizeUpper = sizeUpper.replace(/,/g, '.');

  const system = MARKETPLACE_SYSTEM[marketplace] || null;

  const letterSizes = new Set();
  const numericSizes = new Set();
  const decimalSizes = new Set();
  const expandedRanges = new Set();
  const usUkSizes = new Set();

  const letterMatches = sizeUpper.match(/\b(\d?X{0,4}[SML]|[SML])\b/g) || [];
  letterMatches.forEach(match => {
    if (['S', 'M', 'L', 'XS', 'XL', 'XXS', 'XXL', 'XXXL', 'XXXXL', '3XL', '4XL', '5XL', 'XXXXS', '4XS', '3XS', 'XXXS', '5XS', 'XXXXXS'].includes(match)) {
      letterSizes.add(match);
    }
  });

  const usUkMatches = sizeUpper.matchAll(/\b(\d{1,2}(?:\\.5)?)\s*(US|UK)\b/gi);
  for (const match of usUkMatches) {
    usUkSizes.add(`${match[1]} ${match[2].toUpperCase()}`);
  }

  const rangeMatches = sizeUpper.matchAll(/\b(\d{2})-(\d{2})\b/g);
  for (const match of rangeMatches) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    for (let i = start; i <= end; i++) {
      expandedRanges.add(i.toString());
    }
  }

  let tempSize = sizeUpper;
  tempSize = tempSize.replace(/\b\d{2}-\d{2}\b/g, '');
  tempSize = tempSize.replace(/\b\d{1,2}(?:\\.5)?\s*(US|UK)\b/gi, '');

  const decimalMatches = tempSize.matchAll(/\b\d{1,2}\.\d\b/g);
  for (const match of decimalMatches) {
    decimalSizes.add(match[0]);
  }
  tempSize = tempSize.replace(/\b\d{2}\.\d\b/g, '');

  const numericMatches = tempSize.matchAll(/\b\d{1,2}\b/g);
  for (const match of numericMatches) {
    const num = parseInt(match[0], 10);
    if (num >= 4 && num <= 70) {
      numericSizes.add(match[0]);
    }
  }

  const finalSizes = [];

  if (letterSizes.size > 0) {
    for (const ls of letterSizes) {
      if (['XXXL', 'XXXXL', '3XL', '4XL', '5XL'].includes(ls)) {
        finalSizes.push('XXL');
      } else if (['XXXXS', '4XS', '3XS', 'XXXS', '5XS', 'XXXXXS'].includes(ls)) {
        finalSizes.push('XXS');
      } else {
        finalSizes.push(ls);
      }
    }
  } else {
    expandedRanges.forEach(num => {
      if (system === 'US') {
        finalSizes.push(`${num} US`);
      } else if (system === 'EU') {
        finalSizes.push(`${num} EU`);
      } else {
        if (num <= 15.0) {
          finalSizes.push(`${num} US`);
        } else {
          finalSizes.push(`${num} EU`);
        }
      }
    });
    decimalSizes.forEach(num => {
      if (system === 'US') {
        finalSizes.push(`${num} US`);
      } else if (system === 'EU') {
        finalSizes.push(`${num} EU`);
      } else {
        if (num <= 15.0) {
          finalSizes.push(`${num} US`);
        } else {
          finalSizes.push(`${num} EU`);
        }
      }
    });
    numericSizes.forEach(ns => {
      const num = parseInt(ns, 10);
      if (system === 'US') {
        finalSizes.push(`${ns} US`);
      } else if (system === 'EU') {
        finalSizes.push(`${ns} EU`);
      } else {
        if (num <= 15) {
          finalSizes.push(`${ns} US`);
        } else {
          finalSizes.push(`${ns} EU`);
        }
      }
    });
  }

  usUkSizes.forEach(s => finalSizes.push(s));

  const uniqueSizes = [...new Set(finalSizes)];
  uniqueSizes.sort((a, b) => {
    const ax = parseFloat(a), bx = parseFloat(b);
    if (!isNaN(ax) && !isNaN(bx)) return ax - bx;
    return String(a).localeCompare(String(b));
  });

  return uniqueSizes.length > 0 ? uniqueSizes.join(', ') : '';
};

export { normalizeCondition, sleep, normalizeSize };