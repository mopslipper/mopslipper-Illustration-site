from PIL import Image
import os

# 画像を読み込み
img_path = "static/img/helo-angel-asp1134-2016.webp"
img = Image.open(img_path)

# 元のファイルサイズ
original_size = os.path.getsize(img_path) / 1024 / 1024
print(f"元のサイズ: {img.size[0]}x{img.size[1]} - {original_size:.2f} MB")

# 品質87%で再保存 (85-90%の範囲)
img.save(img_path, 'WebP', quality=87, method=6)

# 圧縮後のファイルサイズ
new_size = os.path.getsize(img_path) / 1024 / 1024
print(f"圧縮後: {new_size:.2f} MB")
print(f"削減率: {((original_size - new_size) / original_size * 100):.1f}%")
