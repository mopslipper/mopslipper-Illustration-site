"""GitHub Pages用の全パスを一括修正"""
from pathlib import Path
import re

template_dir = Path("templates")

for template_file in template_dir.glob("*.html"):
    print(f"Processing {template_file.name}...")
    content = template_file.read_text(encoding="utf-8")
    original = content
    
    # 1. href="/" を href="{{ base_path }}/" に（既に修正済みは除外）
    content = re.sub(r'href="/"(?![^<]*}})', r'href="{{ base_path }}/"', content)
    
    # 2. src="/static/ を src="{{ base_path }}/static/ に
    if 'src="/static/' in content and 'src="{{ base_path }}/static/' not in content:
        content = content.replace('src="/static/', 'src="{{ base_path }}/static/')
    
    # 3. href="/works/ を href="{{ base_path }}/works/ に
    if 'href="/works/' in content and 'href="{{ base_path }}/works/' not in content:
        content = content.replace('href="/works/', 'href="{{ base_path }}/works/')
    
    # 4. href="/gallery を href="{{ base_path }}/gallery に
    if 'href="/gallery' in content and 'href="{{ base_path }}/gallery' not in content:
        content = content.replace('href="/gallery', 'href="{{ base_path }}/gallery')
    
    # 5. href="/commission を href="{{ base_path }}/commission に
    if 'href="/commission' in content and 'href="{{ base_path }}/commission' not in content:
        content = content.replace('href="/commission', 'href="{{ base_path }}/commission')
    
    # 6. href="/about を href="{{ base_path }}/about に
    if 'href="/about' in content and 'href="{{ base_path }}/about' not in content:
        content = content.replace('href="/about', 'href="{{ base_path }}/about')
    
    # 7. href="/contact を href="{{ base_path }}/contact に
    if 'href="/contact' in content and 'href="{{ base_path }}/contact' not in content:
        content = content.replace('href="/contact', 'href="{{ base_path }}/contact')
    
    # 8. href="/privacy を href="{{ base_path }}/privacy に
    if 'href="/privacy' in content and 'href="{{ base_path }}/privacy' not in content:
        content = content.replace('href="/privacy', 'href="{{ base_path }}/privacy')
    
    # 9. {{ config.hero_image }} を {{ base_path }}{{ config.hero_image }} に
    if '{{ config.hero_image }}' in content and '{{ base_path }}{{ config.hero_image }}' not in content:
        content = content.replace('{{ config.hero_image }}', '{{ base_path }}{{ config.hero_image }}')
    
    # 10. {{ work.thumbnail }} を {{ base_path }}{{ work.thumbnail }} に
    if '{{ work.thumbnail }}' in content and '{{ base_path }}{{ work.thumbnail }}' not in content:
        content = content.replace('{{ work.thumbnail }}', '{{ base_path }}{{ work.thumbnail }}')
    
    # 11. {{ work.image_path }} を {{ base_path }}{{ work.image_path }} に
    if '{{ work.image_path }}' in content and '{{ base_path }}{{ work.image_path }}' not in content:
        content = content.replace('{{ work.image_path }}', '{{ base_path }}{{ work.image_path }}')
    
    if content != original:
        template_file.write_text(content, encoding="utf-8")
        print(f"  ✅ 修正完了")
    else:
        print(f"  ⏭️  変更なし")

print("\n✨ 全てのパス修正が完了しました！")
