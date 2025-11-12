function escapeHTML(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parsePrice(value) {
  if (value == null) return null;
  const s = String(value).replace(/[^\d.,]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function formatPriceUA(n) {
  if (n == null) return '';
  try { return new Intl.NumberFormat('uk-UA').format(n) + ' грн.'; }
  catch { return n + ' грн.'; }
}

function renderList(items) {
  const list = document.getElementById('liked-list');
  const empty = document.getElementById('liked-empty');
  const skeletons = document.getElementById('liked-skeletons');
  const counter = document.getElementById('liked-counter');

  list.innerHTML = '';

  if (!items || !items.length) {
    skeletons.classList.add('d-none');
    list.classList.add('d-none');
    empty.classList.remove('d-none');
    counter.textContent = '';
    return;
  }

  empty.classList.add('d-none');
  skeletons.classList.add('d-none');
  list.classList.remove('d-none');

  const tpl = document.getElementById('tpl-liked-card');

  for (const obj of items) {
    const clone = tpl.content.cloneNode(true);

    const card = clone.querySelector('.liked-card');
    const img = clone.querySelector('img');
    const titleEl = clone.querySelector('.liked-title');
    const priceEl = clone.querySelector('.liked-price');
    const dateText = clone.querySelector('.liked-date');
    const locWrap = clone.querySelector('.liked-location');
    const locText = clone.querySelector('.liked-location-text');
    const market = clone.querySelector('.liked-marketplace');
    const removeBtn = clone.querySelector('.remove-liked');

    card.href = obj.href || '#';

    img.src = obj.img || 'https://via.placeholder.com/600x400?text=No+Image';
    img.alt = 'Товар';

    if (obj.condition) {
      const badge = document.createElement('div');
      badge.className = 'condition-badge glass-badge';
      badge.innerHTML = '<i class="bi bi-tag-fill me-1"></i>' + escapeHTML(obj.condition);
      clone.querySelector('.liked-image-wrapper').appendChild(badge);
    }

    titleEl.textContent = obj.title || 'Без названия';
    titleEl.title = obj.title || '';

    const n = parsePrice(obj.price);
    priceEl.textContent = n != null ? formatPriceUA(n) : '';
    if (!priceEl.textContent) priceEl.classList.add('invisible');

    dateText.textContent = 'Сьогодні';

    if (obj.location) {
      locText.textContent = obj.location;
      locWrap.classList.remove('d-none');
    }

    market.innerHTML = '<i class="bi bi-shop me-1"></i>' + escapeHTML(obj.marketplace || '');

    removeBtn.dataset.href = obj.href || '';

    list.appendChild(clone);
  }

  counter.textContent = `Всього: ${items.length}`;
}

function sortItems(items, mode) {
  const arr = [...items];
  if (mode === 'price_asc') arr.sort((a,b) => (parsePrice(a.price)??1e15) - (parsePrice(b.price)??1e15));
  else if (mode === 'price_desc') arr.sort((a,b) => (parsePrice(b.price)??-1) - (parsePrice(a.price)??-1));
  else if (mode === 'title_asc') arr.sort((a,b) => String(a.title||'').localeCompare(String(b.title||'')));
  return arr;
}

function filterItems(items, q) {
  if (!q) return items;
  const s = q.toLowerCase();
  return items.filter(o =>
    String(o.title||'').toLowerCase().includes(s) ||
    String(o.location||'').toLowerCase().includes(s)
  );
}

async function apiGetLiked() {
  const res = await fetch(`${API_BASE}/get-liked/`, { cache: 'no-store' });
  if (!res.ok) throw new Error('failed to load liked');
  const data = await res.json();
  return Array.isArray(data) ? data : (data && data.items) ? data.items : [];
}

async function apiRemoveLiked(href) {
  try {
    const res = await fetch(`${API_BASE}/clear-liked/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ href })
    });
    if (res.ok) return true;
  } catch {}
  return false;
}

let _all = [];

async function loadAndRender() {
  document.getElementById('liked-skeletons').classList.remove('d-none');
  document.getElementById('liked-list').classList.add('d-none');
  document.getElementById('liked-empty').classList.add('d-none');
  try {
    _all = await apiGetLiked();
    applyView();
  } catch (e) {
    console.error('[liked] load error', e);
    _all = [];
    applyView();
  }
}

function applyView() {
  const q = document.getElementById('liked-search').value.trim();
  const mode = document.getElementById('liked-order').value;
  let filtered = _all;
  if (q) {
    filtered = filterItems(_all, q);
  }
  const sorted = sortItems(filtered, mode);
  renderList(sorted);
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.remove-liked');
  if (btn) {
    e.preventDefault();
    const href = btn.dataset.href || '';
    const ok = await apiRemoveLiked(href);
    _all = _all.filter(x => String(x.href) !== String(href));
    applyView();
  }

  if (e.target.closest('#liked-refresh')) {
    e.preventDefault();
    loadAndRender();
  }
  if (e.target.closest('#liked-clear')) {
    e.preventDefault();
    try { await fetch(`${API_BASE}/clear-all-liked/`, { method: 'POST' }); } catch {}
    _all = [];
    applyView();
  }
});

document.getElementById('liked-search').addEventListener('input', () => applyView());
document.getElementById('liked-order').addEventListener('change', () => applyView());

loadAndRender();