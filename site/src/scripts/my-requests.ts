/**
 * 「あなたのリクエスト」: このブラウザから送ったリクエストの受付番号を localStorage に保存し、
 * ページに埋め込まれた進み具合（data/requests.json 由来）と照合して静かに表示する。
 * 番号と要約はこの端末の中にだけあり、どこにも送信しない。
 */
import {
  MY_REQUESTS_KEY,
  parseMyRequests,
  addMyRequest,
  describeMyRequest,
  type MyRequest,
  type BoardEntry,
} from '../lib/request';

export function readMyRequests(): MyRequest[] {
  try {
    return parseMyRequests(localStorage.getItem(MY_REQUESTS_KEY));
  } catch {
    return [];
  }
}

/** 保存できたら true（プライベートブラウズ等で保存できない場合は false） */
export function saveMyRequest(item: MyRequest): boolean {
  try {
    localStorage.setItem(MY_REQUESTS_KEY, JSON.stringify(addMyRequest(readMyRequests(), item)));
    return true;
  } catch {
    return false;
  }
}

function readBoard(): Record<string, BoardEntry> {
  try {
    return JSON.parse(document.getElementById('request-board-data')?.textContent ?? '{}');
  } catch {
    return {};
  }
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function renderMyRequests(): void {
  const mine = readMyRequests();
  const board = readBoard();

  document.querySelectorAll<HTMLElement>('[data-my-requests]').forEach((root) => {
    const list = root.querySelector('ul');
    if (!list) return;
    if (mine.length === 0) {
      root.hidden = true;
      return;
    }

    const limit = Number(root.dataset.limit) || mine.length;
    list.replaceChildren(
      ...mine.slice(0, limit).map((request) => {
        const entry = board[request.id];
        const { label, status } = describeMyRequest(entry);
        const item = el('li', 'my-request');
        const pill = el('span', 'status-pill', label);
        pill.dataset.status = status;
        item.append(pill, el('span', 'my-request-id', request.id));
        if (request.summary) item.append(el('span', 'my-request-summary', request.summary));
        if (entry?.workUrl) {
          const link = el('a', 'my-request-link', '作品を見る →');
          link.href = entry.workUrl;
          item.append(link);
        }
        return item;
      }),
    );
    root.hidden = false;
  });

  // リクエストのゆくえ一覧で、自分のものに目印をつける
  const myIds = new Set(mine.map((r) => r.id));
  document.querySelectorAll<HTMLElement>('[data-request-id]').forEach((item) => {
    const isMine = myIds.has(item.dataset.requestId ?? '');
    item.classList.toggle('is-mine', isMine);
    const mark = item.querySelector<HTMLElement>('[data-mine-mark]');
    if (mark) mark.hidden = !isMine;
  });
}
