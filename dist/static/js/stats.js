// ===================================
// 邨ｱ險域ュ蝣ｱ繝繝・す繝･繝懊・繝・
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('stats-grid')) {
        initStatsDashboard();
    }
});

function initStatsDashboard() {
    // 蜈ｨ菴懷刀繧貞叙蠕暦ｼ・orks-grid 縺後≠繧句ｴ蜷茨ｼ・
    const worksGrid = document.querySelector('.works-grid');
    
    if (!worksGrid) {
        // 繝・・繧ｿ縺悟叙蠕励〒縺阪↑縺・ｴ蜷医・繝・ヵ繧ｩ繝ｫ繝亥､繧定｡ｨ遉ｺ
        displayDefaultStats();
        return;
    }

    // LocalStorage縺九ｉ邨ｱ險域ュ蝣ｱ繧貞叙蠕・
    const works = worksGrid.querySelectorAll('.work-card');
    const totalWorks = works.length;
    
    // 邱城夢隕ｧ謨ｰ繧定ｨ育ｮ・
    let totalViews = 0;
    let totalLikes = 0;
    const categories = new Set();
    
    works.forEach(work => {
        // 繧ｫ繝・ざ繝ｪ繧貞庶髮・
        const category = work.dataset.category;
        if (category) {
            categories.add(category);
        }
        
        // 菴懷刀繝ｪ繝ｳ繧ｯ縺九ｉslug繧貞叙蠕・
        const workLink = work.querySelector('.work-link');
        if (workLink) {
            const href = workLink.getAttribute('href');
            const match = href.match(/\/works\/(.+?)\.html/);
            
            if (match) {
                const slug = match[1];
                
                // 髢ｲ隕ｧ謨ｰ繧貞叙蠕・
                const viewCount = parseInt(localStorage.getItem(`work_views_${slug}`) || '0');
                totalViews += viewCount;
                
                // 縺・＞縺ｭ謨ｰ繧貞叙蠕・
                const likeCount = parseInt(localStorage.getItem(`work_likes_${slug}`) || '0');
                totalLikes += likeCount;
            }
        }
    });
    
    // 邨ｱ險域ュ蝣ｱ繧定｡ｨ遉ｺ
    updateStatValue('total-works', totalWorks);
    updateStatValue('total-views', totalViews);
    updateStatValue('total-likes', totalLikes);
    updateStatValue('total-categories', categories.size);
    
    // 繧ｫ繧ｦ繝ｳ繝医い繝・・繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ
    animateStats();
}

function displayDefaultStats() {
    // 繝・ヵ繧ｩ繝ｫ繝育ｵｱ險茨ｼ井ｽ懷刀繝・・繧ｿ縺後↑縺・ｴ蜷茨ｼ・
    updateStatValue('total-works', 15);
    updateStatValue('total-views', 0);
    updateStatValue('total-likes', 0);
    updateStatValue('total-categories', 5);
    
    animateStats();
}

function updateStatValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.setAttribute('data-target', value);
        element.textContent = '0';
    }
}

function animateStats() {
    const statValues = document.querySelectorAll('.stat-value');
    
    statValues.forEach(stat => {
        const target = parseInt(stat.getAttribute('data-target') || '0');
        const duration = 1500; // 1.5遘・
        const steps = 60;
        const increment = target / steps;
        let current = 0;
        
        const timer = setInterval(() => {
            current += increment;
            
            if (current >= target) {
                stat.textContent = formatStatNumber(target);
                clearInterval(timer);
            } else {
                stat.textContent = formatStatNumber(Math.floor(current));
            }
        }, duration / steps);
    });
}

function formatStatNumber(num) {
    if (num >= 10000) {
        return (num / 10000).toFixed(1) + '荳・;
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

