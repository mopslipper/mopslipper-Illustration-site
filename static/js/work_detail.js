// ===================================
// 作品詳細ページの機能
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    initNSFWWarning();
    initLightbox();
    initViewCount();
    initLikeButton();
    initCommentForm();
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

// ===================================
// 表示回数カウント
// ===================================
function initViewCount() {
    const viewCountElement = document.getElementById('view-count');
    if (!viewCountElement) return;
    
    const workId = viewCountElement.getAttribute('data-work-id');
    const storageKey = `work_views_${workId}`;
    
    // 現在の表示回数を取得
    let viewCount = parseInt(localStorage.getItem(storageKey) || '0');
    
    // 表示回数を1増やす
    viewCount++;
    localStorage.setItem(storageKey, viewCount);
    
    // 表示を更新
    viewCountElement.textContent = formatNumber(viewCount);
}

// ===================================
// いいねボタン
// ===================================
function initLikeButton() {
    const likeBtn = document.getElementById('like-btn');
    const likeCountElement = document.getElementById('like-count');
    
    if (!likeBtn || !likeCountElement) return;
    
    const workId = likeBtn.getAttribute('data-work-id');
    const likeStorageKey = `work_likes_${workId}`;
    const likedStorageKey = `work_liked_${workId}`;
    
    // 現在のいいね数を取得
    let likeCount = parseInt(localStorage.getItem(likeStorageKey) || '0');
    likeCountElement.textContent = formatNumber(likeCount);
    
    // 既にいいね済みかチェック
    const isLiked = localStorage.getItem(likedStorageKey) === 'true';
    if (isLiked) {
        likeBtn.classList.add('liked');
    }
    
    // いいねボタンクリック
    likeBtn.addEventListener('click', function() {
        const currentlyLiked = likeBtn.classList.contains('liked');
        
        if (currentlyLiked) {
            // いいね解除
            likeCount = Math.max(0, likeCount - 1);
            likeBtn.classList.remove('liked');
            localStorage.setItem(likedStorageKey, 'false');
            likeBtn.classList.add('unliked-animation');
        } else {
            // いいね追加
            likeCount++;
            likeBtn.classList.add('liked');
            localStorage.setItem(likedStorageKey, 'true');
            likeBtn.classList.add('liked-animation');
        }
        
        // アニメーション終了後にクラスを削除
        setTimeout(() => {
            likeBtn.classList.remove('liked-animation', 'unliked-animation');
        }, 600);
        
        // 保存・表示更新
        localStorage.setItem(likeStorageKey, likeCount);
        likeCountElement.textContent = formatNumber(likeCount);
    });
}

// ===================================
// ユーティリティ: 数値フォーマット
// ===================================
function formatNumber(num) {
    if (num >= 10000) {
        return (num / 10000).toFixed(1) + '万';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

// ===================================
// コメントフォーム
// ===================================
function initCommentForm() {
    const commentForm = document.getElementById('comment-form');
    if (!commentForm) return;
    
    const submitBtn = document.getElementById('comment-submit-btn');
    const successMsg = document.getElementById('comment-success');
    const errorMsg = document.getElementById('comment-error');
    
    commentForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // ボタン無効化
        submitBtn.disabled = true;
        submitBtn.textContent = '送信中...';
        
        // メッセージをリセット
        successMsg.style.display = 'none';
        errorMsg.style.display = 'none';
        
        // FormData作成
        const formData = new FormData(commentForm);
        
        // Fetch APIで送信
        fetch(commentForm.action, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            return response.json().then(data => ({
                status: response.status,
                ok: response.ok,
                data: data
            }));
        })
        .then(result => {
            if (result.ok) {
                // 成功
                commentForm.style.display = 'none';
                successMsg.style.display = 'block';
                commentForm.reset();
                
                // 5秒後にフォームを再表示
                setTimeout(() => {
                    commentForm.style.display = 'block';
                    successMsg.style.display = 'none';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'コメントを送信';
                }, 5000);
            } else {
                throw new Error(result.data.error || '送信エラー');
            }
        })
        .catch(error => {
            console.error('送信エラー:', error);
            errorMsg.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'コメントを送信';
        });
    });
}
