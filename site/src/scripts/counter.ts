/**
 * 作品詳細ページの閲覧数カウント + いいねボタン（Abacus API）。
 * - 閲覧数: ページロード毎に /hit でインクリメント
 * - いいね: /get で表示、ボタン押下で /hit（localStorage で押下済み記録、取消不可）
 *
 * Abacus はときどき応答しなくなる（タイムアウト・500）。その間も困らないように:
 * - 数は、取得できるまで HTML に書かれた前日までの集計値（data-snapshot）を出しておく
 * - いいねは、押したらすぐ「いいね済み」にして、送信は裏で行う。届かなかった分は控えておき
 *   （lib/likes.ts）、少し待って送り直す。それでも届かなければ、次に作品ページを開いたときに送り直す
 */
import { PENDING_LIKES_KEY, parsePendingLikes, addPendingLike, removePendingLike, likesToShow } from '../lib/likes';

const API = 'https://abacus.jasoncameron.dev';
const NAMESPACE = 'mopslipper-illustration-site';
/** 届かなかったいいねを、ページを開いている間に送り直すまでの待ち時間 */
const RETRY_DELAYS_MS = [10_000, 30_000, 60_000];

async function fetchValue(endpoint: 'hit' | 'get', key: string): Promise<number | null> {
  try {
    const res = await fetch(`${API}/${endpoint}/${NAMESPACE}/${key}`);
    if (res.status === 404) return 0;
    if (!res.ok) return null;
    const data = (await res.json()) as { value?: unknown };
    return typeof data.value === 'number' ? data.value : null;
  } catch {
    return null;
  }
}

const fmt = (n: number) => n.toLocaleString('ja-JP');

/** localStorage。使えない環境（プライベートブラウズなど）では、このページを開いている間だけ覚えておく */
const memory = new Map<string, string>();
const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string): void {
    memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      // 保存できなくても、このページの中では memory で動く
    }
  },
};

const readPending = () => parsePendingLikes(storage.get(PENDING_LIKES_KEY));
const writePending = (list: string[]) => storage.set(PENDING_LIKES_KEY, JSON.stringify(list));

/** HTML に書かれた前日までの集計値。無ければ null */
function snapshotOf(el: HTMLElement): number | null {
  const raw = el.dataset.snapshot;
  if (raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function initCounter(): void {
  const likeBtn = document.getElementById('like-btn') as HTMLButtonElement | null;
  const viewCount = document.getElementById('view-count');
  const likeCount = document.getElementById('like-count');
  const workId = likeBtn?.dataset.workId;
  if (!likeBtn || !viewCount || !likeCount || !workId) return;

  // 閲覧数（ページロード毎にカウント）。取得できなければ、HTML の集計値のまま
  void fetchValue('hit', `views-${workId}`).then((v) => {
    if (v !== null) viewCount.textContent = fmt(v);
  });

  // ---- いいね ----
  const likedKey = `liked-${workId}`;
  const isLiked = () => storage.get(likedKey) !== null;
  /** 分かっているいいね数。最初は集計値、サービスから取れたらその値（増える一方なので、大きいほうを残す） */
  let knownLikes = snapshotOf(likeCount);
  let liveLikes: number | null = null;
  const setLive = (value: number) => {
    liveLikes = liveLikes === null ? value : Math.max(liveLikes, value);
    knownLikes = liveLikes;
  };

  const render = () => {
    const liked = isLiked();
    const shown = likesToShow(knownLikes, { liked, pending: readPending().includes(workId) });
    likeCount.textContent = shown === null ? '–' : fmt(shown);
    likeBtn.disabled = liked;
    likeBtn.classList.toggle('liked', liked);
    likeBtn.title = liked ? 'いいね済み' : 'いいね';
  };

  /** 控えてあるいいねを1件送る。届いたら控えから外す */
  const sendLike = async (id: string): Promise<boolean> => {
    const value = await fetchValue('hit', `likes-${id}`);
    if (value === null) return false;
    writePending(removePendingLike(readPending(), id));
    if (id === workId) setLive(value);
    render();
    return true;
  };

  const inFlight = new Set<string>();
  let retries = 0;
  /** まだ届いていないいいね（ほかの作品の分も含む）を送る。届かなければ、少し待ってもう一度 */
  const flush = async (): Promise<void> => {
    const ids = readPending().filter((id) => !inFlight.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => inFlight.add(id));
    const results = await Promise.all(ids.map(sendLike));
    ids.forEach((id) => inFlight.delete(id));
    if (results.includes(false) && retries < RETRY_DELAYS_MS.length) {
      setTimeout(() => void flush(), RETRY_DELAYS_MS[retries++]);
    }
  };

  likeBtn.addEventListener('click', () => {
    if (isLiked()) return;
    // 先に「いいね済み」にして、送信は裏で行う（サービスの応答を待たせない）
    storage.set(likedKey, '1');
    writePending(addPendingLike(readPending(), workId));
    render();
    void flush();
  });

  render();
  void fetchValue('get', `likes-${workId}`).then((v) => {
    if (v !== null) {
      setLive(v);
      render();
    }
  });
  // 前に届かなかった分があれば、いま送る
  void flush();
}