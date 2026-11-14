/**
 * リクエストまわりの純粋ロジック（ブラウザ・ビルド・テストで共用）。
 * DOM や data/*.json に依存させないこと。
 */

export const REQUEST_STATUSES = ['received', 'making', 'done', 'declined'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  received: '受付',
  making: '制作中',
  done: 'できました',
  declined: '見送り',
};

/** まだ data/requests.json に載っていないリクエストの表示 */
export const PENDING_LABEL = '受け取りました';

// ---- 受付番号 ---------------------------------------------------------------

/** 読み間違えやすい 0/O・1/I/L を除いた文字 */
export const RECEIPT_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const RECEIPT_LENGTH = 4;
/** data/requests.json の id として許容する形式（手で採番したものも通す） */
export const RECEIPT_PATTERN = /^R-[0-9A-Z]{3,8}$/;

export function createReceiptId(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < RECEIPT_LENGTH; i++) {
    const index = Math.min(RECEIPT_ALPHABET.length - 1, Math.floor(random() * RECEIPT_ALPHABET.length));
    code += RECEIPT_ALPHABET[index];
  }
  return `R-${code}`;
}

// ---- リクエスト文の組み立て -------------------------------------------------

export interface RequestPick {
  label: string;
  values: string[];
}

export interface RequestReference {
  slug: string;
  title: string;
  variantLabel?: string;
}

export interface RequestDraft {
  picks: RequestPick[];
  note: string;
  reference?: RequestReference;
}

const activePicks = (draft: RequestDraft) => draft.picks.filter((p) => p.values.length > 0);

/** 何も書かず何も選んでいない（＝送信できない）状態か。参照作品だけあれば送信可 */
export function isDraftEmpty(draft: RequestDraft): boolean {
  return activePicks(draft).length === 0 && draft.note.trim() === '' && !draft.reference;
}

/**
 * 画面のプレビューと、メール本文の中身に使う文章。
 * 自由に書いた文章を先に、えらんだものをその下に並べる。
 */
export function composeRequestText(draft: RequestDraft): string {
  const written: string[] = [];
  if (draft.reference) {
    const variant = draft.reference.variantLabel ? `、${draft.reference.variantLabel}` : '';
    written.push(`「${draft.reference.title}」をベースに${variant}`);
  }
  const note = draft.note.trim();
  if (note) written.push(note);
  const picked = activePicks(draft).map((pick) => `${pick.label}: ${pick.values.join('、')}`);
  return [written.join('\n'), picked.join('\n')].filter(Boolean).join('\n\n');
}

export interface RequestMeta {
  receiptId: string;
  publishOk: boolean;
  nickname?: string;
}

/** メール本文の終わりの目印（管理ツール tools/manager が読み取りに使う） */
export const MESSAGE_END_MARK = '【以上】';

/** 作者に届くメール本文。管理ツール (tools/manager) に貼り付けて取り込める形にする */
export function composeRequestMessage(draft: RequestDraft, meta: RequestMeta): string {
  const lines = [
    `【受付番号】${meta.receiptId}`,
    `【サイト掲載】${meta.publishOk ? 'OK' : '掲載しない'}`,
  ];
  const nickname = meta.nickname?.trim();
  if (nickname) lines.push(`【ニックネーム】${nickname}`);
  if (draft.reference) lines.push(`【ベースの作品】${draft.reference.title} (${draft.reference.slug})`);
  lines.push('', '【リクエスト内容】', composeRequestText(draft), MESSAGE_END_MARK);
  return lines.join('\n');
}

/** 「あなたのリクエスト」に出す短い要約 */
export function summarizeDraft(draft: RequestDraft, maxLength = 36): string {
  const parts: string[] = [];
  if (draft.reference) parts.push(`「${draft.reference.title}」ベース`);
  const note = draft.note.trim().replace(/\s+/g, ' ');
  if (note) parts.push(note);
  for (const pick of activePicks(draft)) parts.push(...pick.values);
  const summary = parts.join('・');
  const chars = [...summary];
  return chars.length > maxLength ? `${chars.slice(0, maxLength - 1).join('')}…` : summary;
}

// ---- ブラウザに保存する「あなたのリクエスト」 -------------------------------

export const MY_REQUESTS_KEY = 'mopslipper_my_requests_v1';
export const MY_REQUESTS_MAX = 20;

export interface MyRequest {
  id: string;
  date: string;
  summary: string;
}

/** localStorage の値を安全に読む（壊れた値・他形式は捨てる） */
export function parseMyRequests(raw: string | null | undefined): MyRequest[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is MyRequest =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as MyRequest).id === 'string' &&
          RECEIPT_PATTERN.test((item as MyRequest).id) &&
          typeof (item as MyRequest).date === 'string',
      )
      .map((item) => ({
        id: item.id,
        date: item.date,
        summary: typeof item.summary === 'string' ? item.summary : '',
      }));
  } catch {
    return [];
  }
}

/** 新しいものを先頭に追加。同じ番号は置き換え、古いものは上限で捨てる */
export function addMyRequest(list: MyRequest[], item: MyRequest): MyRequest[] {
  return [item, ...list.filter((r) => r.id !== item.id)].slice(0, MY_REQUESTS_MAX);
}

/** ページに埋め込む、受付番号ごとの進み具合 */
export interface BoardEntry {
  status: RequestStatus;
  workTitle?: string;
  workUrl?: string;
}

export function describeMyRequest(entry: BoardEntry | undefined): { label: string; status: RequestStatus | 'pending' } {
  if (!entry) return { label: PENDING_LABEL, status: 'pending' };
  return { label: STATUS_LABELS[entry.status], status: entry.status };
}
