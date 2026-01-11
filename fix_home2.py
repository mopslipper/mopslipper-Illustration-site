#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('templates/home.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 文字化けを修正 (実際のバイトシーケンスを使用)
fixes = [
    ('<span class="status-icon">●</span> 受付中', '<span class="status-icon">●</span> 受付中'),
    ('<span class="status-icon">●</span> 締切中', '<span class="status-icon">●</span> 締切中'),
    ('<h3>依頼状況</h3>', '<h3>依頼状況</h3>'),
    ('詳細を見る →', '詳細を見る →'),
    ('すべて見る →', 'すべて見る →'),
    ('<p>作品を見る</p>', '<p>作品を見る</p>'),
    ('<p>グッズ・関連商品</p>', '<p>グッズ・関連商品</p>'),
    ('<p>支援・限定作品</p>', '<p>支援・限定作品</p>'),
]

# 文字化けパターンを置換
import codecs
content_bytes = content.encode('utf-8', errors='ignore')
content = content_bytes.decode('utf-8')

# 具体的な文字化けパターンを置換
content = content.replace('笨●', '●')
content = content.replace('蜿嶺ｻ倅ｸｭ', '受付中')
content = content.replace('蛛懈ｭ｢荳ｭ', '締切中')
content = content.replace('萓晞ｼ迥ｶ豕', '依頼状況')
content = content.replace('隧ｳ邏ｰ繧定ｦ九ｋ', '詳細を見る')
content = content.replace('縺吶∋縺ｦ隕九ｋ', 'すべて見る')
content = content.replace('菴懷刀繧定ｦ九ｋ', '作品を見る')
content = content.replace('繧ｰ繝・ぜ繝ｻ邏譚占ｲｩ螢ｲ', 'グッズ・関連商品')
content = content.replace('謾ｯ謠ｴ繝ｻ髯仙ｮ壻ｽ懷刀', '支援・限定作品')

with open('templates/home.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed!')
