// ===================================
// メインJavaScript
// ===================================

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initHamburgerMenu();
    initNSFWModal();
    initNSFWFilter();
});

// ===================================
// ハンバーガーメニュー
// ===================================
function initHamburgerMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMobile = document.getElementById('nav-mobile');
    
    if (!hamburger || !navMobile) return;
    
    hamburger.addEventListener('click', function() {
        hamburger.classList.toggle('active');
        navMobile.classList.toggle('active');
    });
    
    // メニューリンククリックで閉じる
    const navLinks = navMobile.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            hamburger.classList.remove('active');
            navMobile.classList.remove('active');
        });
    });
    
    // 外側クリックで閉じる
    document.addEventListener('click', function(e) {
        if (!hamburger.contains(e.target) && !navMobile.contains(e.target)) {
            hamburger.classList.remove('active');
            navMobile.classList.remove('active');
        }
    });
}

// ===================================
// NSFW警告モーダル
// ===================================
function initNSFWModal() {
    const modal = document.getElementById('nsfw-modal');
    if (!modal) return;
    
    // LocalStorageで年齢確認状態をチェック
    const ageVerified = localStorage.getItem('ageVerified');
    
    if (ageVerified !== 'true') {
        modal.style.display = 'flex';
    }
    
    // 「はい」ボタン
    const yesBtn = document.getElementById('nsfw-yes');
    if (yesBtn) {
        yesBtn.addEventListener('click', function() {
            localStorage.setItem('ageVerified', 'true');
            modal.style.display = 'none';
        });
    }
    
    // 「いいえ」ボタン
    const noBtn = document.getElementById('nsfw-no');
    if (noBtn) {
        noBtn.addEventListener('click', function() {
            // 18歳未満でも閲覧可能
            localStorage.setItem('ageVerified', 'true');
            modal.style.display = 'none';
            // メッセージを表示
            const message = document.createElement('div');
            message.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#4a90e2;color:white;padding:15px 30px;border-radius:8px;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:16px;';
            message.textContent = '18歳未満でも閲覧できます';
            document.body.appendChild(message);
            setTimeout(() => message.remove(), 3000);
        });
    }
}

// ===================================
// NSFW作品フィルタ
// ===================================
function initNSFWFilter() {
    const ageVerified = localStorage.getItem('ageVerified') === 'true';
    
    // R-18作品の処理
    const nsfwWorks = document.querySelectorAll('[data-nsfw="true"]');
    
    if (!ageVerified) {
        // 年齢未確認の場合、R-18作品を非表示
        nsfwWorks.forEach(work => {
            work.style.display = 'none';
        });
    }
}

// ===================================
// スムーススクロール
// ===================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
