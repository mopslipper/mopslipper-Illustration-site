/**
 * 開発者向けリクエストメモ: マシュマロ風画像のレイアウト計算と保存形式の契約テスト
 * measure は「1文字 = フォントサイズ px」の等幅モデルで代用する
 */
import { describe, it, expect } from 'vitest';
import { wrapText, fitText, ellipsize, type Measure } from '../../src/scripts/marshmallow-image';
import { parseRequests, mergeRequests, toBackup, fileStamp, type RequestMemo } from '../../src/scripts/dev-requests-store';

const mono = (size = 10): Measure => (s) => Array.from(s).length * size;

describe('wrapText', () => {
  it('文字単位で折り返し、改行を保持する', () => {
    expect(wrapText('あいうえおかきくけこ\nさし', 40, mono())).toEqual(['あいうえ', 'おかきく', 'けこ', 'さし']);
  });

  it('空行・CRLF を保持する', () => {
    expect(wrapText('あ\r\n\r\nい', 100, mono())).toEqual(['あ', '', 'い']);
  });

  it('行頭禁則文字は前の行にぶら下げる', () => {
    expect(wrapText('あいうえ。かき', 40, mono())).toEqual(['あいうえ。', 'かき']);
  });

  it('ぶら下げは最大2文字まで', () => {
    expect(wrapText('あいうえ」」」か', 40, mono())).toEqual(['あいうえ」」', '」か']);
  });

  it('開き括弧で行を終えない', () => {
    expect(wrapText('あいう「えお」', 40, mono())).toEqual(['あいう', '「えお」']);
  });

  it('英単語の途中で折り返さない', () => {
    expect(wrapText('I like mopslipper', 100, mono())).toEqual(['I like', 'mopslipper']);
  });

  it('1行に収まらない長い英単語は文字単位で折る', () => {
    expect(wrapText('abcdefghij', 40, mono())).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('サロゲートペア（絵文字）を分割しない', () => {
    expect(wrapText('😀😀😀', 20, mono())).toEqual(['😀😀', '😀']);
  });
});

describe('fitText', () => {
  const opts = { maxWidth: 200, maxHeight: 100, maxFontSize: 40, minFontSize: 10, lineHeight: 1 };

  it('短文は最大フォントサイズで収める', () => {
    const r = fitText('あいう', opts, mono);
    expect(r).toEqual({ fontSize: 40, lines: ['あいう'], truncated: false });
  });

  it('長文はフォントを縮小して収める', () => {
    const r = fitText('あ'.repeat(30), opts, mono);
    expect(r.truncated).toBe(false);
    expect(r.fontSize).toBeLessThan(40);
    expect(r.lines.length * r.fontSize).toBeLessThanOrEqual(100);
    expect(r.lines.join('')).toBe('あ'.repeat(30));
  });

  it('最小サイズでも溢れる場合は末尾を…で省略する', () => {
    const r = fitText('あ'.repeat(500), opts, mono);
    expect(r.truncated).toBe(true);
    expect(r.fontSize).toBe(10);
    expect(r.lines).toHaveLength(10);
    expect(r.lines[9].endsWith('…')).toBe(true);
    expect(mono(10)(r.lines[9])).toBeLessThanOrEqual(200);
  });

  it('前後の空白は無視する', () => {
    expect(fitText('\n\n  あ  \n', opts, mono).lines).toEqual(['あ']);
  });
});

describe('ellipsize', () => {
  it('… を含めて幅に収める', () => {
    expect(ellipsize('あいうえお', 30, mono())).toBe('あい…');
  });
});

describe('dev-requests-store', () => {
  const a: RequestMemo = { id: 'a', text: 'A', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
  const b: RequestMemo = { id: 'b', text: 'B', createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' };

  it('バックアップ形式と配列形式の両方を読み込める', () => {
    expect(parseRequests(JSON.stringify(toBackup([a])))).toEqual([a]);
    expect(parseRequests(JSON.stringify([a, { id: 1 }]))).toEqual([a]);
  });

  it('不正な JSON はエラー', () => {
    expect(() => parseRequests('{"foo":1}')).toThrow();
    expect(() => parseRequests('not json')).toThrow();
  });

  it('id 単位でマージし、更新日時が新しい方を残して新しい順に並べる', () => {
    const aNew = { ...a, text: 'A2', updatedAt: '2026-03-01T00:00:00.000Z' };
    expect(mergeRequests([a], [b, aNew])).toEqual([b, aNew]);
    expect(mergeRequests([aNew], [a])).toEqual([aNew]);
  });

  it('fileStamp はローカル時刻の YYYYMMDD-HHmm', () => {
    expect(fileStamp(new Date(2026, 10, 5, 9, 7))).toBe('20261105-0907');
  });
});
