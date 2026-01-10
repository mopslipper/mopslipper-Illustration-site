"""GitHub Pages用のパス修正スクリプト"""
import json
from pathlib import Path

# 1. config.jsonにbase_pathを追加
print("📝 config.jsonを更新中...")
config_path = Path("data/config.json")
with open(config_path, "r", encoding="utf-8") as f:
    config = json.load(f)

config["base_path"] = "/mopslipper-Illustration-site"

with open(config_path, "w", encoding="utf-8") as f:
    json.dump(config, f, ensure_ascii=False, indent=2)
print("✅ config.json updated")

# 2. generator.pyにbase_pathを渡す処理を追加
print("\n📝 generator.pyを更新中...")
gen_path = Path("generator.py")
gen_content = gen_path.read_text(encoding="utf-8")

# Jinja2グローバル変数にbase_pathを追加
if "self.env.globals['base_path']" not in gen_content:
    old_line = "        self.env.globals['now'] = datetime.now()"
    new_line = """        self.env.globals['now'] = datetime.now()
        self.env.globals['base_path'] = self.config.get('base_path', '')"""
    
    gen_content = gen_content.replace(old_line, new_line)
    
    # load_dataの後にbase_pathを設定
    old_load = """        with open(self.data_dir / "config.json", "r", encoding="utf-8") as f:
            self.config = json.load(f)"""
    new_load = """        with open(self.data_dir / "config.json", "r", encoding="utf-8") as f:
            self.config = json.load(f)
        
        # Jinja2にbase_pathを渡す
        self.env.globals['base_path'] = self.config.get('base_path', '')"""
    
    gen_content = gen_content.replace(old_load, new_load)
    
    gen_path.write_text(gen_content, encoding="utf-8")
    print("✅ generator.py updated")
else:
    print("✅ generator.py already has base_path")

# 3. テンプレートファイルのパスを修正
print("\n📝 テンプレートを更新中...")
template_dir = Path("templates")

# 修正するパターン
replacements = [
    ('href="/', 'href="{{ base_path }}/'),
    ('src="/', 'src="{{ base_path }}/'),
    ('action="/', 'action="{{ base_path }}/'),
    ('url(/', 'url({{ base_path }}/'),
    ("href='/", "href='{{ base_path }}/"),
    ("src='/", "src='{{ base_path }}/"),
]

for template_file in template_dir.glob("*.html"):
    content = template_file.read_text(encoding="utf-8")
    original = content
    
    for old, new in replacements:
        # 既に{{ base_path }}が含まれている場合はスキップ
        if old in content and "{{ base_path }}" not in content.replace(old, new):
            content = content.replace(old, new)
    
    if content != original:
        template_file.write_text(content, encoding="utf-8")
        print(f"  ✅ {template_file.name}")

print("\n✨ 全ての修正が完了しました！")
print("\n次のコマンドを実行してください:")
print("  python generator.py")
print("  git add .")
print('  git commit -m "Fix: パスをGitHub Pages対応に修正"')
print("  git push")
