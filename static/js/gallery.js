// ===================================
// ギャラリーページのフィルタ機能
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    initGalleryFilters();
});

function initGalleryFilters() {
    const worksGrid = document.getElementById('works-grid');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const tagFilters = document.querySelectorAll('.tag-filter');
    const hideNSFWCheckbox = document.getElementById('hide-nsfw');
    const noResults = document.getElementById('no-results');
    
    if (!worksGrid) return;
    
    let activeCategory = 'all';
    let activeTags = new Set();
    let hideNSFW = hideNSFWCheckbox ? hideNSFWCheckbox.checked : true;
    
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
    
    // NSFW表示/非表示
    if (hideNSFWCheckbox) {
        hideNSFWCheckbox.addEventListener('change', function() {
            hideNSFW = this.checked;
            applyFilters();
        });
    }
    
    // フィルタ適用
    function applyFilters() {
        const works = worksGrid.querySelectorAll('.work-card');
        let visibleCount = 0;
        
        works.forEach(work => {
            let show = true;
            
            // カテゴリフィルタ
            if (activeCategory !== 'all') {
                const workCategory = work.dataset.category;
                if (workCategory !== activeCategory) {
                    show = false;
                }
            }
            
            // タグフィルタ
            if (activeTags.size > 0) {
                const workTags = work.dataset.tags ? work.dataset.tags.split(',') : [];
                const hasTag = Array.from(activeTags).some(tag => workTags.includes(tag));
                if (!hasTag) {
                    show = false;
                }
            }
            
            // NSFWフィルタ
            if (hideNSFW && work.dataset.nsfw === 'true') {
                show = false;
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
