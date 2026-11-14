/**
 * リクエスト・ギャラリー・関連作品の純粋ロジックのテスト。
 */
import { describe, it, expect } from 'vitest';
import {
  createReceiptId,
  RECEIPT_ALPHABET,
  RECEIPT_PATTERN,
  composeRequestText,
  composeRequestMessage,
  isDraftEmpty,
  summarizeDraft,
  parseMyRequests,
  addMyRequest,
  describeMyRequest,
  MY_REQUESTS_MAX,
  type RequestDraft,
} from '../../src/lib/request';
import {
  parseGalleryParams,
  serializeGalleryParams,
  matchesFilter,
  isFiltered,
  EMPTY_FILTER,
} from '../../src/lib/gallery-params';
import { relatedWorks } from '../../src/lib/related';

const CATEGORIES = ['Original', 'Fanart', 'Animation'];

describe('受付番号', () => {
  it('R-XXXX 形式で、紛らわしい文字を含まない', () => {
    for (let i = 0; i < 200; i++) {
      const id = createReceiptId();
      expect(id).toMatch(/^R-[2-9A-HJKMNP-Z]{4}$/);
      expect(id).toMatch(RECEIPT_PATTERN);
    }
  });

  it('乱数の両端でも範囲外にならない', () => {
    const first = RECEIPT_ALPHABET[0];
    const last = RECEIPT_ALPHABET[RECEIPT_ALPHABET.length - 1];
    expect(createReceiptId(() => 0)).toBe(`R-${first.repeat(4)}`);
    expect(createReceiptId(() => 0.999999)).toBe(`R-${last.repeat(4)}`);
    expect(createReceiptId(() => 1)).toBe(`R-${last.repeat(4)}`);
  });
});

describe('リクエスト文の組み立て', () => {
  const draft: RequestDraft = {
    picks: [
      { label: 'どんな子？', values: ['ネコミミ', 'キツネ'] },
      { label: '服装', values: [] },
      { label: '髪・色', values: ['白髪'] },
    ],
    note: '  雨の日に傘をさしている感じで  ',
  };

  it('自由に書いた文章を先に、えらんだグループをその下に並べる', () => {
    expect(composeRequestText(draft)).toBe(
      ['雨の日に傘をさしている感じで', '', 'どんな子？: ネコミミ、キツネ', '髪・色: 白髪'].join('\n'),
    );
  });

  it('文章だけ・えらんだものだけでも成り立つ', () => {
    expect(composeRequestText({ picks: draft.picks, note: '' })).toBe('どんな子？: ネコミミ、キツネ\n髪・色: 白髪');
    expect(composeRequestText({ picks: [], note: '1行目\n2行目' })).toBe('1行目\n2行目');
  });

  it('参照作品とバリエーションを先頭に入れる', () => {
    const text = composeRequestText({
      picks: [],
      note: '',
      reference: { slug: '144', title: 'からっぽシャツの白髪狐っ娘', variantLabel: '別の衣装で' },
    });
    expect(text).toBe('「からっぽシャツの白髪狐っ娘」をベースに、別の衣装で');
    expect(
      composeRequestText({ picks: draft.picks, note: 'メイド服で', reference: { slug: '144', title: '狐っ娘' } }),
    ).toBe('「狐っ娘」をベースに\nメイド服で\n\nどんな子？: ネコミミ、キツネ\n髪・色: 白髪');
  });

  it('メール本文には受付番号・掲載可否・参照作品の slug が入る', () => {
    const message = composeRequestMessage(
      { ...draft, reference: { slug: '144', title: '狐っ娘' } },
      { receiptId: 'R-7K2M', publishOk: true, nickname: ' もふ ' },
    );
    expect(message).toContain('【受付番号】R-7K2M');
    expect(message).toContain('【サイト掲載】OK');
    expect(message).toContain('【ニックネーム】もふ');
    expect(message).toContain('【ベースの作品】狐っ娘 (144)');
    expect(message).toContain('どんな子？: ネコミミ、キツネ');
  });

  it('掲載に同意していなければ、その旨が明記される', () => {
    const message = composeRequestMessage(draft, { receiptId: 'R-7K2M', publishOk: false });
    expect(message).toContain('【サイト掲載】掲載しない');
    expect(message).not.toContain('【ニックネーム】');
  });

  it('空の下書きを判定する', () => {
    expect(isDraftEmpty({ picks: [{ label: '服装', values: [] }], note: '   ' })).toBe(true);
    expect(isDraftEmpty({ picks: [{ label: '服装', values: ['シャツ'] }], note: '' })).toBe(false);
    expect(isDraftEmpty({ picks: [], note: 'おまかせ' })).toBe(false);
    expect(isDraftEmpty({ picks: [], note: '', reference: { slug: '1', title: 'a' } })).toBe(false);
  });

  it('要約は書いた文章が先。長すぎるときは省略する', () => {
    expect(summarizeDraft(draft, 100)).toBe('雨の日に傘をさしている感じで・ネコミミ・キツネ・白髪');
    const short = summarizeDraft(draft, 10);
    expect([...short].length).toBe(10);
    expect(short.endsWith('…')).toBe(true);
  });
});

