/**
 * 閲覧数・いいね数の集計（data/counts.json）の純粋ロジック。tools/fetch_counts.mjs から使う。
 *
 * Abacus はときどき 500 やタイムアウトを返すため:
 * - 取れなかった数は、前回の集計値を残す（1件の失敗で全体を止めない）
 * - 閲覧数・いいね数は増える一方なので、前回より小さい値では上書きしない
 */

/** 送り直す価値のある応答か（混雑・サーバ側の一時的な失敗） */
export function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

/** 何回目の送り直しで、どれだけ待つか（ミリ秒）。Retry-After があればそれを優先する */
export function retryDelayMs(attempt, retryAfterHeader, baseMs = 2_000, maxMs = 30_000) {
  const retryAfter = Number(retryAfterHeader);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1_000, maxMs);
  return Math.min(baseMs * 2 ** attempt, maxMs);
}

const toCount = (value) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null);

/**
 * 今回取れた値と前回の集計を合わせて、新しい counts.json を作る。
 * @param {number[]} ids 作品 ID（works.json の順）
 * @param {Record<string, { views?: number, likes?: number }>} previous 前回の counts.json
 * @param {Map<string, number | null>} fetched `views-{id}` / `likes-{id}` → 取れた値（取れなければ null）
 * @returns {{ counts: Record<string, { views: number, likes: number }>, failed: string[], kept: string[] }}
 *   failed: 取れなかったキー / kept: 取れなかったので前回の値を残したキー
 */
export function mergeCounts(ids, previous, fetched) {
  const counts = {};
  const failed = [];
  const kept = [];
  for (const id of ids) {
    const before = previous?.[id] ?? {};
    const entry = {};
    for (const field of ['views', 'likes']) {
      const key = `${field}-${id}`;
      const now = toCount(fetched.get(key));
      const old = toCount(before[field]);
      if (now === null) {
        failed.push(key);
        if (old !== null) kept.push(key);
      }
      entry[field] = Math.max(now ?? 0, old ?? 0);
    }
    counts[id] = entry;
  }
  return { counts, failed, kept };
}
