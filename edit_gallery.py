import sys

# UTF-8でファイルを読み込む
with open('static/js/gallery.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. setSearchQuery関数にスクロール機能を追加
old_setSearchQuery = '''    window.setSearchQuery = function(query) {
        searchQuery = query.toLowerCase();
        applyFilters();
    };'''

new_setSearchQuery = '''    window.setSearchQuery = function(query) {
        searchQuery = query.toLowerCase();
        applyFilters();
        scrollToGalleryTop();
    };'''

content = content.replace(old_setSearchQuery, new_setSearchQuery)

# 2. タグクリック時のscrollIntoViewをscrollToGalleryTop()に変更
old_tagClick = '''                searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });'''
new_tagClick = '''                scrollToGalleryTop();'''

content = content.replace(old_tagClick, new_tagClick)

# 3. scrollToGalleryTop関数を追加（scrollToTop関数の直後に）
old_scrollToTop = '''    function scrollToTop() {
        const galleryMain = document.querySelector('.gallery-main');
        if (galleryMain) {
            galleryMain.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }'''

new_scrollToTop = '''    function scrollToTop() {
        const galleryMain = document.querySelector('.gallery-main');
        if (galleryMain) {
            galleryMain.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function scrollToGalleryTop() {
        const galleryMain = document.querySelector('.gallery-main');
        if (galleryMain) {
            galleryMain.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }'''

content = content.replace(old_scrollToTop, new_scrollToTop)

# UTF-8でファイルに書き込む
with open('static/js/gallery.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('gallery.jsを更新しました')
print('- setSearchQuery関数にscrollToGalleryTop()を追加')
print('- タグクリック時のスクロールをscrollToGalleryTop()に変更')
print('- scrollToGalleryTop()関数を追加')