describe('あなたのリクエスト（ブラウザ保存）', () => {
  it('壊れた値・形式違いは捨てる', () => {
    expect(parseMyRequests(null)).toEqual([]);
    expect(parseMyRequests('not json')).toEqual([]);
    expect(parseMyRequests('{"id":"R-7K2M"}')).toEqual([]);
    expect(
      parseMyRequests(
        JSON.stringify([
          { id: 'R-7K2M', date: '2026-11-14', summary: 'ネコミミ' },
          { id: '<script>', date: '2026-11-14', summary: 'x' },
          { id: 'R-ABCD', date: '2026-11-15' },
          null,
        ]),
      ),
    ).toEqual([
      { id: 'R-7K2M', date: '2026-11-14', summary: 'ネコミミ' },
      { id: 'R-ABCD', date: '2026-11-15', summary: '' },
    ]);
  });

  it('新しいものを先頭に追加し、同じ番号は重複させず、上限を超えない', () => {
    const a = { id: 'R-AAAA', date: '2026-11-01', summary: 'a' };
    const b = { id: 'R-BBBB', date: '2026-11-02', summary: 'b' };
    expect(addMyRequest([a], b)).toEqual([b, a]);
    expect(addMyRequest([b, a], { ...a, summary: 'a2' })).toEqual([{ ...a, summary: 'a2' }, b]);

    const many = Array.from({ length: MY_REQUESTS_MAX }, (_, i) => ({
      id: `R-${String(1000 + i)}`,
      date: '2026-11-01',
      summary: '',
    }));
    const result = addMyRequest(many, b);
    expect(result).toHaveLength(MY_REQUESTS_MAX);
    expect(result[0]).toEqual(b);
  });

  it('未掲載は「受け取りました」、掲載後は進み具合を返す', () => {
    expect(describeMyRequest(undefined)).toEqual({ label: '受け取りました', status: 'pending' });
    expect(describeMyRequest({ status: 'making' })).toEqual({ label: '制作中', status: 'making' });
    expect(describeMyRequest({ status: 'done', workUrl: '/works/144.html' }).label).toBe('できました');
  });
});

describe('ギャラリーの URL パラメータ', () => {
  it('URL から絞り込み条件を読む', () => {
    const filter = parseGalleryParams('?tag=%E3%83%8D%E3%82%B3%E3%83%9F%E3%83%9F&category=Original&q=%20cat%20&r15=1&page=2', CATEGORIES);
    expect(filter).toEqual({ category: 'Original', tag: 'ネコミミ', query: 'cat', r15Only: true, page: 2 });
  });

  it('不正な値は既定値に戻す', () => {
    expect(parseGalleryParams('?category=Unknown&page=-3&r15=yes', CATEGORIES)).toEqual(EMPTY_FILTER);
    expect(parseGalleryParams('', CATEGORIES)).toEqual(EMPTY_FILTER);
  });

  it('既定値は URL に出さず、往復しても変わらない', () => {
    expect(serializeGalleryParams(EMPTY_FILTER)).toBe('');
    const filter = { category: 'Animation', tag: '巫女', query: '白 髪', r15Only: true, page: 3 };
    expect(parseGalleryParams(serializeGalleryParams(filter), CATEGORIES)).toEqual(filter);
  });

  it('条件に合う作品だけを通す', () => {
    const item = { category: 'Original', tags: ['オリジナル', 'ネコミミ'], title: '猫耳少女', description: 'ふわふわ', sensitive: false };
    expect(matchesFilter(item, EMPTY_FILTER)).toBe(true);
    expect(matchesFilter(item, { ...EMPTY_FILTER, tag: 'ネコミミ' })).toBe(true);
    expect(matchesFilter(item, { ...EMPTY_FILTER, tag: 'ネコ' })).toBe(false);
    expect(matchesFilter(item, { ...EMPTY_FILTER, query: 'ネコ' })).toBe(true);
    expect(matchesFilter(item, { ...EMPTY_FILTER, query: 'ふわ' })).toBe(true);
    expect(matchesFilter(item, { ...EMPTY_FILTER, category: 'Fanart' })).toBe(false);
    expect(matchesFilter(item, { ...EMPTY_FILTER, r15Only: true })).toBe(false);
    expect(matchesFilter({ ...item, sensitive: true }, { ...EMPTY_FILTER, r15Only: true })).toBe(true);
  });

  it('R-15 作品は絞り込まなくても通常どおり表示される', () => {
    const item = { category: 'Original', tags: [], title: 't', description: '', sensitive: true };
    expect(matchesFilter(item, EMPTY_FILTER)).toBe(true);
    expect(isFiltered(EMPTY_FILTER)).toBe(false);
    expect(isFiltered({ ...EMPTY_FILTER, page: 2 })).toBe(false);
    expect(isFiltered({ ...EMPTY_FILTER, r15Only: true })).toBe(true);
  });
});

describe('似た雰囲気の作品', () => {
  const works = [
    { slug: 'a', date: '2026-01-01', tags: ['オリジナル', 'ネコミミ', '巫女'] },
    { slug: 'b', date: '2026-01-02', tags: ['オリジナル', 'ネコミミ'] },
    { slug: 'c', date: '2026-01-03', tags: ['オリジナル', 'ネコミミ', '巫女'] },
    { slug: 'd', date: '2026-01-04', tags: ['オリジナル', '天使'] },
    { slug: 'e', date: '2026-01-05', tags: ['オリジナル', 'ネコミミ'] },
  ];

  it('共通タグが多い順、同点なら新しい順。自分自身は含まない', () => {
    expect(relatedWorks(works[0], works).map((w) => w.slug)).toEqual(['c', 'e', 'b']);
  });

  it('「オリジナル」だけの一致は似ているとみなさない', () => {
    expect(relatedWorks(works[3], works)).toEqual([]);
  });

  it('件数の上限を守る', () => {
    expect(relatedWorks(works[0], works, 2).map((w) => w.slug)).toEqual(['c', 'e']);
  });
});
