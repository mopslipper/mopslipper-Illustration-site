// ===================================
// ギャラリーページのフィルター・検索・タグクラウド機能
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    initPagination(); // 先にページネーションを初期化
    initGalleryFilters();
    initSearchFunction();
    initTagCloud();
    initSidebarToggle();
});

// サイドバーの折りたたみ機能
function initSidebarToggle() {
    const sectionTitles = document.querySelectorAll('.sidebar-section-title');
    
    sectionTitles.forEach(title => {
        title.addEventListener('click', function() {
            const content = this.nextElementSibling;
            
            // トグル
            this.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
        });
    });
}

function initGalleryFilters() {
    const worksGrid = document.getElementById('works-grid');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const tagFilters = document.querySelectorAll('.tag-filter');
    const showR18Checkbox = document.getElementById('show-r18');
    const showR15Checkbox = document.getElementById('show-r15');
    const noResults = document.getElementById('no-results');

    if (!worksGrid) return;

    let activeCategory = 'all';
    let activeTags = new Set();
    let showR18Only = false;
    let showR15Only = false;
    let searchQuery = '';

    // 検索クエリを設定する関数（他の関数から呼び出し可能）
    window.setSearchQuery = function(query) {
        searchQuery = query.toLowerCase();
        applyFilters();
        scrollToGalleryTop();
    };

    // カテゴリフィルタ
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            if (this.dataset.filter === 'all') {
                activeCategory = 'all';
            } else {
                activeCategory = this.dataset.value;
            }

            applyFilters();
        });
    });

    // タグフィルタ
    tagFilters.forEach(tag => {
        tag.addEventListener('click', function() {
            const tagValue = this.dataset.tag;

            if (activeTags.has(tagValue)) {
                activeTags.delete(tagValue);
                this.classList.remove('active');
            } else {
                activeTags.add(tagValue);
                this.classList.add('active');
            }

            applyFilters();
        });
    });

    // R-18作品のみ表示
    if (showR18Checkbox) {
        showR18Checkbox.addEventListener('change', function() {
            showR18Only = this.checked;
            if (showR18Only && showR15Only) {
                showR15Checkbox.checked = false;
                showR15Only = false;
            }
            applyFilters();
        });
    }

    // R-15作品のみ表示
    if (showR15Checkbox) {
        showR15Checkbox.addEventListener('change', function() {
            showR15Only = this.checked;
            if (showR15Only && showR18Only) {
                showR18Checkbox.checked = false;
                showR18Only = false;
            }
            applyFilters();
        });
    }

    // フィルタ適用
    function applyFilters() {
        const works = worksGrid.querySelectorAll('.work-card');
        let visibleWorks = [];

        works.forEach(work => {
            let show = true;

            const isNSFW = work.dataset.nsfw === 'true';
            const isSensitive = work.dataset.sensitive === 'true';

            // R-18/R-15フィルタ
            if (showR18Only) {
                if (!isNSFW) show = false;
            } else if (showR15Only) {
                if (!isSensitive) show = false;
            } else {
                if (isNSFW) show = false;
            }

            // カテゴリフィルタ
            if (show && activeCategory !== 'all') {
                const workCategory = work.dataset.category;
                if (workCategory !== activeCategory) show = false;
            }

            // タグフィルタ
            if (show && activeTags.size > 0) {
                const workTags = work.dataset.tags ? work.dataset.tags.split(',') : [];
                const hasTag = Array.from(activeTags).some(tag => workTags.includes(tag));
                if (!hasTag) show = false;
            }

            // 検索フィルタ
            if (show && searchQuery) {
                const title = work.querySelector('.work-title')?.textContent.toLowerCase() || '';
                const tags = work.dataset.tags?.toLowerCase() || '';
                const category = work.dataset.category?.toLowerCase() || '';
                
                if (!title.includes(searchQuery) && !tags.includes(searchQuery) && !category.includes(searchQuery)) {
                    show = false;
                }
            }

            if (show) {
                visibleWorks.push(work);
            }
        });

        // グローバルステートに保存
        window.galleryState.allWorks = visibleWorks;
        window.galleryState.currentPage = 1;

        // ページネーションを更新
        if (window.updatePagination) {
            window.updatePagination();
        }

        // 結果が0件の場合のメッセージ
        if (noResults) {
            noResults.style.display = visibleWorks.length === 0 ? 'block' : 'none';
        }

        // 検索結果数を表示
        updateSearchResultsCount(visibleWorks.length);
    }

    // 初期フィルタ適用
    applyFilters();

    function updateSearchResultsCount(count) {
        const resultsCount = document.getElementById('search-results-count');
        if (resultsCount) {
            if (searchQuery) {
                resultsCount.textContent = `${count}件の作品が見つかりました`;
                resultsCount.style.display = 'block';
            } else {
                resultsCount.style.display = 'none';
            }
        }
    }
}

