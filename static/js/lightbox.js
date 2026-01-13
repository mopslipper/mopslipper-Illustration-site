// ===================================
// 繝ｩ繧､繝医・繝・け繧ｹ讖溯・
// 逕ｻ蜒上・蜈ｨ逕ｻ髱｢陦ｨ遉ｺ縲√ぜ繝ｼ繝縲√リ繝薙ご繝ｼ繧ｷ繝ｧ繝ｳ
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
        // 繝ｩ繧､繝医・繝・け繧ｹHTML繧剃ｽ懈・
        this.createLightboxHTML();
        
        // 繧､繝吶Φ繝医Μ繧ｹ繝翫・繧定ｨｭ螳・
        this.setupEventListeners();
        
        // 繧ｮ繝｣繝ｩ繝ｪ繝ｼ縺ｮ逕ｻ蜒上ｒ繧ｯ繝ｪ繝・け蜿ｯ閭ｽ縺ｫ縺吶ｋ
        this.setupGalleryImages();
    }

    createLightboxHTML() {
        const lightboxHTML = `
            <div id="lightbox" class="lightbox">
                <div class="lightbox-content">
                    <button class="lightbox-close" aria-label="髢峨§繧・>ﾃ・/button>
                    
                    <button class="lightbox-nav lightbox-prev" aria-label="蜑阪・逕ｻ蜒・>
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
                        <div class="lightbox-zoom-hint">繧ｯ繝ｪ繝・け縺ｧ繧ｺ繝ｼ繝</div>
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
                            <div class="lightbox-thumbnails"></div>
                        </div>
                    </div>
                    
                    <button class="lightbox-nav lightbox-next" aria-label="谺｡縺ｮ逕ｻ蜒・>
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

        // 髢峨§繧九・繧ｿ繝ｳ
        closeBtn.addEventListener('click', () => this.close());

        // 閭梧勹繧ｯ繝ｪ繝・け縺ｧ髢峨§繧・
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
                this.close();
            }
        });

        // 繝翫ン繧ｲ繝ｼ繧ｷ繝ｧ繝ｳ繝懊ち繝ｳ
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.prev();
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.next();
        });

        // 逕ｻ蜒上け繝ｪ繝・け縺ｧ繧ｺ繝ｼ繝・亥虚逕ｻ縺ｮ蝣ｴ蜷医・辟｡蜉ｹ・・
        image.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentImage = this.images[this.currentIndex];
            if (currentImage && !currentImage.isVideo) {
                this.toggleZoom();
            }
        });

        // 繧ｺ繝ｼ繝譎ゅ・繝峨Λ繝・げ謫堺ｽ・
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

        // 繧ｭ繝ｼ繝懊・繝画桃菴・
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

        // 繧ｺ繝ｼ繝繝偵Φ繝医・陦ｨ遉ｺ
        image.addEventListener('mouseenter', () => {
            const hint = lightbox.querySelector('.lightbox-zoom-hint');
            hint.classList.add('show');
            setTimeout(() => hint.classList.remove('show'), 2000);
        });
    }

    setupGalleryImages() {
        // イベントデリゲーションを使用して、動的に生成される要素にも対応
        document.addEventListener('click', (e) => {
            // data-lightbox-trigger属性を持つリンクがクリックされた場合
            const link = e.target.closest('.work-link[data-lightbox-trigger]');
            if (link) {
                e.preventDefault();
                e.stopPropagation();
                
                // クリックされたwork-cardを取得
                const card = link.closest('.work-card');
                if (card) {
                    const title = card.querySelector('.work-title')?.textContent || '';
                    
                    this.collectImages();
                    const imageIndex = this.images.findIndex(imgData => imgData.title === title);
                    if (imageIndex !== -1) {
                        this.open(imageIndex);
                    }
                }
            }
        }, true);
        // 菴懷刀隧ｳ邏ｰ繝壹・繧ｸ縺ｮ逕ｻ蜒上→繧ｵ繝繝阪う繝ｫ縺ｮ繧ｯ繝ｪ繝・け繧､繝吶Φ繝・
        const workDetailImage = document.querySelector('.work-detail-image img');
        const galleryThumbnails = document.querySelectorAll('.additional-images .thumbnail');
        
        if (workDetailImage && !workDetailImage.src.includes('.mp4')) {
            // 繝｡繧､繝ｳ逕ｻ蜒上・繧ｯ繝ｪ繝・け
            workDetailImage.style.cursor = 'pointer';
            workDetailImage.addEventListener('click', () => {
                this.images = []; // 逕ｻ蜒城・蛻励ｒ繝ｪ繧ｻ繝・ヨ
                this.collectImages();
                this.open(0);
            });
            
            // 繧ｵ繝繝阪う繝ｫ縺ｮ繧ｯ繝ｪ繝・け
            galleryThumbnails.forEach((thumb, index) => {
                thumb.style.cursor = 'pointer';
                thumb.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.images = []; // 逕ｻ蜒城・蛻励ｒ繝ｪ繧ｻ繝・ヨ
                    this.collectImages();
                    this.open(index);
                    
                    // 繧｢繧ｯ繝・ぅ繝悶↑繧ｵ繝繝阪う繝ｫ繧呈峩譁ｰ
                    galleryThumbnails.forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                    
                    // 繝｡繧､繝ｳ逕ｻ蜒上ｂ譖ｴ譁ｰ
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
        
        // 繧ｮ繝｣繝ｩ繝ｪ繝ｼ繝壹・繧ｸ縺九ｉ蜿朱寔
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
                    // 蜍慕判菴懷刀
                    this.images.push({
                        src: img.src, // 繧ｵ繝繝阪う繝ｫ
                        videoSrc: videoPath,
                        isVideo: true,
                        title: title,
                        date: date,
                        category: category,
                        tags: tags,
                        description: description
                    });
                } else {
                    // 髱呎ｭ｢逕ｻ菴懷刀・医し繝繝阪う繝ｫ縺ｮ莉｣繧上ｊ縺ｫ蜈・判蜒上ｒ菴ｿ逕ｨ・・
                    const imageSrc = img.src;
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

        // 菴懷刀隧ｳ邏ｰ繝壹・繧ｸ縺ｮ蝣ｴ蜷・
        const workDetailImage = document.querySelector('.work-detail-image img');
        if (workDetailImage && this.images.length === 0) {
            const title = document.querySelector('.work-detail-title')?.textContent || '';
            const date = document.querySelector('.work-detail-date')?.textContent || '';
            const category = document.querySelector('.work-detail-category')?.textContent || '';
            const description = document.querySelector('.work-detail-description')?.textContent || '';
            const tagsElements = document.querySelectorAll('.work-detail-tags .tag');
            const tags = Array.from(tagsElements).map(tag => tag.textContent);
            
            // additional_images縺後≠繧句ｴ蜷医・蜈ｨ繧ｵ繝繝阪う繝ｫ縺九ｉ蜿朱寔
            const additionalThumbnails = document.querySelectorAll('.additional-images .thumbnail');
            if (additionalThumbnails.length > 0) {
                // 繧ｵ繝繝阪う繝ｫ縺九ｉ蜈ｨ逕ｻ蜒上ｒ蜿朱寔・医Γ繧､繝ｳ逕ｻ蜒・霑ｽ蜉逕ｻ蜒擾ｼ・
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
                // 繧ｵ繝繝阪う繝ｫ縺後↑縺・ｴ蜷医・繝｡繧､繝ｳ逕ｻ蜒上・縺ｿ
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

        // 繝代Φ縺ｨ繧ｺ繝ｼ繝繧偵Μ繧ｻ繝・ヨ
        this.panX = 0;
        this.panY = 0;
        this.isZoomed = false;
        image.style.transform = '';
        image.style.cursor = 'zoom-in';

        // 繝ｭ繝ｼ繝・ぅ繝ｳ繧ｰ陦ｨ遉ｺ
        loading.style.display = 'block';

        if (currentImage.isVideo) {
            // 蜍慕判縺ｮ蝣ｴ蜷・
            image.style.display = 'none';
            video.style.display = 'block';
            video.src = currentImage.videoSrc;
            video.style.maxWidth = '100%';
            video.style.maxHeight = '100%';
            video.style.objectFit = 'contain';
            loading.style.display = 'none';
            zoomHint.style.display = 'none';
        } else {
            // 逕ｻ蜒上・蝣ｴ蜷・
            video.style.display = 'none';
            image.style.display = 'block';
            image.style.opacity = '0';
            zoomHint.style.display = 'block';

            // 逕ｻ蜒上ｒ隱ｭ縺ｿ霎ｼ繧
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

        // 繧ｿ繧､繝医Ν
        title.textContent = currentImage.title;

        // 繧ｫ繝・ざ繝ｪ縺ｨ譌･莉・
        category.textContent = currentImage.category;
        date.textContent = currentImage.date;

        // 繧ｿ繧ｰ
        tagsContainer.innerHTML = '';
        if (currentImage.tags && currentImage.tags.length > 0) {
            currentImage.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tag';
                tagElement.textContent = tag;
                tagsContainer.appendChild(tagElement);
            });
        }

        // 隱ｬ譏・
        if (currentImage.description) {
            description.textContent = currentImage.description;
            description.style.display = 'block';
        } else {
            description.style.display = 'none';
        }

        // 繧ｵ繝繝阪う繝ｫ陦ｨ遉ｺ・郁､・焚逕ｻ蜒上′縺ゅｋ蝣ｴ蜷茨ｼ・
        const thumbnailsContainer = lightbox.querySelector('.lightbox-thumbnails');
        thumbnailsContainer.innerHTML = '';
        if (this.images.length > 1) {
            thumbnailsContainer.style.display = 'block';
            this.images.forEach((img, index) => {
                if (true) {
                    const thumbDiv = document.createElement('div');
                    thumbDiv.className = 'lightbox-thumbnail';
                    if (index === this.currentIndex) {
                        thumbDiv.classList.add('active');
                    }
                    
                    const thumbImg = document.createElement('img');
                    thumbImg.src = img.src;
                    thumbImg.alt = `${img.title} - 逕ｻ蜒・{index + 1}`;
                    
                    thumbDiv.appendChild(thumbImg);
                    thumbDiv.addEventListener('click', () => {
                        this.currentIndex = index;
                        this.showImage();
                    });
                    
                    thumbnailsContainer.appendChild(thumbDiv);
                }
            });
        } else {
            thumbnailsContainer.style.display = 'none';
        }

        // 繝翫ン繧ｲ繝ｼ繧ｷ繝ｧ繝ｳ繝懊ち繝ｳ縺ｮ迥ｶ諷・
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

// 繝壹・繧ｸ隱ｭ縺ｿ霎ｼ縺ｿ譎ゅ↓繝ｩ繧､繝医・繝・け繧ｹ繧貞・譛溷喧
document.addEventListener('DOMContentLoaded', () => {
    new Lightbox();
});
