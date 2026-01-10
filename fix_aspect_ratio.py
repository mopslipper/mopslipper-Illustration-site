"""CSSのアスペクト比を修正"""

with open('static/css/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

# ギャラリーの.work-imageを修正（aspect-ratioを削除）
old_work_image = """.work-image {
    position: relative;
    aspect-ratio: 3/4;
    overflow: hidden;
    background: var(--bg-tertiary);
}"""

new_work_image = """.work-image {
    position: relative;
    overflow: hidden;
    background: var(--bg-tertiary);
}"""

content = content.replace(old_work_image, new_work_image)

# .work-image imgをcontainに変更
old_work_image_img = """.work-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: var(--transition);
}"""

new_work_image_img = """.work-image img {
    width: 100%;
    height: auto;
    object-fit: contain;
    transition: var(--transition);
    display: block;
}"""

content = content.replace(old_work_image_img, new_work_image_img)

# 保存
with open('static/css/style.css', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ アスペクト比を保持するようにCSSを修正しました')
