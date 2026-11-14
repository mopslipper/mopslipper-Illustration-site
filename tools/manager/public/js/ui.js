/** 画面づくりの小さな道具（要素の生成・通知・確認・未保存の見張り） */

/**
 * 要素を作る。文字列は必ずテキストとして入れる（HTML として解釈しない）。
 * @param {string} tag
 * @param {Record<string, unknown> | null} [props] class / dataset / on〇〇 / そのほかの属性・プロパティ
 * @param {...(Node | string | number | null | undefined | false | unknown[])} children
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in el && !['list', 'form'].includes(key)) el[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

function append(parent, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.append(child instanceof Node ? child : String(child));
  }
}

/** 要素の中身を入れ替える。h() と同じく、配列・null・文字列をそのまま渡せる */
export function setChildren(parent, ...children) {
  parent.replaceChildren();
  append(parent, children);
}

/** 入力欄にラベルを付ける */
export function field(label, control, { hint, optional } = {}) {
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'field-label' }, label, optional ? h('small', null, ' 任意') : null),
    control,
    hint ? h('span', { class: 'hint' }, hint) : null,
  );
}

const toasts = () => document.getElementById('toasts');

/** 画面の下に短い通知を出す（操作は止めない） */
export function toast(message, kind = 'ok') {
  const item = h('div', { class: `toast toast-${kind}` }, message);
  toasts().append(item);
  const remove = () => item.remove();
  const timer = setTimeout(remove, kind === 'error' ? 9000 : 3500);
  item.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

/** エラーを通知する。保存の失敗などで使う */
export function toastError(error) {
  toast(error?.message ?? String(error), 'error');
}

/**
 * 確認ダイアログ。OK なら true。
 * @param {{ title: string, message?: string, okLabel?: string, cancelLabel?: string, danger?: boolean }} options
 */
export function confirmDialog({ title, message = '', okLabel = 'OK', cancelLabel = 'やめる', danger = false }) {
  const dialog = document.getElementById('confirm-dialog');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  const ok = document.getElementById('confirm-ok');
  ok.textContent = okLabel;
  ok.classList.toggle('btn-danger', danger);
  document.getElementById('confirm-cancel').textContent = cancelLabel;
  return new Promise((resolve) => {
    dialog.returnValue = 'cancel';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
    dialog.showModal();
    ok.focus();
  });
}

// ---- 未保存の変更の見張り ------------------------------------------------------

let dirtyCheck = () => false;

/** いま表示中の画面が「未保存の変更があるか」を答える関数を登録する */
export function setDirtyCheck(check) {
  dirtyCheck = check ?? (() => false);
}

export function isDirty() {
  try {
    return dirtyCheck() === true;
  } catch {
    return false;
  }
}

/** 画面を離れてよいか。未保存の変更があれば確認する */
export async function canLeave() {
  if (!isDirty()) return true;
  return confirmDialog({
    title: '保存していない変更があります',
    message: 'このまま移動すると、入力した内容は失われます。',
    okLabel: '破棄して移動',
    cancelLabel: '編集にもどる',
    danger: true,
  });
}

window.addEventListener('beforeunload', (event) => {
  if (isDirty()) event.preventDefault();
});

// ---- こまごま ------------------------------------------------------------------

export const formatDate = (date) => String(date ?? '').replaceAll('-', '.');

export function summarize(text, maxLength = 44) {
  const chars = [...String(text ?? '').replace(/\s+/g, ' ').trim()];
  return chars.length > maxLength ? `${chars.slice(0, maxLength - 1).join('')}…` : chars.join('');
}

/** ボタンを「処理中」にして、終わったら戻す */
export async function busy(button, label, task) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

/** フォームの現在値を比べるための文字列（未保存の判定用） */
export const snapshot = (value) => JSON.stringify(value);
