// ===================================
// 作品詳細ページの機能
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    initNSFWWarning();
    initLightbox();
});

// ===================================
// NSFW警告
// ===================================
function initNSFWWarning() {
    const nsfwWarning = document.getElementById('nsfw-warning');
    const showNSFWBtn = document.getElementById('show-nsfw');
    const workImage = document.getElementById('work-image');
    
    if (!nsfwWarning || !showNSFWBtn) return;
    
    // 年齢確認済みの場合は自動表示
    const ageVerified = localStorage.getItem('ageVerified') === 'true';
    
    if (ageVerified) {
        nsfwWarning.style.display = 'none';
        if (workImage) {
            workImage.classList.remove('nsfw-blur');
        }
    } else {
        // ボタンクリックで表示
        showNSFWBtn.addEventListener('click', function() {
            localStorage.setItem('ageVerified', 'true');
            nsfwWarning.style.display = 'none';
            if (workImage) {
                workImage.classList.remove('nsfw-blur');
            }
        });
    }
}

// ===================================
// ライトボックス（画像拡大表示）
// ===================================
function initLightbox() {
    const lightboxBtn = document.getElementById('lightbox-btn');
    const lightbox = document.getElementById('lightbox');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxImage = document.getElementById('lightbox-image');
    const workImage = document.getElementById('work-image');
    
    if (!lightboxBtn || !lightbox || !workImage) return;
    
    // 拡大ボタンクリック
    lightboxBtn.addEventListener('click', function() {
        // NSFWでぼかしがかかっている場合は開かない
        if (workImage.classList.contains('nsfw-blur')) {
            return;
        }
        
        lightboxImage.src = workImage.src;
        lightboxImage.alt = workImage.alt;
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });
    
    // 閉じるボタン
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }
    
    // 背景クリックで閉じる
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    
    // ESCキーで閉じる
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && lightbox.style.display === 'flex') {
            closeLightbox();
        }
    });
    
    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}
