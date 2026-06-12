"""限定共有コンテンツ暗号化ツール (MSLENC01 形式)

各サブディレクトリ内の画像を AES-256-GCM で暗号化して .enc として出力する。
サイト側 (site/src/scripts/cliantshare-crypto.ts) と完全互換。

ファイル形式:
    [magic "MSLENC01" 8B][salt 16B][iv 12B][AES-256-GCM ciphertext+tag]
鍵導出: PBKDF2-HMAC-SHA256, 310,000 iterations

使い方:
    # 元画像を cliantshare_source/<案件名>/*.png|jpg|webp に置いて実行
    python tools/encrypt_share.py --source cliantshare_source --output site/public/cliantshare
    # パスワードはプロンプトで入力（ファイルやコードに残さない）
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

MAGIC = b"MSLENC01"
SALT_LENGTH = 16
IV_LENGTH = 12
PBKDF2_ITERATIONS = 310_000
VERIFY_PLAINTEXT = b"MOPSLIPPER_CLIANTSHARE_OK"
VERIFY_FILENAME = "verify.enc"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
    )
    return kdf.derive(password.encode("utf-8"))


def encrypt_bytes(data: bytes, password: str) -> bytes:
    salt = os.urandom(SALT_LENGTH)
    iv = os.urandom(IV_LENGTH)
    key = derive_key(password, salt)
    ciphertext = AESGCM(key).encrypt(iv, data, None)
    return MAGIC + salt + iv + ciphertext


def decrypt_bytes(blob: bytes, password: str) -> bytes:
    """検証用（テストで使用）"""
    if not blob.startswith(MAGIC):
        raise ValueError("不正なファイル形式です")
    offset = len(MAGIC)
    salt = blob[offset : offset + SALT_LENGTH]
    iv = blob[offset + SALT_LENGTH : offset + SALT_LENGTH + IV_LENGTH]
    ciphertext = blob[offset + SALT_LENGTH + IV_LENGTH :]
    key = derive_key(password, salt)
    return AESGCM(key).decrypt(iv, ciphertext, None)


def encrypt_directory(source_dir: Path, output_dir: Path, password: str) -> int:
    output_dir.mkdir(parents=True, exist_ok=True)
    files = sorted(
        p for p in source_dir.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )
    for src in files:
        # 元の拡張子を保持した二重拡張子 (.png.enc) で MIME を復元可能にする
        dest = output_dir / f"{src.name}.enc"
        dest.write_bytes(encrypt_bytes(src.read_bytes(), password))
        print(f"  + {src.name} -> {dest.name}")
    return len(files)


def main() -> int:
    parser = argparse.ArgumentParser(description="限定共有コンテンツ暗号化ツール")
    parser.add_argument("--source", required=True, help="元画像のベースディレクトリ（サブディレクトリ=案件）")
    parser.add_argument("--output", required=True, help="出力先 (例: site/public/cliantshare)")
    args = parser.parse_args()

    source_base = Path(args.source)
    output_base = Path(args.output)

    if not source_base.exists():
        print(f"エラー: ソースディレクトリが見つかりません: {source_base}")
        return 1

    subdirs = sorted(d for d in source_base.iterdir() if d.is_dir())
    if not subdirs:
        print(f"エラー: サブディレクトリ（案件フォルダ）がありません: {source_base}")
        return 1

    password = getpass.getpass("共有パスワード: ")
    confirm = getpass.getpass("確認のため再入力: ")
    if password != confirm or not password:
        print("エラー: パスワードが一致しないか空です")
        return 1

    # パスワード検証ファイル（既知平文の暗号化。パスワード自体は含まれない）
    output_base.mkdir(parents=True, exist_ok=True)
    (output_base / VERIFY_FILENAME).write_bytes(encrypt_bytes(VERIFY_PLAINTEXT, password))
    print(f"+ {VERIFY_FILENAME}")

    total = 0
    for subdir in subdirs:
        print(f"[{subdir.name}]")
        total += encrypt_directory(subdir, output_base / subdir.name, password)

    print(f"\n完了: {total} ファイルを暗号化しました -> {output_base}")
    print("注意: 元画像ディレクトリは公開リポジトリにコミットしないでください。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
