"""works.jsonのJSONエラーを修正"""

with open('data/works.json', 'r', encoding='utf-8') as f:
    content = f.read()

# 問題箇所: external_linksの閉じ括弧の位置を修正
# 誤: "external_links": {\n      "pixiv": "..."\n  },
# 正: "external_links": {\n      "pixiv": "..."\n    }\n  },

old_pattern = '''    "external_links": {
      "pixiv": "https://www.pixiv.net/artworks/139755634"
  },'''

new_pattern = '''    "external_links": {
      "pixiv": "https://www.pixiv.net/artworks/139755634"
    }
  },'''

content = content.replace(old_pattern, new_pattern)

# 保存
with open('data/works.json', 'w', encoding='utf-8') as f:
    f.write(content)

# JSON構文チェック
import json
try:
    with open('data/works.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f'✅ works.jsonを修正しました（作品数: {len(data)}件）')
except json.JSONDecodeError as e:
    print(f'❌ まだJSONエラーがあります: {e}')
