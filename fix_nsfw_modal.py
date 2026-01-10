"""main.jsの「いいえ」ボタンの動作を修正"""

with open('static/js/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 古いコード
old_code = """            // 外部サイトにリダイレクトまたは警告
            alert('18歳未満の方は閲覧できません。');
            window.location.href = 'https://www.google.com';"""

# 新しいコード
new_code = """            // 18歳未満でも閲覧可能
            localStorage.setItem('ageVerified', 'true');
            modal.style.display = 'none';
            // メッセージを表示
            const message = document.createElement('div');
            message.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#4a90e2;color:white;padding:15px 30px;border-radius:8px;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:16px;';
            message.textContent = '18歳未満でも閲覧できます';
            document.body.appendChild(message);
            setTimeout(() => message.remove(), 3000);"""

# 置換
content = content.replace(old_code, new_code)

# 保存
with open('static/js/main.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ main.jsを修正しました')
