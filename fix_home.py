#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('templates/home.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 文字化けを修正
replacements = {
    '●</span> 受付中': '●</span> 受付中',
    '●</span> 締切中': '●</span> 締切中',
    '<h3>依頼状況</h3>': '<h3>依頼状況</h3>',
    '詳細を見る →</a>': '詳細を見る →</a>',
    'すべて見る →</a>': 'すべて見る →</a>',
    '作品を見る': '作品を見る',
    'グッズ・関連商品': 'グッズ・関連商品',
    '支援・限定作品': '支援・限定作品',
}

for old, new in replacements.items():
    if old in content:
        print(f'Already correct: {old}')
    else:
        print(f'Need to fix')

# 文字化けパターンを検索
import re
broken = re.findall(r'[笨蜿萓隧縺菴繧謾][^<>]{0,30}[刀倅ｭ豕ｒ］ぜ懷]', content)
for b in broken:
    print(f'Found broken text: {repr(b)}')
