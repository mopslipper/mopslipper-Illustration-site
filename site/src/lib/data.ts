/**
 * data/*.json の読み込み + zod 検証 + アセット解決。
 * works_manager GUI が更新する JSON をビルド時に取り込む。
 */
import type { ImageMetadata } from 'astro';
import worksJson from '../../../data/works.json';
import configJson from '../../../data/config.json';
import commissionJson from '../../../data/commission.json';
import countsJson from '../../../data/counts.json';
import {
  worksSchema,
  configSchema,
  commissionSchema,
  isVideo,
  worksFileName,
  type Work,
} from './schema';

export const siteConfig = configSchema.parse(configJson);
export const commission = commissionSchema.parse(commissionJson);

/**
 * 閲覧数・いいね数の日次スナップショット (data/counts.json、update-counts.yml が更新)。
 * ギャラリーカードの表示用。詳細ページはクライアントでライブ取得。
 */
export function getCounts(id: number): { views: number; likes: number } {
  const entry = (countsJson as Record<string, { views: number; likes: number }>)[String(id)];
  return entry ?? { views: 0, likes: 0 };
}

/** 日付降順 → id降順 で整列した公開作品（hidden は除外、旧サイト互換） */
export const works: Work[] = worksSchema
  .parse(worksJson)
  .filter((w) => !w.hidden)
  .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));

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

export { isVideo };
export type { Work };
