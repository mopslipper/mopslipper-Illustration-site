// ===================================
// ライトボックス機能
// 画像の全画面表示、ズーム、ナビゲーション
// ===================================

class Lightbox {
    constructor() {
        this.currentIndex = 0;
        this.images = [];
        this.isZoomed = false;
        this.lightboxElement = null;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.init();
    }

    init() {
        // ライトボックスHTMLを作成
        this.createLightboxHTML();
        
        // イベントリスナーを設定
        this.setupEventListeners();
        
        // ギャラリーの画像をクリック可能にする
        this.setupGalleryImages();
    }

    createLightboxHTML() {
        const lightboxHTML = `
            <div id="lightbox" class="lightbox">
                <div class="lightbox-content">
                    <button class="lightbox-close" aria-label="閉じる">×</button>
                    
                    <button class="lightbox-nav lightbox-prev" aria-label="前の画像">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    
                    <div class="lightbox-image-side">
                        <div class="lightbox-image-container">
                            <div class="lightbox-loading"></div>
                            <img src="" alt="" class="lightbox-image">
                            <video src="" class="lightbox-video" controls style="display: none;"></video>
                        </div>
                        <div class="lightbox-zoom-hint">クリックでズーム</div>
                    </div>
                    
                    <div class="lightbox-info-side">
                        <div class="lightbox-info">
                            <div class="lightbox-title"></div>
                            <div class="lightbox-meta">
                                <span class="lightbox-category"></span>
                                <span class="lightbox-date"></span>
                            </div>
                            <div class="lightbox-tags"></div>
                            <div class="lightbox-description"></div>
                        </div>
                    </div>
                    
                    <button class="lightbox-nav lightbox-next" aria-label="次の画像">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', lightboxHTML);
        this.lightboxElement = document.getElementById('lightbox');
    }

    setupEventListeners() {
        const lightbox = this.lightboxElement;
        const closeBtn = lightbox.querySelector('.lightbox-close');
        const prevBtn = lightbox.querySelector('.lightbox-prev');
        const nextBtn = lightbox.querySelector('.lightbox-next');
        const image = lightbox.querySelector('.lightbox-image');

        // 閉じるボタン
        closeBtn.addEventListener('click', () => this.close());

        // 背景クリックで閉じる
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
                this.close();
            }
        });

        // ナビゲーションボタン
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.prev();
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.next();
        });

        // 画像クリックでズーム（動画の場合は無効）
        image.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentImage = this.images[this.currentIndex];
            if (currentImage && !currentImage.isVideo) {
                this.toggleZoom();
            }
        });

        // ズーム時のドラッグ操作
        image.addEventListener('mousedown', (e) => {
            if (this.isZoomed) {
                e.preventDefault();
                this.isDragging = true;
                this.dragStartX = e.clientX - this.panX;
                this.dragStartY = e.clientY - this.panY;
                image.style.cursor = 'grabbing';
            }
        });

        image.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.isZoomed) {
                e.preventDefault();
                this.panX = e.clientX - this.dragStartX;
                this.panY = e.clientY - this.dragStartY;
                this.updateImageTransform(image);
            }
        });

        image.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.isZoomed) {
                    image.style.cursor = 'grab';
                }
            }
        });

        image.addEventListener('mouseleave', () => {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.isZoomed) {
                    image.style.cursor = 'grab';
                }
            }
        });

        // キーボード操作
        document.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('active')) return;

            switch(e.key) {
                case 'Escape':
                    this.close();
                    break;
                case 'ArrowLeft':
                    this.prev();
                    break;
                case 'ArrowRight':
                    this.next();
                    break;
                case ' ':
                    e.preventDefault();
                    this.toggleZoom();
                    break;
            }
        });

        // ズームヒントの表示
        image.addEventListener('mouseenter', () => {
            const hint = lightbox.querySelector('.lightbox-zoom-hint');
            hint.classList.add('show');
            setTimeout(() => hint.classList.remove('show'), 2000);
        });
    }

    setupGalleryImages() {
        // ギャラリーページの画像
        const workCards = document.querySelectorAll('.work-card');
        workCards.forEach((card, index) => {
            const img = card.querySelector('.work-image img');
            const link = card.querySelector('.work-link');
            const title = card.querySelector('.work-title')?.textContent || '';
            
            if (img && !link.href.includes('.mp4') && !link.href.includes('.mov') && !link.href.includes('.webm')) {
                // 動画以外の場合のみライトボックスを有効化
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.collectImages();
                    const imageIndex = this.images.findIndex(imgData => imgData.title === title);
                    if (imageIndex !== -1) {
                        this.open(imageIndex);
                    }
                });
            }
        });

        // 作品詳細ページの画像とサムネイルのクリックイベント
        const workDetailImage = document.querySelector('.work-detail-image img');
        const galleryThumbnails = document.querySelectorAll('.additional-images .thumbnail');
        
        if (workDetailImage && !workDetailImage.src.includes('.mp4')) {
            // メイン画像のクリック
            workDetailImage.style.cursor = 'pointer';
            workDetailImage.addEventListener('click', () => {
                this.images = []; // 画像配列をリセット
                this.collectImages();
                this.open(0);
            });
            
            // サムネイルのクリック
            galleryThumbnails.forEach((thumb, index) => {
                thumb.style.cursor = 'pointer';
                thumb.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.images = []; // 画像配列をリセット
                    this.collectImages();
                    this.open(index);
                    
                    // アクティブなサムネイルを更新
                    galleryThumbnails.forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                    
                    // メイン画像も更新
                    const img = thumb.querySelector('img');
                    if (img && workDetailImage) {
                        workDetailImage.src = img.src;
                    }
                });
            });
        }
    }

    collectImages() {
        this.images = [];
        
        // ギャラリーページから収集
        const workCards = document.querySelectorAll('.work-card');
        workCards.forEach(card => {
            const img = card.querySelector('.work-image img');
            const title = card.querySelector('.work-title')?.textContent || '';
            const date = card.querySelector('.work-date')?.textContent || '';
            const category = card.dataset.category || '';
            const tags = card.dataset.tags ? card.dataset.tags.split(',') : [];
            const description = card.dataset.description || '';
            const isVideo = card.dataset.isVideo === 'true';
            const videoPath = card.dataset.videoPath || '';
            const isVisible = card.style.display !== 'none';
            
            if (img && isVisible) {
                if (isVideo) {
                    // 動画作品
                    this.images.push({
                        src: img.src, // サムネイル
                        videoSrc: videoPath,
                        isVideo: true,
                        title: title,
                        date: date,
                        category: category,
                        tags: tags,
                        description: description
                    });
                } else {
                    // 静止画作品（サムネイルの代わりに元画像を使用）
                    const imageSrc = img.src.replace('.jpg', '.webp');
                    this.images.push({
                        src: imageSrc,
                        isVideo: false,
                        title: title,
                        date: date,
                        category: category,
                        tags: tags,
                        description: description
                    });
                }
            }
        });

        // 作品詳細ページの場合
        const workDetailImage = document.querySelector('.work-detail-image img');
        if (workDetailImage && this.images.length === 0) {
            const title = document.querySelector('.work-detail-title')?.textContent || '';
            const date = document.querySelector('.work-detail-date')?.textContent || '';
            const category = document.querySelector('.work-detail-category')?.textContent || '';
            const description = document.querySelector('.work-detail-description')?.textContent || '';
            const tagsElements = document.querySelectorAll('.work-detail-tags .tag');
            const tags = Array.from(tagsElements).map(tag => tag.textContent);
            
            // additional_imagesがある場合は全サムネイルから収集
            const additionalThumbnails = document.querySelectorAll('.additional-images .thumbnail');
            if (additionalThumbnails.length > 0) {
                // サムネイルから全画像を収集（メイン画像+追加画像）
                additionalThumbnails.forEach(thumb => {
                    const img = thumb.querySelector('img');
                    if (img) {
                        this.images.push({
                            src: img.src,
                            title: title,
                            date: date,
                            category: category,
                            tags: tags,
                            description: description
                        });
                    }
                });
            } else {
                // サムネイルがない場合はメイン画像のみ
                this.images.push({
                    src: workDetailImage.src,
                    title: title,
                    date: date,
                    category: category,
                    tags: tags,
                    description: description
                });
            }
        }
    }

    open(index = 0) {
        this.currentIndex = index;
        this.isZoomed = false;
        this.lightboxElement.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.showImage();
    }

    close() {
        this.lightboxElement.classList.remove('active');
        document.body.style.overflow = '';
        this.isZoomed = false;
    }

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.isZoomed = false;
            this.showImage();
        }
    }

    next() {
        if (this.currentIndex < this.images.length - 1) {
            this.currentIndex++;
            this.isZoomed = false;
            this.showImage();
        }
    }

    toggleZoom() {
        const image = this.lightboxElement.querySelector('.lightbox-image');
        this.isZoomed = !this.isZoomed;
        
        if (this.isZoomed) {
            image.classList.add('zoomed');
            image.style.cursor = 'grab';
            this.panX = 0;
            this.panY = 0;
            this.updateImageTransform(image);
        } else {
            image.classList.remove('zoomed');
            image.style.cursor = 'zoom-in';
            this.panX = 0;
            this.panY = 0;
            image.style.transform = '';
        }
    }

    updateImageTransform(image) {
        image.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(2)`;
    }

