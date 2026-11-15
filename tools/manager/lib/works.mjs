/**
 * 作品 (data/works.json) の純粋ロジック。
 * 管理画面のフォーム ⇔ works.json の1件の変換、ファイル名の決定など。
 */
import { CATEGORIES } from '../../../site/src/lib/schema.ts';
import { directivesEqual, mergeDirectives, normalizeDirectives } from './ai.mjs';

export class ValidationError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(problems.join('\n'));
    this.problems = problems;
  }
}

export const WORKS_PREFIX = '/static/img/works/';
/** 登録（アップロード）できる画像の拡張子 */
export const IMAGE_EXTS = ['.webp', '.jpg', '.jpeg', '.png', '.gif'];
export const VIDEO_EXTS = ['.mp4', '.mov', '.webm'];
export const UPLOAD_KINDS = ['main', 'thumb', 'x', 'extra'];

export function extOf(name) {
  const match = /\.[^./\\]+$/.exec(String(name ?? ''));
  return match ? match[0].toLowerCase() : '';
}

export const isImageName = (name) => IMAGE_EXTS.includes(extOf(name));
export const isVideoName = (name) => VIDEO_EXTS.includes(extOf(name));
/** サイト (Astro) が画像として読み込めるか。既存データの placeholder.svg も通す */
export const isSiteImageName = (name) => isImageName(name) || extOf(name) === '.svg';

