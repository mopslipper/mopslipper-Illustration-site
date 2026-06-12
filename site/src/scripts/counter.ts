/**
 * 作品詳細ページの閲覧数カウント + いいねボタン（Abacus API）。
 * - 閲覧数: ページロード毎に /hit でインクリメント
 * - いいね: /get で表示、ボタン押下で /hit（localStorage で押下済み記録、取消不可）
 */
const API = 'https://abacus.jasoncameron.dev';
const NAMESPACE = 'mopslipper-illustration-site';

async function fetchValue(endpoint: 'hit' | 'get', key: string): Promise<number | null> {
  try {
    const res = await fetch(`${API}/${endpoint}/${NAMESPACE}/${key}`);
    if (res.status === 404) return 0;
    if (!res.ok) return null;
    const data = (await res.json()) as { value: number };
    return data.value;
  } catch {
    return null;
  }
}

const fmt = (n: number) => n.toLocaleString('ja-JP');

export function initCounter(): void {
  const likeBtn = document.getElementById('like-btn') as HTMLButtonElement | null;
  const viewCount = document.getElementById('view-count');
  const likeCount = document.getElementById('like-count');
  const workId = likeBtn?.dataset.workId;
  if (!likeBtn || !viewCount || !likeCount || !workId) return;

  // 閲覧数（ページロード毎にカウント）
  void fetchValue('hit', `views-${workId}`).then((v) => {
    if (v !== null) viewCount.textContent = fmt(v);
  });

  // いいね数の表示
  void fetchValue('get', `likes-${workId}`).then((v) => {
    if (v !== null) likeCount.textContent = fmt(v);
  });

  const likedKey = `liked-${workId}`;
  const setLiked = () => {
    likeBtn.disabled = true;
    likeBtn.classList.add('liked');
    likeBtn.title = 'いいね済み';
  };

  if (localStorage.getItem(likedKey)) {
    setLiked();
  } else {
    likeBtn.addEventListener('click', async () => {
      likeBtn.disabled = true; // 二重送信防止
      const v = await fetchValue('hit', `likes-${workId}`);
      if (v === null) {
        likeBtn.disabled = false;
        return;
      }
      likeCount.textContent = fmt(v);
      localStorage.setItem(likedKey, '1');
      setLiked();
    });
  }
}
