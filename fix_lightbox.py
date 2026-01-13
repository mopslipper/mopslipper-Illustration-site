# lightbox.jsを修正するスクリプト
import re

# ファイルを読み込む
with open('static/js/lightbox.js', 'r', encoding='utf-8') as f:
    content = f.read()

# setupGalleryImagesメソッドを正しいコードに置換
old_pattern = r'(setupGalleryImages\(\) \{[\s\S]*?)(if \(img && !link\.href\.includes.*?\}\s*\}\);[\s\S]*?\}\s*\}\);)'

new_code = '''setupGalleryImages() {
        // ギャラリーページの画像
        const workCards = document.querySelectorAll('.work-card');
        workCards.forEach((card, index) => {
            const img = card.querySelector('.work-image img');
            const link = card.querySelector('.work-link');
            const title = card.querySelector('.work-title')?.textContent || '';

            // data-lightbox-trigger属性がある場合のみライトボックスを有効化
            if (link && link.hasAttribute('data-lightbox-trigger')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.collectImages();
                    const imageIndex = this.images.findIndex(imgData => imgData.title === title);
                    if (imageIndex !== -1) {
                        this.open(imageIndex);
                    }
                });
            }
        });'''

# 置換を実行
pattern = r'setupGalleryImages\(\) \{[^}]*?const workCards = document\.querySelectorAll\(\'\.work-card\'\);[^}]*?workCards\.forEach\([^}]*?\{[^}]*?const img[^}]*?const link[^}]*?const title[^}]*?if \([^}]*?\{[^}]*?\}[^}]*?\}[^}]*?\}\);'

content = re.sub(pattern, new_code, content, flags=re.DOTALL)

# ファイルに書き込む
with open('static/js/lightbox.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("lightbox.jsを修正しました")