/** いろいろな書き方（Windows のパス・URL・ファイル名だけ）を "/static/img/works/x.webp" に揃える */
export function normalizeMediaPath(value) {
  let p = String(value ?? '').trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/');
  if (!p) return '';
  p = p.split(/[?#]/)[0];
  const index = p.indexOf(WORKS_PREFIX);
  if (index >= 0) return p.slice(index);
  if (p.startsWith(WORKS_PREFIX.slice(1))) return `/${p}`;
  if (!p.includes('/')) return `${WORKS_PREFIX}${p}`;
  return p;
}

/** "/static/img/works/x.webp" → "x.webp"。作品フォルダ直下のファイルでなければ '' */
export function mediaFileName(mediaPath) {
  const p = String(mediaPath ?? '');
  if (!p.startsWith(WORKS_PREFIX)) return '';
  const name = p.slice(WORKS_PREFIX.length);
  return name && !/[/\\]/.test(name) && name !== '.' && name !== '..' ? name : '';
}

export function nextWorkId(works) {
  return works.reduce((max, work) => Math.max(max, Number(work.id) || 0), 0) + 1;
}

/**
 * アップロードされたファイルの保存名を決める。
 * main: 144.webp / thumb: 144-thumb.jpg / x: 144-x.jpg / extra: 144-1.webp, 144-2.webp, ...
 * @param {{ workId: number, kind: string, originalName: string, taken?: string[] }} input
 */
export function uploadFileName({ workId, kind, originalName, taken = [] }) {
  const id = Number(workId);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError(['作品 ID が正しくありません']);
  if (!UPLOAD_KINDS.includes(kind)) throw new ValidationError(['アップロードの種類が正しくありません']);

  const ext = extOf(originalName);
  const allowed = kind === 'main' ? [...IMAGE_EXTS, ...VIDEO_EXTS] : IMAGE_EXTS;
  if (!allowed.includes(ext)) {
    throw new ValidationError([`このファイルは使えません（使える形式: ${allowed.map((e) => e.slice(1)).join(' / ')}）`]);
  }

  if (kind === 'main') return `${id}${ext}`;
  if (kind === 'thumb') return `${id}-thumb${ext}`;
  if (kind === 'x') return `${id}-x${ext}`;
  const used = new Set(taken.map((name) => name.toLowerCase()));
  for (let n = 1; ; n++) {
    const name = `${id}-${n}${ext}`;
    if (!used.has(name)) return name;
  }
}

/** 本体画像から作る JPG サムネイルの名前。JPG ならそのまま使い、動画は作れないので null */
export function thumbnailNameFor(imageName) {
  const ext = extOf(imageName);
  if (VIDEO_EXTS.includes(ext)) return null;
  if (!IMAGE_EXTS.includes(ext)) return null;
  if (ext === '.jpg') return imageName;
  return `${imageName.slice(0, -ext.length)}.jpg`;
}

/** works.json の1件 → 管理画面のフォーム */
export function toForm(work, aiDefaults) {
  return {
    id: work.id,
    slug: work.slug,
    title: work.title,
    date: work.date,
    category: work.category,
    image_path: work.image_path,
    thumbnail: work.thumbnail,
    x_thumbnail: work.x_thumbnail ?? '',
    additional_images: [...(work.additional_images ?? [])],
    additional_images_per_row: work.additional_images_per_row ?? 1,
    tags: [...(work.tags ?? [])],
    description: work.description ?? '',
    sensitive: work.sensitive === true,
    hidden: work.hidden === true,
    hide_sensitive_thumbnail_on_x: work.hide_sensitive_thumbnail_on_x === true,
    ai_directives: mergeDirectives(aiDefaults, work.ai_desc_override),
  };
}

const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const uniqueTrimmed = (list) => {
  const result = [];
  for (const item of Array.isArray(list) ? list : []) {
    const value = String(item ?? '').trim();
    if (value && !result.includes(value)) result.push(value);
  }
  return result;
};

/** フォームが書き換える項目。これ以外（external_links など）は既存の値を保つ */
const FORM_KEYS = [
  'id', 'slug', 'title', 'date', 'image_path', 'thumbnail', 'category', 'x_thumbnail', 'tags', 'request_tags',
  'description', 'ai_desc_override', 'nsfw', 'hidden', 'sensitive', 'hide_sensitive_thumbnail_on_x',
  'external_links', 'additional_images', 'additional_images_per_row',
];

/**
 * フォームの内容から works.json の1件を作る。問題があれば ValidationError。
 * @param {object | undefined} existing 編集中の既存データ（新規なら undefined）
 * @param {object} form
 * @param {{ aiDefaults?: object }} [options]
 */
export function applyWorkForm(existing, form, { aiDefaults } = {}) {
  const problems = [];

  const id = Number(form.id);
  if (!Number.isInteger(id) || id <= 0) problems.push('ID は 1 以上の整数にしてください');

  const slug = String(form.slug ?? '').trim();
  if (!slug) problems.push('slug を入力してください');
  else if (existing?.slug !== slug && !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(slug)) {
    problems.push('slug は半角英数字・ハイフン・アンダースコアで入力してください（ページの URL になります）');
  }

  const title = String(form.title ?? '').trim();
  if (!title) problems.push('タイトルを入力してください');

  const date = String(form.date ?? '').trim();
  if (!isValidDate(date)) problems.push('公開日は 2026-11-14 の形式で入力してください');

  const category = String(form.category ?? '');
  if (!CATEGORIES.includes(category)) problems.push('カテゴリを選んでください');

  const imagePath = normalizeMediaPath(form.image_path);
  const imageName = mediaFileName(imagePath);
  if (!imageName) problems.push('画像を登録してください');
  else if (!isSiteImageName(imageName) && !isVideoName(imageName)) problems.push('画像・動画として使えない形式です');

  const thumbnail = normalizeMediaPath(form.thumbnail);
  const thumbName = mediaFileName(thumbnail);
  if (!thumbName) {
    problems.push(isVideoName(imageName) ? '動画の作品にはサムネイル画像を登録してください' : 'サムネイルを登録してください');
  } else if (!isSiteImageName(thumbName)) problems.push('サムネイルは画像にしてください');

  const xThumbnail = normalizeMediaPath(form.x_thumbnail);
  if (xThumbnail && !isSiteImageName(mediaFileName(xThumbnail))) problems.push('X 用サムネイルは画像にしてください');

  const additional = uniqueTrimmed(form.additional_images).map(normalizeMediaPath);
  if (additional.some((p) => !isSiteImageName(mediaFileName(p)))) problems.push('追加画像は画像にしてください');

  // 追加画像を横に並べる枚数。項目ごと送られてこなければ（古い画面からの保存）、今の設定を保つ
  const perRow = form.additional_images_per_row === undefined
    ? (existing?.additional_images_per_row ?? 1)
    : Number(form.additional_images_per_row);
  if (![1, 2, 3].includes(perRow)) problems.push('追加画像の並べ方は 1枚ずつ・2枚ずつ・3枚ずつ から選んでください');

  if (problems.length > 0) throw new ValidationError(problems);

  const tags = uniqueTrimmed(form.tags);
  const description = String(form.description ?? '').trim();
  const sensitive = form.sensitive === true;

  // AI 説明の指示: 全体デフォルトと違うときだけ、作品ごとの上書きとして残す
  let override = existing?.ai_desc_override;
  if (form.ai_directives) {
    const directives = normalizeDirectives(form.ai_directives);
    const unchanged = override && directivesEqual(directives, mergeDirectives(aiDefaults, override));
    if (!unchanged) override = directivesEqual(directives, aiDefaults) ? undefined : directives;
  }

  const work = {
    id,
    slug,
    title,
    date,
    image_path: imagePath,
    thumbnail,
    category,
    ...(xThumbnail ? { x_thumbnail: xThumbnail } : {}),
    tags,
    ...(existing?.request_tags?.length ? { request_tags: existing.request_tags } : {}),
    ...(description ? { description } : {}),
    ...(override ? { ai_desc_override: override } : {}),
    nsfw: existing?.nsfw === true,
    ...(form.hidden === true ? { hidden: true } : {}),
    ...(sensitive ? { sensitive: true } : {}),
    ...(sensitive && form.hide_sensitive_thumbnail_on_x === true ? { hide_sensitive_thumbnail_on_x: true } : {}),
    external_links: existing?.external_links ?? {},
    ...(additional.length ? { additional_images: additional } : {}),
    ...(additional.length && perRow > 1 ? { additional_images_per_row: perRow } : {}),
  };

  for (const [key, value] of Object.entries(existing ?? {})) {
    if (!FORM_KEYS.includes(key)) work[key] = value;
  }
  return work;
}

/** ID・slug の重複。originalId は編集中の作品（自分自身は除く） */
export function findWorkConflicts(works, work, originalId) {
  const others = works.filter((w) => w.id !== originalId);
  const problems = [];
  if (others.some((w) => w.id === work.id)) problems.push(`ID ${work.id} はすでに使われています`);
  if (others.some((w) => w.slug === work.slug)) problems.push(`slug「${work.slug}」はすでに使われています`);
  return problems;
}

/** 使われているタグ（多い順）。入力候補に使う */
export function collectTags(works) {
  const counts = new Map();
  for (const work of works) {
    for (const tag of work.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja')).map(([tag]) => tag);
}
