"""
画像を簡単な暗号化で難読化するスクリプト
パスワードをキーとしてXOR暗号化を行う
"""
import os
from pathlib import Path

def xor_encrypt_file(input_path, output_path, key):
    """ファイルをXOR暗号化"""
    with open(input_path, 'rb') as f:
        data = f.read()
    
    # キーを繰り返し使用
    key_bytes = key.encode('utf-8')
    encrypted = bytearray()
    
    for i, byte in enumerate(data):
        encrypted.append(byte ^ key_bytes[i % len(key_bytes)])
    
    with open(output_path, 'wb') as f:
        f.write(encrypted)

def main():
    # パスワード（cliantshare.htmlと同じ）
    PASSWORD = 'Viskorin_temp'
    
    # ディレクトリパス
    source_dir = Path('static/img/cliantshare')
    encrypted_dir = Path('static/img/cliantshare_encrypted')
    
    # 暗号化ディレクトリ作成
    encrypted_dir.mkdir(exist_ok=True)
    
    # すべてのPNGファイルを暗号化
    png_files = sorted(source_dir.glob('*.png'))
    
    print(f"🔒 画像を暗号化中...")
    
    for png_file in png_files:
        encrypted_path = encrypted_dir / f"{png_file.stem}.enc"
        xor_encrypt_file(png_file, encrypted_path, PASSWORD)
        print(f"  ✓ {png_file.name} → {encrypted_path.name}")
    
    print(f"\n✨ {len(png_files)}個のファイルを暗号化しました")
    print(f"📁 出力先: {encrypted_dir.absolute()}")
    print(f"\n⚠️  元のcliantshareフォルダを.gitignoreに追加することを推奨")

if __name__ == '__main__':
    main()
