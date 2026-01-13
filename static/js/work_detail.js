// ===================================
// 作品詳細ページの機能
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    initNSFWWarning();
    initLightbox();
    initViewCount();
    initLikeButton();
    initCommentForm();
    initShareButtons();
    initImageGallery();
    updateFilteredNavigation();
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

// ===================================
// シェアボタン
// ===================================
function initShareButtons() {
    const shareTwitterBtn = document.getElementById('share-twitter');
    const shareFacebookBtn = document.getElementById('share-facebook');
    const shareCopyBtn = document.getElementById('share-copy');
    const copyNotification = document.getElementById('copy-notification');

    if (!shareTwitterBtn && !shareFacebookBtn && !shareCopyBtn) return;

    const currentUrl = window.location.href;
    const pageTitle = document.querySelector('.work-detail-title')?.textContent || document.title;

    // Xでシェア
    if (shareTwitterBtn) {
        shareTwitterBtn.addEventListener('click', function() {
            const text = encodeURIComponent(pageTitle);
            const url = encodeURIComponent(currentUrl);
            const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
            window.open(twitterUrl, '_blank', 'width=600,height=400');
        });
    }

    // Facebookでシェア
    if (shareFacebookBtn) {
        shareFacebookBtn.addEventListener('click', function() {
            const url = encodeURIComponent(currentUrl);
            const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            window.open(facebookUrl, '_blank', 'width=600,height=400');
        });
    }

    // URLをコピー
    if (shareCopyBtn) {
        shareCopyBtn.addEventListener('click', function() {
            navigator.clipboard.writeText(currentUrl).then(function() {
                // コピー成功通知を表示
                if (copyNotification) {
                    copyNotification.style.display = 'block';
                    setTimeout(() => {
                        copyNotification.style.display = 'none';
                    }, 2000);
                }
                
                // ボタンのテキストを一時的に変更
                const originalText = shareCopyBtn.innerHTML;
                shareCopyBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> コピー完了';
                setTimeout(() => {
                    shareCopyBtn.innerHTML = originalText;
                }, 2000);
            }).catch(function(err) {
                console.error('コピーエラー:', err);
                alert('URLのコピーに失敗しました');
            });
        });
    }
}

// ===================================
// 画像ギャラリー（複数画像の切り替え）
// ===================================
function initImageGallery() {
    const thumbnails = document.querySelectorAll('.additional-images .thumbnail');
    const workImage = document.getElementById('work-image');
    
    if (!thumbnails.length || !workImage) return;
    
    thumbnails.forEach(function(thumbnail) {
        thumbnail.addEventListener('click', function() {
            const newImageSrc = thumbnail.getAttribute('data-image');
            
            // アクティブ状態を切り替え
            thumbnails.forEach(t => t.classList.remove('active'));
            thumbnail.classList.add('active');
            
            // メイン画像を切り替え
            workImage.src = newImageSrc;
            workImage.alt = thumbnail.querySelector('img').alt;
        });
    });
}

// ===================================
// フィルタされた作品リストに基づくナビゲーション更新
// ===================================
document.addEventListener('DOMContentLoaded', function() {
    updateFilteredNavigation();
});

function updateFilteredNavigation() {
    // localStorageからフィルタされた作品リストを取得
    const filteredWorksJson = localStorage.getItem('galleryFilteredWorks');
    const timestamp = localStorage.getItem('galleryFilterTimestamp');
    
    // 5分以内のデータのみ使用（古いデータは無視）
    const fiveMinutes = 5 * 60 * 1000;
    if (!filteredWorksJson || !timestamp || (Date.now() - parseInt(timestamp)) > fiveMinutes) {
        return; // デフォルトのナビゲーションを使用
    }
    
    try {
        const filteredWorks = JSON.parse(filteredWorksJson);
        const currentSlug = getCurrentWorkSlug();
        
        if (!currentSlug || filteredWorks.length === 0) return;
        
        // 現在の作品の位置を見つける
        const currentIndex = filteredWorks.indexOf(currentSlug);
        if (currentIndex === -1) return; // 現在の作品がフィルタリストにない場合はデフォルトを使用
        
        // 前後の作品を取得
        const prevSlug = currentIndex > 0 ? filteredWorks[currentIndex - 1] : null;
        const nextSlug = currentIndex < filteredWorks.length - 1 ? filteredWorks[currentIndex + 1] : null;
        
        // ナビゲーションボタンを更新
        updateNavButton('.nav-btn.prev', prevSlug);
        updateNavButton('.nav-btn.next', nextSlug);
        
    } catch (e) {
        console.error('Failed to parse filtered works:', e);
    }
}

