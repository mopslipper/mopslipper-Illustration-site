"""GitHub Pages用のテンプレートパス修正"""
from pathlib import Path
import re

template_dir = Path("templates")

for template_file in template_dir.glob("*.html"):
    print(f"Processing {template_file.name}...")
    content = template_file.read_text(encoding="utf-8")
    
    # パターン1: href="/..." (但し、外部URLは除外)
    content = re.sub(
        r'href="/(static|gallery|commission|about|contact|privacy|works)([^"]*)"',
        r'href="{{ base_path }}/\1\2"',
        content
    )
    
    # パターン2: src="/static/..."
    content = re.sub(
        r'src="/static/',
        r'src="{{ base_path }}/static/',
        content
    )
    
    # パターン3: href="/" (ルートリンク)
    content = re.sub(
        r'href="/"(?!>)',
        r'href="{{ base_path }}/"',
        content
    )
    
    # パターン4: action="/..." (フォーム)
    content = re.sub(
        r'action="/',
        r'action="{{ base_path }}/',
        content
    )
    
    template_file.write_text(content, encoding="utf-8")
    print(f"  ✅ Updated")

print("\n✨ 全てのテンプレートを修正しました！")
