// ===================================
// ギャラリーページのフィルター機能
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    initGalleryFilters();
});

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

    // カテゴリフィルタ
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // アクティブ状態を更新
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
        let visibleCount = 0;

        works.forEach(work => {
            let show = true;

            const isNSFW = work.dataset.nsfw === 'true';
            const isSensitive = work.dataset.sensitive === 'true';

            // R-18/R-15フィルタ
            if (showR18Only) {
                // R-18作品のみ表示
                if (!isNSFW) {
                    show = false;
                }
            } else if (showR15Only) {
                // R-15作品のみ表示
                if (!isSensitive) {
                    show = false;
                }
            } else {
                // デフォルト：R-18非表示、R-15と通常作品を表示
                if (isNSFW) {
                    show = false;
                }
            }

            // カテゴリフィルタ
            if (show && activeCategory !== 'all') {
                const workCategory = work.dataset.category;
                if (workCategory !== activeCategory) {
                    show = false;
                }
            }

            // タグフィルタ
            if (show && activeTags.size > 0) {
                const workTags = work.dataset.tags ? work.dataset.tags.split(',') : [];
                const hasTag = Array.from(activeTags).some(tag => workTags.includes(tag));
                if (!hasTag) {
                    show = false;
                }
            }

            // 表示/非表示
            work.style.display = show ? 'block' : 'none';
            if (show) visibleCount++;
        });

        // 結果が0件の場合のメッセージ
        if (noResults) {
            noResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }
    }

    // 初期フィルタ適用
    applyFilters();
}