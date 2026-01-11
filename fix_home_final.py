#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('templates/home_backup.html', 'r', encoding='utf-8') as f:
    content = f.read()

# BOMを削除
if content.startswith('\ufeff'):
    content = content[1:]

# 文字化け修正マップ
fixes = {
    '隨ｨ繝ｻ': '●',
    '陷ｿ蠍ｺ・ｻ蛟・ｽｸ・ｭ': '受付中',
    '陋帶㊧・ｭ・｢闕ｳ・ｭ': '締切中',
    '關捺辨・ｰ・ｼ霑･・ｶ雎輔・': '依頼状況',
    '髫ｧ・ｳ驍擾ｽｰ郢ｧ螳夲ｽｦ荵晢ｽ・遶翫・': '詳細を見る →',
    '邨ｱ險域ュ蝣ｱ': '統計情報',
    '邱丈ｽ懷刀謨ｰ': '総作品数',
    '邱城夢隕ｧ謨ｰ': '総閲覧数',
    '邱上＞縺・・謨ｰ': '総いいね数',
    '繧ｫ繝・ざ繝ｪ謨ｰ': 'カテゴリ数',
    '邵ｺ蜷ｶ竏狗ｸｺ・ｦ髫穂ｹ晢ｽ・遶翫・': 'すべて見る →',
    '闖ｴ諛ｷ蛻郢ｧ螳夲ｽｦ荵晢ｽ・': '作品を見る',
    '繧ｰ繝・ぜ繝ｻ邏譚占ｲｩ螢ｲ': 'グッズ・関連商品',
    '隰ｾ・ｯ隰・ｴ郢晢ｽｻ鬮ｯ莉呻ｽｮ螢ｻ・ｽ諛ｷ蛻': '支援・限定作品',
}

for old, new in fixes.items():
    content = content.replace(old, new)

# 統計ダッシュボードセクションを正しく追加
stats_section = """<!-- Statistics Dashboard -->
<section class="section stats-dashboard-section">
    <div class="container">
        <h2 class="section-title">統計情報</h2>
        <div class="stats-grid" id="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-value" id="total-works">0</div>
                <div class="stat-label">総作品数</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">👁️</div>
                <div class="stat-value" id="total-views">0</div>
                <div class="stat-label">総閲覧数</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">❤️</div>
                <div class="stat-value" id="total-likes">0</div>
                <div class="stat-label">総いいね数</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📁</div>
                <div class="stat-value" id="total-categories">0</div>
                <div class="stat-label">カテゴリ数</div>
            </div>
        </div>
    </div>
</section>

"""

# 統計セクションを挿入（既存の統計セクションがあれば置換、なければ追加）
import re
if '<!-- Statistics Dashboard -->' in content:
    # 既存の統計セクションを置換
    pattern = r'<!-- Statistics Dashboard -->.*?</section>\s*(?=<!-- Recent Works -->)'
    content = re.sub(pattern, stats_section, content, flags=re.DOTALL)
else:
    # Recent Works の前に挿入
    content = content.replace('<!-- Recent Works -->', stats_section + '<!-- Recent Works -->')

# extra_jsブロックを追加（なければ）
if '{% block extra_js %}' not in content:
    content = content.replace('{% endblock %}', '{% endblock %}\n\n{% block extra_js %}\n<script src="{{ base_path }}/static/js/stats.js"></script>\n{% endblock %}')

with open('templates/home.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed and saved!')
