/**
 * works.json / config.json / commission.json の契約スキーマ。
 * 旧サイト(Python+Jinja2版)のデータスキーマと完全互換。
 * works_manager GUI が書き出す JSON をそのまま受け入れる。
 */
import { z } from 'astro/zod';

export const CATEGORIES = ['Original', 'Fanart', 'Live2D', 'Animation', 'Manga'] as const;

export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'] as const;

export const workSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  image_path: z.string().startsWith('/static/img/works/'),
  thumbnail: z.string().startsWith('/static/img/works/'),
  x_thumbnail: z.string().optional(),
  additional_images: z.array(z.string()).optional(),
  tags: z.array(z.string()),
  request_tags: z.array(z.string()).optional(),
  category: z.enum(CATEGORIES),
  description: z.string().optional().default(''),
  /** works_manager の AI説明文生成設定（サイト表示には未使用・互換のため許容） */
  ai_desc_override: z
    .object({
      tone_preset: z.string().optional(),
      length_rule: z.string().optional(),
      must_include: z.array(z.string()).optional(),
      custom_instruction: z.string().optional(),
    })
    .passthrough()
    .optional(),
  nsfw: z.boolean(),
  sensitive: z.boolean().optional(),
  /** ギャラリー・詳細ページに出さない（works_manager の「🙈 非表示」） */
  hidden: z.boolean().optional(),
  /** R15作品のXカードサムネをプレースホルダーにする */
  hide_sensitive_thumbnail_on_x: z.boolean().optional(),
  external_links: z
    .object({
      pixiv: z.string().optional(),
      twitter: z.string().optional(),
      booth: z.string().optional(),
      fanbox: z.string().optional(),
    })
    .partial()
    .optional(),
});

export const worksSchema = z.array(workSchema);

export const configSchema = z.object({
  site_name: z.string(),
  site_title: z.string(),
  site_description: z.string(),
  site_url: z.string().url(),
  custom_domain: z.string(),
  hero_image: z.string(),
  hero_text: z.string(),
  hero_subtext: z.string(),
  author: z.object({
    name: z.string(),
    name_en: z.string(),
    bio: z.string(),
    bio_detail: z.string(),
    tools: z.array(z.string()),
    skills: z.array(z.string()),
    experience: z.string(),
  }),
  social_links: z.record(z.string()),
  contact_form_action: z.string().url(),
  nsfw_warning: z.boolean(),
  nsfw_text: z.string(),
  footer_text: z.string(),
  copyright_year: z.number(),
  google_analytics: z.string(),
  meta_keywords: z.string(),
  base_path: z.string(),
});

export const commissionSchema = z.object({
  status: z.object({
    open: z.boolean(),
    message: z.string(),
    next_update: z.string().optional(),
  }),
  menu: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      name_en: z.string(),
      price: z.string(),
      delivery: z.string(),
      description: z.string(),
      details: z.array(z.string()),
    }),
  ),
  flow: z.array(
    z.object({
      step: z.number(),
      title: z.string(),
      description: z.string(),
    }),
  ),
  policy: z
    .object({
      ok: z.array(z.string()).optional(),
      ng: z.array(z.string()).optional(),
      notes: z.array(z.string()).optional(),
    })
    .passthrough()
    .optional(),
}).passthrough();

export type Work = z.infer<typeof workSchema>;
export type SiteConfig = z.infer<typeof configSchema>;
export type Commission = z.infer<typeof commissionSchema>;

/** 動画作品かどうか（旧サイト互換: 拡張子で判定） */
export function isVideo(imagePath: string): boolean {
  return VIDEO_EXTENSIONS.some((ext) => imagePath.toLowerCase().endsWith(ext));
}

/** "/static/img/works/xxx.webp" → "xxx.webp" （アセット解決用） */
export function worksFileName(imagePath: string): string {
  return imagePath.replace(/^\/static\/img\/works\//, '');
}
