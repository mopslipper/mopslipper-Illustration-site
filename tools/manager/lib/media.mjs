/**
 * 画像・動画ファイルの保存と、サムネイルなどの画像処理。
 * 画像処理にはサイトが使っている sharp を借りる（管理ツール用に別のパッケージは入れない）。
 *
 * Windows では、開いたままのファイルは置き換えられない。sharp にはファイルの場所ではなく
 * 中身（Buffer）を渡して、ファイルをつかんだままにしないようにしている。
 */
import { createRequire } from 'node:module';
import { createWriteStream, existsSync } from 'node:fs';
import { stat, unlink, mkdir, readFile, writeFile } from 'node:fs/promises';
import { finished } from 'node:stream/promises';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { replaceFile } from './store.mjs';

const SITE_PACKAGE = fileURLToPath(new URL('../../../site/package.json', import.meta.url));

let sharpModule;
export function loadSharp() {
  if (!sharpModule) {
    try {
      sharpModule = createRequire(SITE_PACKAGE)('sharp');
    } catch {
      throw new Error('画像処理ライブラリ (sharp) が見つかりません。site フォルダで npm install を実行してください。');
    }
  }
  return sharpModule;
}

export class UploadError extends Error {}

/**
 * ストリームをファイルに保存する。一時ファイルに書いてから置き換えるので、途中で失敗しても元のファイルは壊れない。
 * 上限を超えた分は読み捨ててからエラーにする（途中で接続を切ると、ブラウザにエラー内容が届かないため）。
 * @returns {Promise<number>} 保存したバイト数
 */
export async function saveStream(stream, destination, maxBytes) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temp = `${destination}.${process.pid}.upload.tmp`;
  const out = createWriteStream(temp);
  let size = 0;
  try {
    for await (const chunk of stream) {
      size += chunk.length;
      if (size > maxBytes) continue;
      if (!out.write(chunk)) await once(out, 'drain');
    }
    out.end();
    await finished(out);
    if (size > maxBytes) throw new UploadError(`ファイルが大きすぎます（上限 ${Math.round(maxBytes / 1024 / 1024)}MB）`);
    if (size === 0) throw new UploadError('ファイルが空です');
    await replaceFile(temp, destination);
    return size;
  } catch (error) {
    out.destroy();
    await unlink(temp).catch(() => undefined);
    throw error;
  }
}

/** 画像として読めるか確かめ、大きさを返す。読めなければ UploadError */
export async function readImageSize(file) {
  try {
    const { width, height } = await loadSharp()(await readFile(file)).metadata();
    if (!width || !height) throw new Error('no size');
    return { width, height };
  } catch {
    throw new UploadError('画像として読み込めませんでした。ファイルが壊れていないか確認してください。');
  }
}

/**
 * 本体画像から JPG サムネイルを作る（旧ツールと同じく原寸・品質 92、透明部分は白）。
 * すでに新しいサムネイルがあれば作り直さない。
 * @returns {Promise<boolean>} 作った（またはすでにある）なら true
 */
export async function makeJpgThumbnail(source, target) {
  if (path.resolve(source) === path.resolve(target)) return true;
  if (existsSync(target) && (await stat(target)).mtimeMs >= (await stat(source)).mtimeMs) return true;
  const temp = `${target}.${process.pid}.thumb.tmp`;
  try {
    const jpeg = await loadSharp()(await readFile(source)).rotate().flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toBuffer();
    await writeFile(temp, jpeg);
    await replaceFile(temp, target);
    return true;
  } catch {
    await unlink(temp).catch(() => undefined);
    return false;
  }
}

const previewCache = new Map();
const PREVIEW_CACHE_MAX = 600;

/**
 * 管理画面の一覧・プレビュー用の小さな画像 (WebP)。動画など画像でないものは null。
 * @param {string} file
 * @param {{ width: number, fit: 'cover' | 'inside' }} options
 */
export async function makePreview(file, { width, fit }) {
  const { mtimeMs } = await stat(file);
  const key = `${file}|${mtimeMs}|${width}|${fit}`;
  const cached = previewCache.get(key);
  if (cached) return cached;
  try {
    const image = loadSharp()(await readFile(file)).rotate();
    const resized =
      fit === 'cover'
        ? image.resize(width, width, { fit: 'cover', position: 'top' })
        : image.resize(width, width, { fit: 'inside', withoutEnlargement: true });
    const buffer = await resized.webp({ quality: 78 }).toBuffer();
    if (previewCache.size >= PREVIEW_CACHE_MAX) previewCache.delete(previewCache.keys().next().value);
    previewCache.set(key, buffer);
    return buffer;
  } catch {
    return null;
  }
}

/** AI に送るには大きすぎる画像を、上限に収まる JPEG に縮小する */
export async function shrinkForAi(file, maxBytes) {
  const sharp = loadSharp();
  const source = await readFile(file);
  let buffer;
  for (const [size, quality] of [[1024, 85], [768, 78], [512, 70]]) {
    buffer = await sharp(source)
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    if (buffer.length <= maxBytes) break;
  }
  return buffer;
}
