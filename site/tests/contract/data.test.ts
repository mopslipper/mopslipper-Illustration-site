/**
 * データ契約テスト（TDD Step 1: 仕様の固定）
 * - data/*.json が旧サイト互換スキーマに適合すること
 * - slug / id の一意性
 * - 参照アセットの実在
 * このテストは実装の都合で変更しない（仕様変更時のみ更新）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  worksSchema,
  configSchema,
  commissionSchema,
  isVideo,
  worksFileName,
} from '../../src/lib/schema';

const DATA_DIR = resolve(__dirname, '../../../data');
// 正準メディアディレクトリ（works_manager GUI が書き込む場所）
const STATIC_WORKS = resolve(__dirname, '../../../static/img/works');

const loadJson = (name: string) =>
  JSON.parse(readFileSync(join(DATA_DIR, name), 'utf-8'));

describe('works.json 契約', () => {
  const raw = loadJson('works.json');

  it('スキーマに適合する', () => {
    const result = worksSchema.safeParse(raw);
    if (!result.success) {
      console.error(JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
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
    const result = configSchema.safeParse(loadJson('config.json'));
    if (!result.success) {
      console.error(JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  it('公開URLが旧サイトと同一（base_path 維持）', () => {
    const config = configSchema.parse(loadJson('config.json'));
    expect(config.site_url).toBe('https://mopslipper.github.io');
    expect(config.base_path).toBe('/mopslipper-Illustration-site');
  });
});

describe('commission.json 契約', () => {
  it('スキーマに適合する', () => {
    const result = commissionSchema.safeParse(loadJson('commission.json'));
    if (!result.success) {
      console.error(JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
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
