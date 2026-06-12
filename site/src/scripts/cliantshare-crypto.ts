/**
 * 限定共有コンテンツの暗号フォーマット (MSLENC01)
 *
 * 旧サイトの XOR + JS埋め込みパスワード方式を置き換える。
 * パスワードはページに一切埋め込まず、AES-GCM の認証失敗で誤パスワードを検出する。
 *
 * ファイル形式:
 *   [magic "MSLENC01" 8B][salt 16B][iv 12B][AES-256-GCM ciphertext+tag]
 * 鍵導出: PBKDF2-HMAC-SHA256, 310,000 iterations
 *
 * Python 側 (tools/encrypt_share.py) と完全互換であること（契約テストで保証）。
 */

export const MAGIC = 'MSLENC01';
export const SALT_LENGTH = 16;
export const IV_LENGTH = 12;
export const PBKDF2_ITERATIONS = 310_000;
export const VERIFY_PLAINTEXT = 'MOPSLIPPER_CLIANTSHARE_OK';
export const VERIFY_FILENAME = 'verify.enc';

const HEADER_LENGTH = MAGIC.length + SALT_LENGTH + IV_LENGTH;

const subtle = globalThis.crypto.subtle;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export class DecryptError extends Error {}

/** .enc データを復号する。パスワード誤り・破損時は DecryptError を投げる */
export async function decrypt(data: ArrayBuffer, password: string): Promise<Uint8Array> {
  const bytes = new Uint8Array(data);
  const magic = new TextDecoder().decode(bytes.slice(0, MAGIC.length));
  if (bytes.length <= HEADER_LENGTH || magic !== MAGIC) {
    throw new DecryptError('不正なファイル形式です');
  }
  const salt = bytes.slice(MAGIC.length, MAGIC.length + SALT_LENGTH);
  const iv = bytes.slice(MAGIC.length + SALT_LENGTH, HEADER_LENGTH);
  const ciphertext = bytes.slice(HEADER_LENGTH);

  const key = await deriveKey(password, salt);
  try {
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    return new Uint8Array(plain);
  } catch {
    throw new DecryptError('パスワードが正しくありません');
  }
}

/** 暗号化（Python ツールと同形式・テスト/ツール用） */
export async function encrypt(data: Uint8Array, password: string): Promise<Uint8Array> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);
  const ciphertext = new Uint8Array(
    await subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      data as BufferSource,
    ),
  );
  const out = new Uint8Array(HEADER_LENGTH + ciphertext.length);
  out.set(new TextEncoder().encode(MAGIC), 0);
  out.set(salt, MAGIC.length);
  out.set(iv, MAGIC.length + SALT_LENGTH);
  out.set(ciphertext, HEADER_LENGTH);
  return out;
}

/** パスワード検証: verify.enc を復号して既知平文と比較 */
export async function verifyPassword(verifyData: ArrayBuffer, password: string): Promise<boolean> {
  try {
    const plain = await decrypt(verifyData, password);
    return new TextDecoder().decode(plain) === VERIFY_PLAINTEXT;
  } catch {
    return false;
  }
}
