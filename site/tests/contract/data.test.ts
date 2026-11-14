/**
 * データ契約テスト
 * - data/*.json がスキーマに適合すること（works / config / commission は旧サイト互換）
 * - slug / id の一意性、参照アセットの実在
 * - v2 追加ファイル（requests / request_options / notes）の整合性
 * このテストは実装の都合で変更しない（仕様変更時のみ更新）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  worksSchema,
  configSchema,
  commissionSchema,
  requestsSchema,
  requestOptionsSchema,
  notesSchema,
  isVideo,
  worksFileName,
} from '../../src/lib/schema';

const DATA_DIR = resolve(__dirname, '../../../data');
// 正準メディアディレクトリ（管理ツールが画像を保存する場所）
const STATIC_WORKS = resolve(__dirname, '../../../static/img/works');

const loadJson = (name: string) =>
  JSON.parse(readFileSync(join(DATA_DIR, name), 'utf-8'));

const expectValid = (result: { success: boolean; error?: { issues: unknown } }) => {
  if (!result.success) console.error(JSON.stringify(result.error?.issues, null, 2));
  expect(result.success).toBe(true);
};

describe('works.json 契約', () => {
  const raw = loadJson('works.json');

  it('スキーマに適合する', () => {
    expectValid(worksSchema.safeParse(raw));
  });

  it('slug が一意である', () => {
    const slugs = raw.map((w: { slug: string }) => w.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('id が一意である', () => {
    const ids = raw.map((w: { id: number }) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('全作品の画像・動画アセットが実在する', () => {
    const works = worksSchema.parse(raw);
    const missing: string[] = [];
    for (const work of works) {
      const paths = [
        work.image_path,
        work.thumbnail,
        ...(work.additional_images ?? []),
        ...(work.x_thumbnail ? [work.x_thumbnail] : []),
      ];
      for (const p of paths) {
        const file = worksFileName(p);
        const location = join(STATIC_WORKS, file);
        if (!existsSync(location)) {
          missing.push(`${work.slug}: ${p}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('config.json 契約', () => {
  it('スキーマに適合する', () => {
    expectValid(configSchema.safeParse(loadJson('config.json')));
  });

  it('base_path は "" か "/xxx" 形式（末尾スラッシュなし）', () => {
    const base = { ...loadJson('config.json') };
    expect(configSchema.safeParse({ ...base, base_path: '' }).success).toBe(true);
    expect(configSchema.safeParse({ ...base, base_path: '/my-site' }).success).toBe(true);
    expect(configSchema.safeParse({ ...base, base_path: '/my-site/' }).success).toBe(false);
    expect(configSchema.safeParse({ ...base, base_path: 'my-site' }).success).toBe(false);
  });
});

describe('commission.json 契約', () => {
  it('スキーマに適合する', () => {
    expectValid(commissionSchema.safeParse(loadJson('commission.json')));
  });

  it('R-18 を受け付ける記載がない（掲載は R-15 まで）', () => {
    const commission = commissionSchema.parse(loadJson('commission.json'));
    expect((commission.policy?.ok ?? []).filter((item) => /R-?18/i.test(item))).toEqual([]);
  });
});

describe('requests.json 契約', () => {
  const raw = loadJson('requests.json');

  it('スキーマに適合する', () => {
    expectValid(requestsSchema.safeParse(raw));
  });

  it('受付番号が一意である', () => {
    const ids = raw.map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('work_slug は works.json にある作品を指す', () => {
    // 非表示の作品を指していてもよい（サイト側はリンクを出さないだけ）。書き間違いを検出するためのテスト
    const slugs = new Set(worksSchema.parse(loadJson('works.json')).map((w) => w.slug));
    const broken = requestsSchema
      .parse(raw)
      .filter((r) => r.work_slug && !slugs.has(r.work_slug))
      .map((r) => `${r.id}: ${r.work_slug}`);
    expect(broken).toEqual([]);
  });

  it('内容を載せるリクエスト (public: true) には本文が必要', () => {
    const base = { id: 'R-7K2M', date: '2026-11-14', status: 'received' };
    expect(requestsSchema.safeParse([{ ...base, public: true }]).success).toBe(false);
    expect(requestsSchema.safeParse([{ ...base, public: true, text: 'ネコミミ' }]).success).toBe(true);
    expect(requestsSchema.safeParse([{ ...base, public: false }]).success).toBe(true);
  });

  it('内容を載せない設定のリクエストの内容・ニックネームは、公開されるこのファイルに書けない', () => {
    const base = { id: 'R-7K2M', date: '2026-11-14', status: 'received', public: false };
    expect(requestsSchema.safeParse([{ ...base, text: 'ひみつ' }]).success).toBe(false);
    expect(requestsSchema.safeParse([{ ...base, nickname: 'ないしょ' }]).success).toBe(false);
    expect(requestsSchema.safeParse([{ ...base, reply: 'ありがとう', work_slug: '144' }]).success).toBe(true);
  });

  it('非公開データの置き場 (data/private/) は git の管理対象外', () => {
    const ignore = readFileSync(resolve(DATA_DIR, '../.gitignore'), 'utf-8').split(/\r?\n/);
    expect(ignore).toContain('data/private/');
  });

  it('未知の項目・ステータスは弾く（書き間違いの検出）', () => {
    const base = { id: 'R-7K2M', date: '2026-11-14', public: false };
    expect(requestsSchema.safeParse([{ ...base, status: 'finished' }]).success).toBe(false);
    expect(requestsSchema.safeParse([{ ...base, status: 'done', workslug: '144' }]).success).toBe(false);
  });
});

describe('request_options.json 契約', () => {
  const raw = loadJson('request_options.json');

  it('スキーマに適合する', () => {
    expectValid(requestOptionsSchema.safeParse(raw));
  });

  it('グループ id・選択肢に重複がない', () => {
    const options = requestOptionsSchema.parse(raw);
    const groupIds = options.groups.map((g) => g.id);
    expect(new Set(groupIds).size).toBe(groupIds.length);
    for (const group of options.groups) {
      expect(new Set(group.options).size, group.id).toBe(group.options.length);
    }
    const variantIds = options.variants.map((v) => v.id);
    expect(new Set(variantIds).size).toBe(variantIds.length);
  });
});

describe('notes.json 契約', () => {
  it('スキーマに適合する', () => {
    expectValid(notesSchema.safeParse(loadJson('notes.json')));
  });
});

describe('ユーティリティ契約', () => {
  it('isVideo は動画拡張子を判定する', () => {
    expect(isVideo('/static/img/works/010-swimsuit-zooming.mp4')).toBe(true);
    expect(isVideo('/static/img/works/001-cat-girl.webp')).toBe(false);
    expect(isVideo('/static/img/works/a.MOV')).toBe(true);
    expect(isVideo('/static/img/works/b.webm')).toBe(true);
  });

  it('worksFileName はファイル名を抽出する', () => {
    expect(worksFileName('/static/img/works/001-cat-girl.webp')).toBe('001-cat-girl.webp');
  });
});