function getCurrentWorkSlug() {
    // URLから現在の作品のslugを取得
    const pathParts = window.location.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    return filename.replace('.html', '');
}

function updateNavButton(selector, slug) {
    const navBtn = document.querySelector(selector);
    if (!navBtn) return;
    
    if (slug) {
        // slugがある場合、リンクを更新
        const basePath = getBasePath();
        const newHref = `${basePath}/works/${slug}.html`;
        
        if (navBtn.tagName === 'A') {
            navBtn.href = newHref;
        } else {
            // disabledのdivをaタグに変換
            const newLink = document.createElement('a');
            newLink.href = newHref;
            newLink.className = navBtn.className.replace('disabled', '').trim();
            newLink.innerHTML = navBtn.innerHTML;
            navBtn.parentNode.replaceChild(newLink, navBtn);
        }
    } else {
        // slugがない場合、disabledに変更
        if (navBtn.tagName === 'A') {
            const newDiv = document.createElement('div');
            newDiv.className = navBtn.className + ' disabled';
            newDiv.innerHTML = navBtn.innerHTML;
            // タイトルを「なし」に変更
            const titleSpan = newDiv.querySelector('.nav-btn-title');
            if (titleSpan) titleSpan.textContent = 'なし';
            navBtn.parentNode.replaceChild(newDiv, navBtn);
        }
    }
}

function getBasePath() {
    // base_pathを取得（相対パスの場合は..、絶対パスの場合はconfig値）
    const pathParts = window.location.pathname.split('/');
    // worksフォルダから1階層上に戻る
    return '..';
}

// ===================================
// フィルタリングされた作品リストに基づくナビゲーション更新
// ===================================
function updateFilteredNavigation() {
    // localStorageからフィルタリングされた作品リストを取得
    const filterDataStr = localStorage.getItem('galleryFilteredWorks');
    
    if (!filterDataStr) {
        // フィルタデータがない場合は何もしない（デフォルトのナビゲーションを使用）
        return;
    }
    
    try {
        const filterData = JSON.parse(filterDataStr);
        
        // 5分以上経過している場合は無効
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() - filterData.timestamp > fiveMinutes) {
            localStorage.removeItem('galleryFilteredWorks');
            return;
        }
        
        const filteredSlugs = filterData.slugs;
        if (!filteredSlugs || filteredSlugs.length === 0) return;
        
        // 現在の作品のslugを取得
        const workSection = document.querySelector('.work-detail-section');
        if (!workSection) return;
        
        const currentSlug = workSection.getAttribute('data-current-slug');
        if (!currentSlug) return;
        
        // 現在の作品のインデックスを取得
        const currentIndex = filteredSlugs.indexOf(currentSlug);
        
        if (currentIndex === -1) {
            // 現在の作品がフィルタリストにない場合は何もしない
            return;
        }
        
        // 前後の作品のslugを取得
        const prevSlug = currentIndex > 0 ? filteredSlugs[currentIndex - 1] : null;
        const nextSlug = currentIndex < filteredSlugs.length - 1 ? filteredSlugs[currentIndex + 1] : null;
        
        // ナビゲーションボタンを更新
        updateNavigationButton('.nav-btn.prev', prevSlug);
        updateNavigationButton('.nav-btn.next', nextSlug);
        
    } catch (e) {
        console.error('フィルタデータの解析に失敗:', e);
        localStorage.removeItem('galleryFilteredWorks');
    }
}
