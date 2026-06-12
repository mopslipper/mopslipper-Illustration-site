/**
 * 限定共有ビューア（旧 cliantshare.html の機能を AES-GCM 方式で再実装）
 * - パスワードは verify.enc の復号成功で検証（ページに埋め込まない）
 * - パスワードはメモリ内のみ保持（保存しない）
 * - ディレクトリ選択 → 全画像を復号して blob URL でビューア表示
 * - サムネイル / 前後ナビ / ←→ キー操作 / 単体・一括ダウンロード
 */
import { decrypt, verifyPassword } from './cliantshare-crypto';

interface ShareDirectory {
  name: string;
  display_name: string;
  count: number;
  files: string[];
}

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

function mimeFor(encName: string): string {
  // "image01.png.enc" → png
  const ext = encName.replace(/\.enc$/, '').split('.').pop()?.toLowerCase() ?? 'png';
  return MIME_MAP[ext] ?? 'image/png';
}

export function initCliantShare(): void {
  const dataEl = document.getElementById('cliantshare-data');
  if (!dataEl) return;
  const directories: ShareDirectory[] = JSON.parse(dataEl.textContent ?? '[]');

  const baseUrl = `${(import.meta.env.BASE_URL as string).replace(/\/$/, '')}/cliantshare`;

  const $ = (id: string) => document.getElementById(id)!;
  const passwordScreen = $('password-screen');
  const directoryScreen = $('directory-screen');
  const viewerScreen = $('viewer-screen');
  const loadingScreen = $('loading-screen');
  const loadingText = $('loading-text');
  const passwordError = $('password-error');
  const passwordInput = $('password-input') as HTMLInputElement;
  const currentImage = $('current-image') as HTMLImageElement;
  const imageCounter = $('image-counter');
  const thumbnailStrip = $('thumbnail-strip');
  const prevBtn = $('prev-btn') as HTMLButtonElement;
  const nextBtn = $('next-btn') as HTMLButtonElement;
  const progressBox = $('download-progress');
  const progressText = $('progress-text');

  let password = ''; // メモリ内のみ。localStorage には保存しない
  let images: { url: string; name: string }[] = [];
  let currentIndex = 0;

  // ---- 認証 ----
  $('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    passwordError.hidden = true;
    const candidate = passwordInput.value;
    if (!candidate) return;

    const res = await fetch(`${baseUrl}/verify.enc`);
    if (!res.ok || !(await verifyPassword(await res.arrayBuffer(), candidate))) {
      passwordError.hidden = false;
      passwordInput.value = '';
      passwordInput.focus();
      return;
    }
    password = candidate;
    passwordInput.value = '';
    passwordScreen.hidden = true;
    directoryScreen.hidden = false;
  });

  const logout = () => {
    password = '';
    releaseImages();
    directoryScreen.hidden = true;
    viewerScreen.hidden = true;
    passwordScreen.hidden = false;
  };
  $('logout-btn').addEventListener('click', logout);

  // ---- ディレクトリ → ビューア ----
  function releaseImages(): void {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    images = [];
  }

  document.querySelectorAll<HTMLButtonElement>('.directory-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const dir = directories.find((d) => d.name === card.dataset.directory);
      if (!dir) return;

      directoryScreen.hidden = true;
      loadingScreen.hidden = false;
      releaseImages();

      for (let i = 0; i < dir.files.length; i++) {
        loadingText.textContent = `画像を読み込み中… (${i + 1}/${dir.files.length})`;
        const file = dir.files[i]!;
        try {
          const res = await fetch(`${baseUrl}/${dir.name}/${file}`);
          if (!res.ok) continue;
          const plain = await decrypt(await res.arrayBuffer(), password);
          const blob = new Blob([plain as BlobPart], { type: mimeFor(file) });
          images.push({ url: URL.createObjectURL(blob), name: file.replace(/\.enc$/, '') });
        } catch {
          // 個別の復号失敗はスキップ
        }
      }

      loadingScreen.hidden = true;
      if (images.length === 0) {
        directoryScreen.hidden = false;
        return;
      }
      $('current-directory-name').textContent = dir.display_name;
      viewerScreen.hidden = false;
      buildThumbnails();
      showImage(0);
    });
  });

  $('back-btn').addEventListener('click', () => {
    releaseImages();
    viewerScreen.hidden = true;
    directoryScreen.hidden = false;
  });

  // ---- 表示 ----
  function buildThumbnails(): void {
    thumbnailStrip.innerHTML = '';
    images.forEach((img, i) => {
      const btn = document.createElement('button');
      const thumb = document.createElement('img');
      thumb.src = img.url;
      thumb.alt = `Image ${i + 1}`;
      btn.appendChild(thumb);
      btn.addEventListener('click', () => showImage(i));
      thumbnailStrip.appendChild(btn);
    });
  }

  function showImage(index: number): void {
    if (index < 0 || index >= images.length) return;
    currentIndex = index;
    currentImage.src = images[index]!.url;
    imageCounter.textContent = `${index + 1} / ${images.length}`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === images.length - 1;
    [...thumbnailStrip.children].forEach((el, i) => el.classList.toggle('active', i === index));
    thumbnailStrip.children[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }

  prevBtn.addEventListener('click', () => showImage(currentIndex - 1));
  nextBtn.addEventListener('click', () => showImage(currentIndex + 1));

  document.addEventListener('keydown', (e) => {
    if (viewerScreen.hidden) return;
    if (e.key === 'ArrowLeft') showImage(currentIndex - 1);
    if (e.key === 'ArrowRight') showImage(currentIndex + 1);
  });

  // ---- ダウンロード ----
  function downloadImage(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }

  $('download-current').addEventListener('click', () => {
    const img = images[currentIndex];
    if (img) downloadImage(img.url, img.name);
  });

  $('download-all').addEventListener('click', async () => {
    progressBox.hidden = false;
    for (let i = 0; i < images.length; i++) {
      downloadImage(images[i]!.url, images[i]!.name);
      progressText.textContent = `ダウンロード中… (${i + 1}/${images.length})`;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    progressText.textContent = '✓ ダウンロード完了！';
    setTimeout(() => {
      progressBox.hidden = true;
    }, 2000);
  });
}