    showImage() {
        const lightbox = this.lightboxElement;
        const image = lightbox.querySelector('.lightbox-image');
        const video = lightbox.querySelector('.lightbox-video');
        const loading = lightbox.querySelector('.lightbox-loading');
        const title = lightbox.querySelector('.lightbox-title');
        const category = lightbox.querySelector('.lightbox-category');
        const date = lightbox.querySelector('.lightbox-date');
        const tagsContainer = lightbox.querySelector('.lightbox-tags');
        const description = lightbox.querySelector('.lightbox-description');
        const prevBtn = lightbox.querySelector('.lightbox-prev');
        const nextBtn = lightbox.querySelector('.lightbox-next');
        const zoomHint = lightbox.querySelector('.lightbox-zoom-hint');

        if (this.images.length === 0) return;

        const currentImage = this.images[this.currentIndex];

        // パンとズームをリセット
        this.panX = 0;
        this.panY = 0;
        this.isZoomed = false;
        image.style.transform = '';
        image.style.cursor = 'zoom-in';

        // ローディング表示
        loading.style.display = 'block';

        if (currentImage.isVideo) {
            // 動画の場合
            image.style.display = 'none';
            video.style.display = 'block';
            video.src = currentImage.videoSrc;
            video.style.maxWidth = '100%';
            video.style.maxHeight = '100%';
            video.style.objectFit = 'contain';
            loading.style.display = 'none';
            zoomHint.style.display = 'none';
        } else {
            // 画像の場合
            video.style.display = 'none';
            image.style.display = 'block';
            image.style.opacity = '0';
            zoomHint.style.display = 'block';

            // 画像を読み込む
            const img = new Image();
            img.onload = () => {
                image.src = currentImage.src;
                image.alt = currentImage.title;
                image.classList.remove('zoomed');
                image.style.opacity = '1';
                loading.style.display = 'none';
            };
            img.src = currentImage.src;
        }

        // タイトル
        title.textContent = currentImage.title;

        // カテゴリと日付
        category.textContent = currentImage.category;
        date.textContent = currentImage.date;

        // タグ
        tagsContainer.innerHTML = '';
        if (currentImage.tags && currentImage.tags.length > 0) {
            currentImage.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tag';
                tagElement.textContent = tag;
                tagsContainer.appendChild(tagElement);
            });
        }

        // 説明
        if (currentImage.description) {
            description.textContent = currentImage.description;
            description.style.display = 'block';
        } else {
            description.style.display = 'none';
        }

        // ナビゲーションボタンの状態
        if (this.currentIndex === 0) {
            prevBtn.classList.add('disabled');
        } else {
            prevBtn.classList.remove('disabled');
        }

        if (this.currentIndex === this.images.length - 1) {
            nextBtn.classList.add('disabled');
        } else {
            nextBtn.classList.remove('disabled');
        }
    }
}

// ページ読み込み時にライトボックスを初期化
document.addEventListener('DOMContentLoaded', () => {
    new Lightbox();
});
