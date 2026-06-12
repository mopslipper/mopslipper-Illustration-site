/**
 * 限定共有 暗号フォーマット契約テスト (MSLENC01)
 * - TS実装の encrypt/decrypt round-trip
 * - Pythonツール (tools/encrypt_share.py) が生成した .enc を TS 実装で復号できること（クロス互換）
 * - 誤パスワードは DecryptError / verify 失敗になること
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  encrypt,
  decrypt,
  verifyPassword,
  DecryptError,
  MAGIC,
  VERIFY_PLAINTEXT,
} from '../../src/scripts/cliantshare-crypto';

const FIXTURES = resolve(__dirname, '../fixtures');
const PASSWORD = 'test-password-123';

const toArrayBuffer = (buf: Buffer): ArrayBuffer =>
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

describe('TS実装 round-trip', () => {
  it('暗号化→復号で元データに戻る', async () => {
    const data = new TextEncoder().encode('hello kawaii world ♡');
    const enc = await encrypt(data, PASSWORD);
    expect(new TextDecoder().decode(enc.slice(0, 8))).toBe(MAGIC);
    const dec = await decrypt(toArrayBuffer(Buffer.from(enc)), PASSWORD);
    expect(new TextDecoder().decode(dec)).toBe('hello kawaii world ♡');
  });

  it('誤パスワードで DecryptError', async () => {
    const enc = await encrypt(new Uint8Array([1, 2, 3]), PASSWORD);
    await expect(decrypt(toArrayBuffer(Buffer.from(enc)), 'wrong')).rejects.toThrow(DecryptError);
  });

  it('不正データ（旧XOR形式等）で DecryptError', async () => {
    const bogus = new Uint8Array(64).fill(0xab);
    await expect(decrypt(toArrayBuffer(Buffer.from(bogus)), PASSWORD)).rejects.toThrow(
      DecryptError,
    );
  });
});

describe('Python ツールとのクロス互換', () => {
  it('Python生成の .enc を復号できる', async () => {
    const enc = readFileSync(resolve(FIXTURES, 'sample.png.enc'));
    const dec = await decrypt(toArrayBuffer(enc), PASSWORD);
    expect(Buffer.from(dec).toString('latin1')).toContain('PNG_FAKE_IMAGE_DATA');
  });

  it('Python生成の verify.enc でパスワード検証できる', async () => {
    const enc = readFileSync(resolve(FIXTURES, 'verify.enc'));
    expect(await verifyPassword(toArrayBuffer(enc), PASSWORD)).toBe(true);
    expect(await verifyPassword(toArrayBuffer(enc), 'wrong-password')).toBe(false);
  });

  it('VERIFY_PLAINTEXT が Python 側と一致', async () => {
    const enc = readFileSync(resolve(FIXTURES, 'verify.enc'));
    const dec = await decrypt(toArrayBuffer(enc), PASSWORD);
    expect(new TextDecoder().decode(dec)).toBe(VERIFY_PLAINTEXT);
  });
});