// ===================================
// 検索機能
// ===================================
function initSearchFunction() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search');

    if (!searchInput) return;

    let searchTimeout;

    // リアルタイム検索
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        
        const query = this.value.trim();
        
        if (clearBtn) {
            clearBtn.style.display = query ? 'block' : 'none';
        }

        searchTimeout = setTimeout(() => {
            if (window.setSearchQuery) {
                window.setSearchQuery(query);
            }
        }, 300);
    });

    // クリアボタン
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            searchInput.value = '';
            this.style.display = 'none';
            if (window.setSearchQuery) {
                window.setSearchQuery('');
            }
            searchInput.focus();
        });
    }

    // Enterキーで検索
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            if (window.setSearchQuery) {
                window.setSearchQuery(this.value.trim());
            }
        }
    });
}

// ===================================
// タグクラウド機能
// ===================================
function initTagCloud() {
    const tagCloudContainer = document.getElementById('tag-cloud');
    const worksGrid = document.getElementById('works-grid');

    if (!tagCloudContainer || !worksGrid) return;

    // 全作品からタグを集計
    const tagCount = {};
    const works = worksGrid.querySelectorAll('.work-card');

    works.forEach(work => {
        const tags = work.dataset.tags ? work.dataset.tags.split(',') : [];
        tags.forEach(tag => {
            tag = tag.trim();
            if (tag) {
                tagCount[tag] = (tagCount[tag] || 0) + 1;
            }
        });
    });

    // タグを出現回数順にソート
    const sortedTags = Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

    if (sortedTags.length === 0) {
        tagCloudContainer.innerHTML = '<p class="tag-cloud-empty">タグがありません</p>';
        return;
    }

    // タグサイズを計算
    const maxCount = Math.max(...sortedTags.map(([, count]) => count));
    const minCount = Math.min(...sortedTags.map(([, count]) => count));

    sortedTags.forEach(([tag, count]) => {
        const size = minCount === maxCount 
            ? 3 
            : Math.floor(((count - minCount) / (maxCount - minCount)) * 4) + 1;

        const tagElement = document.createElement('button');
        tagElement.className = `tag-cloud-item tag-size-${size}`;
        tagElement.textContent = `${tag} (${count})`;
        tagElement.dataset.tag = tag;
        tagElement.dataset.count = count;

        // クリック時に検索
        tagElement.addEventListener('click', function() {
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = tag;
                if (window.setSearchQuery) {
                    window.setSearchQuery(tag);
                }
                const clearBtn = document.getElementById('clear-search');
                if (clearBtn) {
                    clearBtn.style.display = 'block';
                }
                scrollToGalleryTop();
            }
        });

        tagCloudContainer.appendChild(tagElement);
    });
}

