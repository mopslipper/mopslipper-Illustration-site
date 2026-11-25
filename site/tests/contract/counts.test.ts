/**
 * 閲覧数・いいね数の集計 (tools/counts.mjs) の契約テスト。
 * Abacus が一部だけ失敗しても集計全体を止めず、前回の値を残すこと。数が減らないこと。
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error 型定義の無い Node モジュール
import { isRetryableStatus, mergeCounts, retryDelayMs } from '../../../tools/counts.mjs';

describe('閲覧数・いいね数の集計', () => {
  it('取れた値で更新し、取れなかった値は前回の集計を残す', () => {
    const previous = { 1: { views: 10, likes: 2 }, 2: { views: 5, likes: 0 } };
    const fetched = new Map<string, number | null>([
      ['views-1', 12],
      ['likes-1', null],
      ['views-2', null],
      ['likes-2', 1],
    ]);
    const { counts, failed, kept } = mergeCounts([1, 2], previous, fetched);
    expect(counts).toEqual({ 1: { views: 12, likes: 2 }, 2: { views: 5, likes: 1 } });
    expect(failed).toEqual(['likes-1', 'views-2']);
    expect(kept).toEqual(['likes-1', 'views-2']);
  });

  it('新しい作品（前回の集計なし）は取れた値、取れなければ 0', () => {
    const fetched = new Map<string, number | null>([
      ['views-3', 4],
      ['likes-3', null],
    ]);
    const { counts, failed, kept } = mergeCounts([3], {}, fetched);
    expect(counts).toEqual({ 3: { views: 4, likes: 0 } });
    expect(failed).toEqual(['likes-3']);
    expect(kept).toEqual([]);
  });

  it('前回より小さい値では上書きしない（数は増える一方）', () => {
    const fetched = new Map<string, number | null>([
      ['views-1', 3],
      ['likes-1', 0],
    ]);
    expect(mergeCounts([1], { 1: { views: 10, likes: 2 } }, fetched).counts).toEqual({ 1: { views: 10, likes: 2 } });
  });

  it('works.json から消えた作品は集計から外し、壊れた値は数として扱わない', () => {
    const fetched = new Map<string, number | null>([
      ['views-1', Number.NaN],
      ['likes-1', -1],
    ]);
    const { counts, failed } = mergeCounts([1], { 1: { views: 7, likes: 1 }, 99: { views: 1, likes: 1 } }, fetched);
    expect(counts).toEqual({ 1: { views: 7, likes: 1 } });
    expect(failed).toEqual(['views-1', 'likes-1']);
  });

  it('500・429・408 は送り直し、404 や 400 は送り直さない', () => {
    expect([500, 502, 503, 429, 408].every(isRetryableStatus)).toBe(true);
    expect([400, 401, 403, 404].some(isRetryableStatus)).toBe(false);
  });

  it('送り直しの待ち時間は少しずつ長くし、Retry-After があれば従う（上限あり）', () => {
    expect([0, 1, 2, 3].map((attempt) => retryDelayMs(attempt, null))).toEqual([2_000, 4_000, 8_000, 16_000]);
    expect(retryDelayMs(10, null)).toBe(30_000);
    expect(retryDelayMs(0, '5')).toBe(5_000);
    expect(retryDelayMs(0, '600')).toBe(30_000);
    expect(retryDelayMs(1, 'abc')).toBe(4_000);
  });
});
