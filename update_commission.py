"""commission.jsonの依頼状況を修正"""
import json
from pathlib import Path

# バックアップから復元するか、Gitから取得
import subprocess
result = subprocess.run(['git', 'checkout', 'data/commission.json'], 
                       capture_output=True, text=True, cwd=Path.cwd())

if result.returncode == 0:
    print("✅ Gitから復元しました")
else:
    print("❌ Git復元失敗:", result.stderr)
    exit(1)

# JSONを読み込んで修正
with open('data/commission.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 依頼状況を変更
data['status']['open'] = False
data['status']['message'] = '現在は受け付けておりません'

# 保存
with open('data/commission.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("✅ 依頼状況を「受付停止」に更新しました")
