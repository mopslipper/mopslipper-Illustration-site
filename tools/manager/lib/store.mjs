/**
 * data/*.json の読み書き。
 * - 書き込みは「一時ファイル → 置き換え」で行い、途中で落ちてもファイルを壊さない
 * - 置き換える前の内容を data/private/backup/ に残す（直近のみ）
 * - 既存ファイルの改行コード・末尾改行を保つ（無関係な差分を出さないため）
 */
import { readFile, writeFile, rename, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const FILES = {
  works: 'data/works.json',
  requests: 'data/requests.json',
  notes: 'data/notes.json',
  requestOptions: 'data/request_options.json',
  commission: 'data/commission.json',
  config: 'data/config.json',
  /** この PC だけのデータ（.gitignore 済み・公開されない） */
  privateRequests: 'data/private/requests_private.json',
  requestDrafts: 'data/private/request_drafts.json',
};

export const PRIVATE_DIR = 'data/private';
export const BACKUP_DIR = 'data/private/backup';
export const BACKUP_KEEP = 20;

const stripBom = (text) => text.replace(/^\uFEFF/, '');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ファイルを置き換える。置き換え先をほかのプログラム（確認用サイトのサーバなど）が一瞬開いていると
 * Windows では失敗するので、少し待ってやり直す。
 */
export async function replaceFile(temp, destination) {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temp, destination);
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 5) throw error;
      await sleep(120 * (attempt + 1));
    }
  }
}

/** 既存の書式（改行コード・末尾改行）に合わせて JSON 文字列にする */
export function formatJson(value, previousText) {
  let text = JSON.stringify(value, null, 2);
  const crlf = previousText !== undefined && previousText.includes('\r\n');
  const trailingNewline = previousText === undefined || /\n$/.test(previousText);
  if (trailingNewline) text += '\n';
  return crlf ? text.replace(/\n/g, '\r\n') : text;
}

/** バックアップのファイル名用: 20261114-190512-123 */
export function backupStamp(date = new Date()) {
  const p = (n, width = 2) => String(n).padStart(width, '0');
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-` +
    `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}-${p(date.getMilliseconds(), 3)}`
  );
}

export function createStore(root) {
  const resolve = (key) => {
    if (!Object.hasOwn(FILES, key)) throw new Error(`unknown data file: ${key}`);
    return path.join(root, FILES[key]);
  };

  async function readText(key) {
    const file = resolve(key);
    return existsSync(file) ? stripBom(await readFile(file, 'utf-8')) : undefined;
  }

  /** ファイルが無ければ fallback（未指定ならエラー） */
  async function read(key, fallback) {
    const text = await readText(key);
    if (text === undefined) {
      if (fallback === undefined) throw new Error(`${FILES[key]} が見つかりません`);
      return fallback;
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`${FILES[key]} を読み込めません（JSON の書式エラー）: ${error.message}`);
    }
  }

  async function backup(key, previousText) {
    const dir = path.join(root, BACKUP_DIR);
    await mkdir(dir, { recursive: true });
    const base = path.basename(FILES[key], '.json');
    await writeFile(path.join(dir, `${base}.${backupStamp()}.json`), previousText, 'utf-8');
    const old = (await readdir(dir))
      .filter((name) => name.startsWith(`${base}.`) && name.endsWith('.json'))
      .sort()
      .slice(0, -BACKUP_KEEP);
    await Promise.all(old.map((name) => unlink(path.join(dir, name)).catch(() => undefined)));
  }

  /** 内容が変わらなければ何もしない。変わった場合は true を返す */
  async function write(key, value) {
    const file = resolve(key);
    const previousText = await readText(key);
    const text = formatJson(value, previousText);
    if (previousText === text) return false;

    await mkdir(path.dirname(file), { recursive: true });
    if (previousText !== undefined) await backup(key, previousText);
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, text, 'utf-8');
    try {
      await replaceFile(temp, file);
    } catch (error) {
      await unlink(temp).catch(() => undefined);
      throw error;
    }
    return true;
  }

  return { root, resolve, read, write };
}
