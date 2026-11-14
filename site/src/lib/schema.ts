/**
 * data/*.json の契約スキーマ。
 * works.json / config.json / commission.json は旧サイトと互換（旧 works_manager が書き出した JSON もそのまま受け入れる）。
 * requests.json / request_options.json / notes.json は v2 で追加したファイル。どれも管理ツール (tools/manager) で編集する。
 */
import { z } from 'astro/zod';
// 拡張子つきで読み込む: 管理ツール (tools/manager) が素の Node からこのファイルを共有するため
import { REQUEST_STATUSES, RECEIPT_PATTERN } from './request.ts';

export const CATEGORIES = ['Original', 'Fanart', 'Live2D', 'Animation', 'Manga'] as const;

export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'] as const;

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const workSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  title: z.string().min(1),
  date: dateString,
  image_path: z.string().startsWith('/static/img/works/'),
  thumbnail: z.string().startsWith('/static/img/works/'),
  x_thumbnail: z.string().optional(),
  additional_images: z.array(z.string()).optional(),
  tags: z.array(z.string()),
  request_tags: z.array(z.string()).optional(),
  category: z.enum(CATEGORIES),
  description: z.string().optional().default(''),
  /** 管理ツールの AI 説明文の指示（作品ごとの上書き。サイト表示には未使用） */
  ai_desc_override: z
    .object({
      tone_preset: z.string().optional(),
      length_rule: z.string().optional(),
      must_include: z.array(z.string()).optional(),
      custom_instruction: z.string().optional(),
    })
    .passthrough()
    .optional(),
  /** R-18。v2 では掲載しない（true の作品はビルドから除外）。旧データとの互換のため項目は残す */
  nsfw: z.boolean(),
  /** R-15。通常どおり表示し、小さなラベルと「R-15のみ」絞り込みに使う */
  sensitive: z.boolean().optional(),
  /** ギャラリー・詳細ページに出さない（管理ツールの「非表示」） */
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
  /** 公開先のサブパス。ルート直下で公開するなら ""、それ以外は "/xxx"（末尾スラッシュなし） */
  base_path: z.string().regex(/^(\/[^/\s]+)*$/),
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

// ---- v2: リクエストのゆくえ / かんたんリクエスト / 作者のひとこと ------------

export const requestSchema = z
  .object({
    /** 受付番号（メールに書かれている R-XXXX。無いものは同じ形式で自由に採番） */
    id: z.string().regex(RECEIPT_PATTERN),
    date: dateString,
    status: z.enum(REQUEST_STATUSES),
    /** 送信者が「サイト掲載OK」にチェックした場合のみ true */
    public: z.boolean(),
    /** 掲載同意があるときだけ書く。同意の無い内容は data/private/（git 管理外）に保存する */
    text: z.string().optional(),
    nickname: z.string().optional(),
    /** 完成した作品の slug（status: done のときに指定） */
    work_slug: z.string().optional(),
    /** 作者からのひとこと */
    reply: z.string().optional(),
  })
  .strict()
  .refine((r) => !r.public || !!r.text?.trim(), {
    message: 'public: true のリクエストには text が必要です',
    path: ['text'],
  })
  // このファイルは公開リポジトリに入るため、同意の無い内容を書けないようにする
  .refine((r) => r.public || (r.text === undefined && r.nickname === undefined), {
    message: 'public: false のリクエストには text / nickname を書けません',
    path: ['public'],
  });

export const requestsSchema = z.array(requestSchema);

export const requestOptionsSchema = z.object({
  groups: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z][a-z0-9_-]*$/),
        label: z.string().min(1),
        options: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
  /** 作品ページの「この子の別バージョン」ボタン */
  variants: z.array(
    z.object({
      id: z.string().regex(/^[a-z][a-z0-9_-]*$/),
      label: z.string().min(1),
    }),
  ),
});

export const notesSchema = z.array(
  z
    .object({
      date: dateString,
      text: z.string().min(1),
      link: z.string().optional(),
    })
    .strict(),
);

export type Work = z.infer<typeof workSchema>;
export type SiteConfig = z.infer<typeof configSchema>;
export type Commission = z.infer<typeof commissionSchema>;
export type RequestEntry = z.infer<typeof requestSchema>;
export type RequestOptions = z.infer<typeof requestOptionsSchema>;
export type Note = z.infer<typeof notesSchema>[number];

/** 動画作品かどうか（旧サイト互換: 拡張子で判定） */
export function isVideo(imagePath: string): boolean {
  return VIDEO_EXTENSIONS.some((ext) => imagePath.toLowerCase().endsWith(ext));
}

/** "/static/img/works/xxx.webp" → "xxx.webp" （アセット解決用） */
export function worksFileName(imagePath: string): string {
  return imagePath.replace(/^\/static\/img\/works\//, '');
}
