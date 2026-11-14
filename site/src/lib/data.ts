/**
 * data/*.json の読み込み + zod 検証 + アセット解決。
 * 管理ツール (tools/manager) が更新する JSON をビルド時に取り込む。
 */
import type { ImageMetadata } from 'astro';
import worksJson from '../../../data/works.json';
import configJson from '../../../data/config.json';
import commissionJson from '../../../data/commission.json';
import countsJson from '../../../data/counts.json';
import requestsJson from '../../../data/requests.json';
import requestOptionsJson from '../../../data/request_options.json';
import notesJson from '../../../data/notes.json';
import {
  worksSchema,
  configSchema,
  commissionSchema,
  requestsSchema,
  requestOptionsSchema,
  notesSchema,
  isVideo,
  worksFileName,
  type Work,
  type RequestEntry,
  type Note,
} from './schema';
import { GENERIC_TAGS } from './related';
import type { BoardEntry } from './request';

export const siteConfig = configSchema.parse(configJson);
export const commission = commissionSchema.parse(commissionJson);
export const requestOptions = requestOptionsSchema.parse(requestOptionsJson);

const byDateDesc = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

/**
 * 閲覧数・いいね数の日次スナップショット (data/counts.json、update-counts.yml が更新)。
 * ギャラリーカードの表示用。詳細ページはクライアントでライブ取得。
 */
export function getCounts(id: number): { views: number; likes: number } {
  const entry = (countsJson as Record<string, { views: number; likes: number }>)[String(id)];
  return entry ?? { views: 0, likes: 0 };
}

/**
 * 公開作品（日付降順 → id降順）。
 * hidden と nsfw (R-18) はビルドに含めない。R-15 (sensitive) は通常どおり掲載する。
 */
export const works: Work[] = worksSchema
  .parse(worksJson)
  .filter((w) => !w.hidden && !w.nsfw)
  .sort((a, b) => (a.date === b.date ? b.id - a.id : byDateDesc(a, b)));

const worksBySlug = new Map(works.map((w) => [w.slug, w]));

export function getWork(slug: string): Work | undefined {
  return worksBySlug.get(slug);
}

/** タグと作品数（多い順）。ほぼ全作品に付くタグは除く */
export const tagCounts: [tag: string, count: number][] = (() => {
  const counts = new Map<string, number>();
  for (const work of works) {
    for (const tag of work.tags) {
      if (GENERIC_TAGS.includes(tag)) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
})();

// ---- リクエスト対応予定 / 作者のひとこと ------------------------------------

/** リクエスト（新しい順）。同じ日付は requests.json に書いた順を保つ */
export const requests: RequestEntry[] = requestsSchema.parse(requestsJson).sort(byDateDesc);

/** 作品ページ用: この作品が生まれるきっかけになったリクエスト */
export function getRequestsForWork(slug: string): RequestEntry[] {
  return requests.filter((r) => r.status === 'done' && r.work_slug === slug);
}

/** 「あなたのリクエスト」照合用に各ページへ埋め込む、受付番号ごとの進み具合 */
export function getRequestBoard(): Record<string, BoardEntry> {
  const board: Record<string, BoardEntry> = {};
  for (const request of requests) {
    const work = request.work_slug ? getWork(request.work_slug) : undefined;
    board[request.id] = {
      status: request.status,
      ...(work ? { workTitle: work.title, workUrl: url(`/works/${work.slug}.html`) } : {}),
    };
  }
  return board;
}

export const notes: Note[] = notesSchema.parse(notesJson).sort(byDateDesc);

// ---- アセット解決 ----------------------------------------------------------

const workImages = import.meta.glob<{ default: ImageMetadata }>(
  '../../../static/img/works/*.{webp,jpg,jpeg,png,svg,gif}',
  { eager: true },
);

const rootImages = import.meta.glob<{ default: ImageMetadata }>(
  '../../../static/img/*.{webp,jpg,jpeg,png,svg}',
  { eager: true },
);

const heroImageGlob = import.meta.glob<{ default: ImageMetadata }>(
  '../../../static/img/hero/*.{webp,jpg,jpeg,png}',
  { eager: true },
);

/**
 * ヒーロー帯画像。static/img/hero/ に置いた画像をファイル名昇順で返す。
 * 画像を追加/リネーム/削除するだけでトップのヒーローが更新される。
 */
export const heroImages: ImageMetadata[] = Object.entries(heroImageGlob)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, mod]) => mod.default);

const ogImageGlob = import.meta.glob<{ default: ImageMetadata }>(
  '../../../static/img/ogp.{webp,jpg,jpeg,png}',
  { eager: true },
);

/**
 * OGPフォールバック画像 (X/SNSカード用)。static/img/ogp.png (推奨1200x630) を置くと
 * og:image 未指定の全ページで使われる。無ければ undefined (og:image 省略)。
 */
export const defaultOgImage: ImageMetadata | undefined =
  Object.values(ogImageGlob)[0]?.default;

const workVideos = import.meta.glob<{ default: string }>(
  '../../../static/img/works/*.{mp4,mov,webm}',
  { eager: true, query: '?url', import: 'default' },
) as unknown as Record<string, string>;

function lookup(
  globMap: Record<string, { default: ImageMetadata }>,
  file: string,
): ImageMetadata | undefined {
  const hit = Object.entries(globMap).find(([path]) => path.endsWith(`/${file}`));
  return hit?.[1].default;
}

/** 作品画像 ("/static/img/works/x.webp") → ImageMetadata。動画や欠損は undefined */
export function resolveWorkImage(imagePath: string): ImageMetadata | undefined {
  if (isVideo(imagePath)) return undefined;
  return lookup(workImages, worksFileName(imagePath));
}

/** カード・一覧用のサムネイル元画像（thumbnail が無ければ本体画像） */
export function resolveWorkThumb(work: Work): ImageMetadata | undefined {
  return resolveWorkImage(work.thumbnail) ?? resolveWorkImage(work.image_path);
}

/** ヒーロー画像など img 直下のアセット ("/static/img/x.webp") を解決 */
export function resolveRootImage(imagePath: string): ImageMetadata | undefined {
  const file = imagePath.replace(/^\/static\/img\//, '');
  return lookup(rootImages, file);
}

/** 動画 ("/static/img/works/x.mp4") → ビルド成果物に含まれる公開URL */
export function resolveVideoUrl(imagePath: string): string {
  const file = worksFileName(imagePath);
  const hit = Object.entries(workVideos).find(([path]) => path.endsWith(`/${file}`));
  return hit?.[1] ?? '';
}

/** base 込みのサイト内URLを生成 */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** ギャラリーをタグで絞り込んだURL */
export function tagUrl(tag: string): string {
  return `${url('/gallery.html')}?tag=${encodeURIComponent(tag)}`;
}

/** カード類で共通のサムネイル寸法（同じ寸法にして画像変換を使い回す） */
export const THUMB_SIZE = 480;

/** "2026-11-14" → "2026.11.14" */
export function formatDate(date: string): string {
  return date.replaceAll('-', '.');
}

/** <script type="application/json"> に安全に埋め込める JSON 文字列（"</script>" 対策） */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export { isVideo };
export type { Work, RequestEntry, Note };
