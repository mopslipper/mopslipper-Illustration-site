/**
 * いいねの純粋ロジック。
 *
 * いいねを数える外部サービス（Abacus）は、ときどき応答しなくなる。その間に押されたいいねを失わないよう、
 * 「押したが、まだサービスに届いていない」作品 ID をブラウザに控えておき、あとで送り直す。
 */

/** まだ届いていないいいね（作品 ID の一覧）を保存する localStorage のキー */
export const PENDING_LIKES_KEY = 'mopslipper_pending_likes_v1';

const MAX_PENDING = 50;

/** localStorage の中身を読む。壊れている・想定外の値は捨てる */
export function parsePendingLikes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const ids = list.filter((value): value is string => typeof value === 'string' && /^\d{1,6}$/.test(value));
    return [...new Set(ids)].slice(-MAX_PENDING);
  } catch {
    return [];
  }
}

export function addPendingLike(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

export function removePendingLike(list: string[], id: string): string[] {
  return list.filter((value) => value !== id);
}

/**
 * 画面に出すいいね数。
 * @param known 分かっている数（サービスの値。取得できなければ前日までの集計値。どちらも無ければ null）
 * @param state liked: このブラウザで押したか / pending: その1件がまだサービスに届いていないか
 * @returns 表示する数。分からなければ null（「–」を出す）
 */
export function likesToShow(known: number | null, state: { liked: boolean; pending: boolean }): number | null {
  // 自分が押したなら、少なくとも 1 はある
  const floor = state.liked ? 1 : 0;
  if (known === null) return state.liked ? floor : null;
  return Math.max(known + (state.pending ? 1 : 0), floor);
}
