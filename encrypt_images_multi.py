"""
複数ディレクトリ対応の画像暗号化スクリプト
各ディレクトリ内のPNG画像をXOR暗号化して.encファイルとして保存
"""

from pathlib import Path

# パスワード
PASSWORD = 'Viskorin_temp'

def xor_encrypt(data, password):
    """XOR暗号化"""
    key_bytes = password.encode('utf-8')
    encrypted = bytearray()
    
    for i, byte in enumerate(data):
        encrypted.append(byte ^ key_bytes[i % len(key_bytes)])
    
    return bytes(encrypted)

def encrypt_directory(source_dir, output_dir):
    """ディレクトリ内の全PNG画像を暗号化"""
    source_path = Path(source_dir)
    output_path = Path(output_dir)
    
    if not source_path.exists():
        print(f"❌ ソースディレクトリが見つかりません: {source_dir}")
        return 0
    
    # 出力ディレクトリ作成
    output_path.mkdir(parents=True, exist_ok=True)
    
    # PNG画像を取得してソート
    png_files = sorted(source_path.glob("*.png"), key=lambda x: x.stem)
    
    if not png_files:
        print(f"⚠️ PNG画像が見つかりません: {source_dir}")
        return 0
    
    encrypted_count = 0
    for png_file in png_files:
        # 画像を読み込み
        with open(png_file, 'rb') as f:
            image_data = f.read()
        
        # 暗号化
        encrypted_data = xor_encrypt(image_data, PASSWORD)
        
        # .encファイルとして保存
        output_file = output_path / f"{png_file.stem}.enc"
        with open(output_file, 'wb') as f:
            f.write(encrypted_data)
        
        encrypted_count += 1
        print(f"  ✓ {png_file.name} → {output_file.name}")
    
    return encrypted_count

def main():
    """メイン処理"""
    print("\n🔒 画像暗号化スクリプト（複数ディレクトリ対応）\n")
    
    base_source = Path("static/img/cliantshare")
    base_output = Path("static/img/cliantshare_encrypted")
    
    # cliantshare内の全サブディレクトリを取得
    if not base_source.exists():
        print(f"❌ ベースディレクトリが見つかりません: {base_source}")
        return
    
    subdirs = [d for d in base_source.iterdir() if d.is_dir()]
    
    if not subdirs:
        print(f"⚠️ サブディレクトリが見つかりません: {base_source}")
        return
    
    total_encrypted = 0
    
    for subdir in sorted(subdirs):
        dir_name = subdir.name
        print(f"\n📁 ディレクトリ: {dir_name}")
        
        source_dir = base_source / dir_name
        output_dir = base_output / dir_name
        
        count = encrypt_directory(source_dir, output_dir)
        total_encrypted += count
        print(f"   暗号化完了: {count}ファイル")
    
    print(f"\n✨ 全体の暗号化完了: {total_encrypted}ファイル")
    print(f"📁 出力先: {base_output.absolute()}")

if __name__ == "__main__":
    main()
