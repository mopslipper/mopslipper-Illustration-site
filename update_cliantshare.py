"""
cliantshare.htmlに画像復号化機能を追加するスクリプト
"""
from pathlib import Path

# ファイル読み込み
template_path = Path('templates/cliantshare.html')
content = template_path.read_text(encoding='utf-8')

# 画像読み込み関数を復号化対応に変更
old_load_function = """    // 画像読み込み
    function loadImage(index) {
        if (index < 0 || index >= TOTAL_IMAGES) return;
        
        currentIndex = index;
        const imageUrl = `${IMAGE_DIR}${String(index + 1).padStart(2, '0')}.png`;
        
        mainImage.src = imageUrl;
        updateUI();
    }"""

new_load_function = """    // XOR復号化関数
    function xorDecrypt(data, key) {
        const keyBytes = new TextEncoder().encode(key);
        const decrypted = new Uint8Array(data.length);
        
        for (let i = 0; i < data.length; i++) {
            decrypted[i] = data[i] ^ keyBytes[i % keyBytes.length];
        }
        
        return decrypted;
    }
    
    // 暗号化画像を復号化して読み込み
    async function loadImage(index) {
        if (index < 0 || index >= TOTAL_IMAGES) return;
        
        currentIndex = index;
        const imageUrl = `${IMAGE_DIR}${String(index + 1).padStart(2, '0')}.enc`;
        
        try {
            // 暗号化されたファイルをfetch
            const response = await fetch(imageUrl);
            const encryptedData = await response.arrayBuffer();
            
            // パスワードで復号化
            const decryptedData = xorDecrypt(new Uint8Array(encryptedData), PASSWORD);
            
            // Blobとして画像を表示
            const blob = new Blob([decryptedData], { type: 'image/png' });
            const objectUrl = URL.createObjectURL(blob);
            
            // 前のURLをクリーンアップ
            if (mainImage.src.startsWith('blob:')) {
                URL.revokeObjectURL(mainImage.src);
            }
            
            mainImage.src = objectUrl;
            updateUI();
        } catch (error) {
            console.error('画像の読み込みに失敗:', error);
            mainImage.alt = '画像の読み込みに失敗しました';
        }
    }"""

# サムネイル読み込みも更新
old_thumbnail_code = """        thumbnails.forEach((thumb, i) => {
            const img = document.createElement('img');
            img.src = `${IMAGE_DIR}${String(i + 1).padStart(2, '0')}.png`;"""

new_thumbnail_code = """        thumbnails.forEach(async (thumb, i) => {
            const img = document.createElement('img');
            
            // サムネイルも復号化して表示
            try {
                const imageUrl = `${IMAGE_DIR}${String(i + 1).padStart(2, '0')}.enc`;
                const response = await fetch(imageUrl);
                const encryptedData = await response.arrayBuffer();
                const decryptedData = xorDecrypt(new Uint8Array(encryptedData), PASSWORD);
                const blob = new Blob([decryptedData], { type: 'image/png' });
                img.src = URL.createObjectURL(blob);
            } catch (error) {
                console.error(`サムネイル${i+1}の読み込みに失敗:`, error);
            }"""

# ダウンロード関数も更新
old_download = """    // 画像ダウンロード
    function downloadCurrentImage() {
        const imageUrl = `${IMAGE_DIR}${String(currentIndex + 1).padStart(2, '0')}.png`;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `image_${String(currentIndex + 1).padStart(2, '0')}.png`;
        link.click();
    }"""

new_download = """    // 画像ダウンロード（復号化済み）
    async function downloadCurrentImage() {
        const imageUrl = `${IMAGE_DIR}${String(currentIndex + 1).padStart(2, '0')}.enc`;
        
        try {
            const response = await fetch(imageUrl);
            const encryptedData = await response.arrayBuffer();
            const decryptedData = xorDecrypt(new Uint8Array(encryptedData), PASSWORD);
            const blob = new Blob([decryptedData], { type: 'image/png' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `image_${String(currentIndex + 1).padStart(2, '0')}.png`;
            link.click();
            
            // クリーンアップ
            setTimeout(() => URL.revokeObjectURL(link.href), 100);
        } catch (error) {
            console.error('ダウンロードに失敗:', error);
            alert('ダウンロードに失敗しました');
        }
    }"""

# 一括ダウンロードも更新
old_bulk_download = """    // 一括ダウンロード
    async function downloadAllImages() {
        if (!confirm(`${TOTAL_IMAGES}枚の画像をダウンロードしますか？`)) {
            return;
        }
        
        progressBar.style.display = 'block';
        downloadAllBtn.disabled = true;
        
        for (let i = 0; i < TOTAL_IMAGES; i++) {
            const imageUrl = `${IMAGE_DIR}${String(i + 1).padStart(2, '0')}.png`;
            
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = `image_${String(i + 1).padStart(2, '0')}.png`;
            link.click();
            
            // 進捗更新
            const progress = ((i + 1) / TOTAL_IMAGES) * 100;
            progressBar.value = progress;
            progressText.textContent = `${i + 1} / ${TOTAL_IMAGES}`;
            
            // 間隔を空ける
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        progressBar.style.display = 'none';
        downloadAllBtn.disabled = false;
        alert('ダウンロード完了！');
    }"""

new_bulk_download = """    // 一括ダウンロード（復号化済み）
    async function downloadAllImages() {
        if (!confirm(`${TOTAL_IMAGES}枚の画像をダウンロードしますか？`)) {
            return;
        }
        
        progressBar.style.display = 'block';
        downloadAllBtn.disabled = true;
        
        for (let i = 0; i < TOTAL_IMAGES; i++) {
            try {
                const imageUrl = `${IMAGE_DIR}${String(i + 1).padStart(2, '0')}.enc`;
                const response = await fetch(imageUrl);
                const encryptedData = await response.arrayBuffer();
                const decryptedData = xorDecrypt(new Uint8Array(encryptedData), PASSWORD);
                const blob = new Blob([decryptedData], { type: 'image/png' });
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `image_${String(i + 1).padStart(2, '0')}.png`;
                link.click();
                
                // クリーンアップ
                setTimeout(() => URL.revokeObjectURL(link.href), 100);
            } catch (error) {
                console.error(`画像${i+1}のダウンロードに失敗:`, error);
            }
            
            // 進捗更新
            const progress = ((i + 1) / TOTAL_IMAGES) * 100;
            progressBar.value = progress;
            progressText.textContent = `${i + 1} / ${TOTAL_IMAGES}`;
            
            // 間隔を空ける
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        progressBar.style.display = 'none';
        downloadAllBtn.disabled = false;
        alert('ダウンロード完了！');
    }"""

# 置換実行
content = content.replace(old_load_function, new_load_function)
content = content.replace(old_thumbnail_code, new_thumbnail_code)
content = content.replace(old_download, new_download)
content = content.replace(old_bulk_download, new_bulk_download)

# 保存
template_path.write_text(content, encoding='utf-8')

print("✅ cliantshare.htmlに画像復号化機能を追加しました")
