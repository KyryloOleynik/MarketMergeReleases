document.addEventListener("DOMContentLoaded", () => { 
    const searchStatus = document.getElementById('searchStatus');
    const adsGrid = document.querySelector('.ads-grid');
    const adsGridContSkeleton = adsGrid.querySelector('.content-skeleton');
    const adsGridCont = adsGrid.querySelector('.content');
    const loadMoreBtn = document.createElement('button');
    const sizesShoesContainer = document.getElementById('sizesShoesContainer');
    const sizesClothesContainer = document.getElementById('sizesClothesContainer');
    const categorySelect = document.getElementById('categorySelect');
    loadMoreBtn.className = "btn btn-glass my-2 load-more";
    loadMoreBtn.innerText = "Підгрузити ще";
    let offset = 0;
    const limit = 50;
    let currentParams = null;
    let hasMore = true;
    let isLoading = false;

    function toggleContainer(container, disabled) {
        container.querySelectorAll('input').forEach(i => i.disabled = disabled);
        container.classList.toggle('d-none', disabled);
    }

    function hasChecked(container) {
        return [...container.querySelectorAll('input')].some(i => i.checked);
    }

    categorySelect.addEventListener('change', () => {
        const val = categorySelect.value;
        if (!val) {
            toggleContainer(sizesClothesContainer, false);
            toggleContainer(sizesShoesContainer, false);
            return;
        }
        if (val.includes('clothes')) {
            toggleContainer(sizesClothesContainer, false);
            toggleContainer(sizesShoesContainer, true);
        } else if (val.includes('sneakers')) {
            toggleContainer(sizesShoesContainer, false);
            toggleContainer(sizesClothesContainer, true);
        }
    });

    function syncBySizes() {
        const clothes = hasChecked(sizesClothesContainer);
        const shoes   = hasChecked(sizesShoesContainer);

        if (clothes && !shoes) {
                toggleContainer(sizesShoesContainer, true);
                [...categorySelect.options].forEach(opt => {
                opt.disabled = (opt.value == "" || opt.value.includes('sneakers'));
            });
        } else if (shoes && !clothes) {
                toggleContainer(sizesClothesContainer, true);
                [...categorySelect.options].forEach(opt => {
                opt.disabled = (opt.value == "" || opt.value.includes('clothes'));
            });
        } else {
            toggleContainer(sizesClothesContainer, false);
            toggleContainer(sizesShoesContainer, false);
            [...categorySelect.options].forEach(opt => opt.disabled = false);
        }

        CheckCategoryIsValid();
    }

    sizesClothesContainer.addEventListener('input', syncBySizes);
    sizesShoesContainer.addEventListener('input', syncBySizes);

    syncBySizes();

    function CheckCategoryIsValid() {
        if (categorySelect.options[categorySelect.selectedIndex].disabled) {
            const firstEnabled = Array.from(categorySelect.options).find(opt => !opt.disabled);
            if (firstEnabled) categorySelect.value = firstEnabled.value;
        }
    }

    function showSkeletons(count = 50, addMore=false) {
      if (!addMore){
        adsGridCont.classList.add('d-none');
        adsGridCont.innerHTML = '';
      }
      for(let i = 0; i < count; i++){
        adsGridContSkeleton.classList.remove('d-none');
        adsGridContSkeleton.innerHTML += `
        <div class="skeleton-card">
          <div class="skeleton-left">
            <div class="skeleton skeleton-img"></div>
          </div>
          <div class="skeleton-right">
            <div class="skeleton skeleton-text title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>
            <div class="skeleton skeleton-text price"></div>
            <div class="skeleton skeleton-text small"></div>
          </div>
        </div>
        `;
      }
    }

    adsGridCont.addEventListener('click', (e) => {
        const target = e.target.closest('.btn-add-liked');
        if (!target) return;
        e.stopPropagation();
        e.preventDefault();

        const href = target.dataset.href;
        const img = target.dataset.img;
        const condition = target.dataset.condition || '';
        const title = target.dataset.title;
        const price = target.dataset.price || '';
        const location = target.dataset.location || '';
        const marketplace = target.dataset.marketplace || '';

        addToLiked(e, href, img, condition, title, price, location, marketplace);
    });

    function appendItems(items) {
        adsGridContSkeleton.classList.add('d-none');
        adsGridContSkeleton.innerHTML = '';
        if (items.length > 1) {
            adsGridCont.classList.remove('d-none');
            items.forEach(obj => {
                const fakeBadge = obj.price / obj.recommendedPrice <= 0.6 ? `
                    <div class="suspicion-badge badge bg-warning bg-opacity-50 text-dark position-absolute top-0 end-0 m-1 d-flex align-items-center rounded-pill shadow-sm">
                    <span class="badge-round bg-warning bg-opacity-50 rounded-circle d-flex align-items-center justify-content-center">
                        <strong class="lh-1">!</strong>
                    </span>
                    <span class="suspicion-text mx-1">Ризик фейку</span>
                    </div>
                ` : '';

                adsGridCont.innerHTML += `
                    <a href="${obj.href}" class="ad-card position-relative text-decoration-none" target="_blank">
                        <div class="image-wrapper position-relative">
                            <img loading="lazy" src="${obj.img}" alt="Товар">
                            ${fakeBadge}  <!-- Вставка предупреждения (Bootstrap жёлтый) -->
                            ${obj.condition ? `<div class="condition-badge">
                                <i class="bi bi-tag-fill me-1"></i>${obj.condition}
                            </div>` : ''}
                        </div>
                        <div class="ad-info mt-2 w-100">
                            <div class="d-flex justify-content-between">
                                <h6 class="mb-1">${obj.title}</h6>
                                <div class="text-end">
                                    ${obj.price ? `<span class="price ${obj.recommendedPrice ? obj.price/obj.recommendedPrice >= 1.4 ? 'text-danger' : obj.price/obj.recommendedPrice >= 1 ? 'text-warning' : 'text-success' : 'text-success'} fw-bold d-block">${obj.price} грн.</span>` : ''}
                                    ${obj.recommendedPrice  ? `<small class="text-muted d-block">${obj.recommendedPrice} грн.</small>` : ''} 
                                </div>
                            </div>
                            ${obj.location ? `<p class="location mb-1"><i class="bi bi-geo-alt-fill me-1"></i>${obj.location}</p>` : ''}
                            ${obj.size ? `<p class="size mb-1"><i class="bi bi-tag-fill me-1"></i>${obj.size}</p>` : ''}
                            <div class="d-flex justify-content-between">
                                <span class="marketplace marketplace-glass py-1 px-2">
                                    <i class="bi bi-shop me-1"></i>${obj.marketplace}
                                </span>
                                <i class="btn-add-liked bi ${obj.liked ? 'bi-heart-fill' : 'bi-heart'} text-dark" style="font-size: 1.4rem; cursor:pointer; z-index: 1000;" data-href="${obj.href}" data-img="${obj.img}" data-condition="${obj.condition || ''}" data-title="${obj.title}" data-price="${obj.price || ''}" data-location="${obj.location || ''}" data-marketplace="${obj.marketplace}"></i>
                            </div>
                        </div>
                    </a>
                `;
            });
        }
    }

    async function addToLiked(e, href, img, condition, title, price, location, marketplace) {
        try {
            const isLiked = e.target.classList.contains('bi-heart-fill'); 
            let res;

            if (!isLiked) {
                res = await fetch(`${API_BASE}/add-liked/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ href, img, condition, title, price, location, marketplace })
                });
            } else {
                res = await apiRemoveLiked(href);
            }

            const data = await res.json(); 

            if (data.success) {
                e.target.classList.toggle('bi-heart');
                e.target.classList.toggle('bi-heart-fill');
            }
        } catch(e) {
            console.error(`[Fetch] fetch error: ${e}`);
        }
    }

    async function apiRemoveLiked(href) {
        const res = await fetch(`${API_BASE}/clear-liked/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ href })
        });

        if (!res.ok) {
            throw new Error('Failed to remove liked item');
        }
        return res; 
    }

    async function fetchItems(params, addMore=false, reset=true) {
        if (isLoading) return;
        isLoading = true; 

        showSkeletons(50, addMore);
        loadMoreBtn.style.display = "none";

        try {
            const aiFeatures = localStorage.getItem('mm:aiFeatures') ?? 'false';
            const query = new URLSearchParams({...params, offset, limit, reset, aiFeatures });
            const res = await fetch(`${API_BASE}/get-items/?` + query.toString());
            const data = await res.json();

            if (data.message.text & data.message.type) {
                showMessage(data.message.text, { type: data.message.type });
            }

            if(offset === 0) {
                searchStatus.innerText = `Ми знайшли ${data.total} оголошень`;
            } else {
                searchStatus.innerText = `Ми знайшли ${offset + data.total} оголошень`;
            }
            appendItems(data.items);

            hasMore = data.hasMore;
            if(hasMore) {
                if(!adsGrid.contains(loadMoreBtn)) adsGrid.parentElement.appendChild(loadMoreBtn);
                loadMoreBtn.style.display = "block";
            } else {
                loadMoreBtn.style.display = "none";
            }

            localStorage.setItem("searchResults", adsGrid.innerHTML);
        } catch(err) {
            console.error(err);
        } finally {
            isLoading = false;
        }
    }

    loadMoreBtn.addEventListener('click', () => {
        if (isLoading) return;
        offset += limit;
        if(currentParams) fetchItems(currentParams, true, false);
    });

    const marketsButtons = document.querySelectorAll('[data-filter]');
    marketsButtons.forEach(but => {
        but.addEventListener('click', ()=> {
            but.classList.toggle('active');
        });
    });

    const searchForm = document.getElementById('searchForm');
    searchForm.addEventListener('submit', async function(e){
        e.preventDefault();
        if (isLoading) return;

        const formData = new FormData(e.target);
        const markets = Array.from(document.querySelectorAll('[data-filter].active')).map(b => b.dataset.filter);
        const params = Object.fromEntries(formData.entries());
        params.markets = markets;
        params.sizesShoes = formData.getAll('sizesShoes[]');
        params.sizesClothes = formData.getAll('sizesClothes[]');
        currentParams = params;
        offset = 0;
        fetchItems(params);
    });
});
