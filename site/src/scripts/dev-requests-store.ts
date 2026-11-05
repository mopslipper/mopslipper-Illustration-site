/** 開発者向けリクエストメモの保存形式（localStorage / JSON バックアップ共通） */

export const STORAGE_KEY = 'mopslipper_dev_requests_v1';
export const BACKUP_VERSION = 1;

export interface RequestMemo {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestBackup {
  version: number;
  exportedAt: string;
  requests: RequestMemo[];
}

function isMemo(v: unknown): v is RequestMemo {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    m.id.length > 0 &&
    typeof m.text === 'string' &&
    typeof m.createdAt === 'string' &&
    typeof m.updatedAt === 'string'
  );
}

/** 配列 or バックアップ形式のどちらでも受け付ける。不正な要素は除外 */
export function parseRequests(json: string): RequestMemo[] {
  const data: unknown = JSON.parse(json);
  const list = Array.isArray(data) ? data : (data as Partial<RequestBackup> | null)?.requests;
  if (!Array.isArray(list)) throw new Error('リクエストの一覧が見つかりません');
  return list.filter(isMemo);
}

export function toBackup(requests: RequestMemo[], now = new Date()): RequestBackup {
  return { version: BACKUP_VERSION, exportedAt: now.toISOString(), requests };
}

/** id 単位でマージ。同じ id は updatedAt が新しい方を採用。新しい順に並べる */
export function mergeRequests(current: RequestMemo[], incoming: RequestMemo[]): RequestMemo[] {
  const map = new Map(current.map((r) => [r.id, r]));
  for (const r of incoming) {
    const existing = map.get(r.id);
    if (!existing || r.updatedAt > existing.updatedAt) map.set(r.id, r);
  }
  return sortRequests([...map.values()]);
}

export function sortRequests(requests: RequestMemo[]): RequestMemo[] {
  return [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createRequest(text: string, now = new Date()): RequestMemo {
  const iso = now.toISOString();
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${now.getTime()}-${Math.random().toString(36).slice(2)}`;
  return { id, text, createdAt: iso, updatedAt: iso };
}

/** ファイル名用: 20261105-2135 */
export function fileStamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
}
