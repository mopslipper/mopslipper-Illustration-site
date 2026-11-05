import {
  STORAGE_KEY,
  createRequest,
  fileStamp,
  mergeRequests,
  parseRequests,
  sortRequests,
  toBackup,
  type RequestMemo,
} from './dev-requests-store';
import { canvasToPngBlob, renderMarshmallow } from './marshmallow-image';

const root = document.getElementById('dev-requests') as HTMLElement;
const siteName = root.dataset.siteName ?? '';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const textEl = $<HTMLTextAreaElement>('req-text');
const countEl = $('req-count');
const modeEl = $('req-mode');
const statusEl = $('req-status');
const saveBtn = $<HTMLButtonElement>('req-save');
const newBtn = $<HTMLButtonElement>('req-new');
const preview = $<HTMLCanvasElement>('req-preview');
const truncatedEl = $('req-truncated');
const downloadBtn = $<HTMLButtonElement>('req-download');
const copyBtn = $<HTMLButtonElement>('req-copy');
const listEl = $<HTMLUListElement>('req-list');
const emptyEl = $('req-empty');
const exportBtn = $<HTMLButtonElement>('req-export');
const importBtn = $<HTMLButtonElement>('req-import');
const importFile = $<HTMLInputElement>('req-import-file');

let requests: RequestMemo[] = load();
let editingId: string | null = null;

function load(): RequestMemo[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return sortRequests(parseRequests(raw));
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

let statusTimer: number | undefined;
function flash(message: string) {
  statusEl.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => (statusEl.textContent = ''), 3000);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
}

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function downloadPng(text: string, date: Date) {
  const canvas = document.createElement('canvas');
  await renderMarshmallow(canvas, text, { siteName });
  triggerDownload(await canvasToPngBlob(canvas), `request-${fileStamp(date)}.png`);
}

// ---------- エディタ ----------

function updateEditorState() {
  const hasText = textEl.value.trim().length > 0;
  countEl.textContent = `${Array.from(textEl.value).length} 文字`;
  saveBtn.disabled = !hasText;
  downloadBtn.disabled = !hasText;
  copyBtn.disabled = !hasText;
  modeEl.textContent = editingId ? '編集中' : '新規';
  saveBtn.textContent = editingId ? '更新' : '保存';
}

let previewTimer: number | undefined;
let previewSeq = 0;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(async () => {
    const seq = ++previewSeq;
    const off = document.createElement('canvas');
    const fit = await renderMarshmallow(off, textEl.value, { siteName });
    if (seq !== previewSeq) return;
    preview.getContext('2d')?.drawImage(off, 0, 0);
    truncatedEl.hidden = !fit.truncated;
  }, 150);
}

function setEditor(text: string, id: string | null) {
  textEl.value = text;
  editingId = id;
  updateEditorState();
  schedulePreview();
  renderList();
}

textEl.addEventListener('input', () => {
  updateEditorState();
  schedulePreview();
});

saveBtn.addEventListener('click', () => {
  const text = textEl.value.trim();
  if (!text) return;
  if (editingId) {
    requests = requests.map((r) => (r.id === editingId ? { ...r, text, updatedAt: new Date().toISOString() } : r));
    flash('更新しました');
  } else {
    const memo = createRequest(text);
    requests = sortRequests([memo, ...requests]);
    editingId = memo.id;
    flash('保存しました');
  }
  persist();
  setEditor(text, editingId);
});

newBtn.addEventListener('click', () => {
  setEditor('', null);
  textEl.focus();
});

downloadBtn.addEventListener('click', async () => {
  const memo = requests.find((r) => r.id === editingId);
  await downloadPng(textEl.value, memo ? new Date(memo.createdAt) : new Date());
});

copyBtn.addEventListener('click', async () => {
  try {
    const canvas = document.createElement('canvas');
    await renderMarshmallow(canvas, textEl.value, { siteName });
    const blob = await canvasToPngBlob(canvas);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    flash('画像をクリップボードにコピーしました');
  } catch (e) {
    flash(`コピーに失敗しました: ${(e as Error).message}`);
  }
});

// ---------- 一覧 ----------

function renderList() {
  listEl.replaceChildren();
  emptyEl.hidden = requests.length > 0;

  for (const r of requests) {
    const li = document.createElement('li');
    li.className = 'req-item' + (r.id === editingId ? ' is-active' : '');

    const meta = document.createElement('div');
    meta.className = 'req-item-meta';
    meta.textContent = formatDate(r.createdAt) + (r.updatedAt !== r.createdAt ? `（更新 ${formatDate(r.updatedAt)}）` : '');

    const body = document.createElement('p');
    body.className = 'req-item-text';
    body.textContent = r.text;

    const actions = document.createElement('div');
    actions.className = 'req-item-actions';
    const mk = (label: string, cls: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn btn-small ${cls}`;
      b.textContent = label;
      b.addEventListener('click', onClick);
      actions.append(b);
    };
    mk('編集', 'btn-outline', () => {
      setEditor(r.text, r.id);
      textEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    mk('画像出力', 'btn-primary', () => void downloadPng(r.text, new Date(r.createdAt)));
    mk('削除', 'btn-danger', () => {
      if (!confirm('このリクエストを削除しますか？')) return;
      requests = requests.filter((x) => x.id !== r.id);
      persist();
      if (editingId === r.id) setEditor('', null);
      else renderList();
      flash('削除しました');
    });

    li.append(meta, body, actions);
    listEl.append(li);
  }
}

// ---------- バックアップ ----------

exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(toBackup(requests), null, 2)], { type: 'application/json' });
  triggerDownload(blob, `requests-backup-${fileStamp(new Date())}.json`);
});

importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  importFile.value = '';
  if (!file) return;
  try {
    const incoming = parseRequests(await file.text());
    const before = requests.length;
    requests = mergeRequests(requests, incoming);
    persist();
    renderList();
    flash(`${incoming.length} 件を読み込みました（新規 ${requests.length - before} 件）`);
  } catch (e) {
    flash(`読み込みに失敗しました: ${(e as Error).message}`);
  }
});

setEditor('', null);