// ===================================
// ページネーション機能
// ===================================
function initPagination() {
    // ページネーション用の状態を初期化
    if (!window.galleryState) {
        window.galleryState = {
            allWorks: [],
            currentPage: 1,
            itemsPerPage: 30
        };
    }

    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageNumbers = document.getElementById('page-numbers');

    if (!pagination || !prevBtn || !nextBtn || !pageNumbers) return;

    // ページネーションを更新
    window.updatePagination = function() {
        const state = window.galleryState;
        const totalWorks = state.allWorks.length;
        const totalPages = Math.ceil(totalWorks / state.itemsPerPage);

        // 30件以下なら非表示
        if (totalWorks <= state.itemsPerPage) {
            pagination.style.display = 'none';
            showAllWorks();
            return;
        }

        pagination.style.display = 'flex';

        // ページ番号を生成
        pageNumbers.innerHTML = '';
        const maxVisiblePages = 5;
        let startPage = Math.max(1, state.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        // 最初のページ
        if (startPage > 1) {
            addPageButton(1);
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.className = 'page-ellipsis';
                ellipsis.style.padding = '0 0.5rem';
                ellipsis.style.color = 'var(--text-secondary)';
                pageNumbers.appendChild(ellipsis);
            }
        }

        // ページ番号
        for (let i = startPage; i <= endPage; i++) {
            addPageButton(i);
        }

        // 最後のページ
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.className = 'page-ellipsis';
                ellipsis.style.padding = '0 0.5rem';
                ellipsis.style.color = 'var(--text-secondary)';
                pageNumbers.appendChild(ellipsis);
            }
            addPageButton(totalPages);
        }

        // ボタンの状態を更新
        prevBtn.disabled = state.currentPage === 1;
        nextBtn.disabled = state.currentPage === totalPages;

        // 現在のページの作品を表示
        displayCurrentPage();
    };

    function addPageButton(pageNum) {
        const btn = document.createElement('button');
        btn.className = 'page-number';
        btn.textContent = pageNum;
        if (pageNum === window.galleryState.currentPage) {
            btn.classList.add('active');
        }
        btn.addEventListener('click', () => {
            window.galleryState.currentPage = pageNum;
            window.updatePagination();
            scrollToTop();
        });
        pageNumbers.appendChild(btn);
    }

    function displayCurrentPage() {
        const state = window.galleryState;
        const worksGrid = document.getElementById('works-grid');
        const allWorkCards = worksGrid.querySelectorAll('.work-card');

        // すべての作品を非表示
        allWorkCards.forEach(work => {
            work.style.display = 'none';
        });

        // 現在のページの作品のみ表示
        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = startIndex + state.itemsPerPage;
        const worksToShow = state.allWorks.slice(startIndex, endIndex);

        worksToShow.forEach(work => {
            work.style.display = 'block';
        });
    }

    function showAllWorks() {
        const state = window.galleryState;
        const worksGrid = document.getElementById('works-grid');
        const allWorkCards = worksGrid.querySelectorAll('.work-card');

        // すべての作品を非表示
        allWorkCards.forEach(work => {
            work.style.display = 'none';
        });

        // フィルタされた作品のみ表示
        state.allWorks.forEach(work => {
            work.style.display = 'block';
        });
    }

    function scrollToTop() {
        const galleryMain = document.querySelector('.gallery-main');
        if (galleryMain) {
            galleryMain.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function scrollToGalleryTop() {
        const galleryMain = document.querySelector('.gallery-main');
        if (galleryMain) {
            galleryMain.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // 前へボタン
    prevBtn.addEventListener('click', () => {
        if (window.galleryState.currentPage > 1) {
            window.galleryState.currentPage--;
            window.updatePagination();
            scrollToTop();
        }
    });

    // 次へボタン
    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(window.galleryState.allWorks.length / window.galleryState.itemsPerPage);
        if (window.galleryState.currentPage < totalPages) {
            window.galleryState.currentPage++;
            window.updatePagination();
            scrollToTop();
        }
    });
}

// ===================================
// フィルタ状態の保存と作品リンク処理
// ===================================
document.addEventListener('DOMContentLoaded', function() {
    // 作品リンクにクリックイベントを追加
    document.addEventListener('click', function(e) {
        const workLink = e.target.closest('.work-link');
        if (workLink) {
            // 現在表示されている作品のslugリストを作成
            const visibleWorks = window.galleryState?.allWorks || [];
            const workSlugs = visibleWorks.map(work => work.dataset.slug);
            
            // localStorageに保存
            localStorage.setItem('galleryFilteredWorks', JSON.stringify(workSlugs));
            localStorage.setItem('galleryFilterTimestamp', Date.now().toString());
        }
    });
});
