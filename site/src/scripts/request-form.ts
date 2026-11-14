/**
 * かんたんリクエストフォーム。
 * - 自由記入の文章を主役に、チップ（チェックボックス）を添えて文章を組み立ててプレビュー
 * - お題ガチャ / 作品ページ・検索・トップからの引き継ぎ（?from=work&slug= / ?text=）
 * - 送信時に受付番号を発行して Formspree へ送り、成功したらブラウザに保存
 * JS が動かない環境では、素の form 送信として Formspree に届く（受付番号なし）。
 */
import {
  composeRequestMessage,
  composeRequestText,
  createReceiptId,
  isDraftEmpty,
  summarizeDraft,
  type RequestDraft,
  type RequestReference,
} from '../lib/request';
import { renderMyRequests, saveMyRequest } from './my-requests';

interface WorkInfo {
  title: string;
  thumb: string;
}

const secureRandom = (): number => {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  } catch {
    return Math.random();
  }
};

const today = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export function initRequestForm(): void {
  const form = document.getElementById('request-form') as HTMLFormElement | null;
  if (!form) return;

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const groups = [...form.querySelectorAll<HTMLElement>('[data-pick-group]')];
  const checkboxes = [...form.querySelectorAll<HTMLInputElement>('[data-pick-group] input[type="checkbox"]')];
  const note = $<HTMLTextAreaElement>('request-note');
  const preview = $('request-preview');
  const submitBtn = $<HTMLButtonElement>('request-submit');
  const hint = $('request-hint');
  const error = $('request-error');
  const referenceBox = $('reference-box');
  const variantInputs = [...form.querySelectorAll<HTMLInputElement>('input[name="variant"]')];

  const worksData: Record<string, WorkInfo> = JSON.parse($('request-works-data').textContent ?? '{}');
  let reference: Omit<RequestReference, 'variantLabel'> | undefined;

  // ---- 引き継ぎ（作品ページ / 検索0件 / トップのひとこと欄）----
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug') ?? '';
  if (Object.hasOwn(worksData, slug)) {
    const work = worksData[slug];
    reference = { slug, title: work.title };
    $('reference-title').textContent = work.title;
    const thumb = $<HTMLImageElement>('reference-thumb');
    if (work.thumb) thumb.src = work.thumb;
    else thumb.hidden = true;
    const variant = params.get('variant');
    variantInputs.forEach((input) => {
      input.checked = input.value === variant;
    });
    referenceBox.hidden = false;
  }
  const carriedText = (params.get('text') ?? '').trim();
  if (carriedText) note.value = carriedText.slice(0, note.maxLength > 0 ? note.maxLength : undefined);

  // ---- 下書き ----
  function getDraft(): RequestDraft {
    const variant = variantInputs.find((input) => input.checked);
    return {
      picks: groups.map((group) => ({
        label: group.dataset.label ?? '',
        values: [...group.querySelectorAll<HTMLInputElement>('input:checked')].map((input) => input.value),
      })),
      note: note.value,
      reference: reference ? { ...reference, variantLabel: variant?.dataset.label } : undefined,
    };
  }

  function update(): void {
    const draft = getDraft();
    const empty = isDraftEmpty(draft);
    preview.textContent = empty ? '書いた内容・えらんだ内容がここに表示されます。' : composeRequestText(draft);
    preview.classList.toggle('is-empty', empty);
    submitBtn.disabled = empty;
    hint.hidden = !empty;
  }

  form.addEventListener('change', update);
  note.addEventListener('input', update);

  $('reference-remove').addEventListener('click', () => {
    reference = undefined;
    variantInputs.forEach((input) => (input.checked = false));
    referenceBox.hidden = true;
    update();
  });

  $('clear-picks').addEventListener('click', () => {
    checkboxes.forEach((input) => (input.checked = false));
    update();
  });

  // お題ガチャ: 先頭のグループ（どんな子？）＋ほかの2グループから1つずつ
  $('gacha').addEventListener('click', () => {
    checkboxes.forEach((input) => (input.checked = false));
    const [first, ...rest] = groups;
    const shuffled = rest
      .map((group) => ({ group, key: Math.random() }))
      .sort((a, b) => a.key - b.key)
      .map(({ group }) => group);
    for (const group of [first, ...shuffled.slice(0, 2)]) {
      const options = group?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      if (!options?.length) continue;
      options[Math.floor(Math.random() * options.length)].checked = true;
    }
    update();
    preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // ---- 送信 ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const draft = getDraft();
    if (isDraftEmpty(draft)) return;

    const receiptId = createReceiptId(secureRandom);
    const nickname = $<HTMLInputElement>('nickname').value.trim();
    const email = $<HTMLInputElement>('email').value.trim();

    const body = new FormData();
    body.set('subject', 'イラストリクエスト');
    body.set('receipt_id', receiptId);
    body.set('message', composeRequestMessage(draft, { receiptId, nickname }));
    if (nickname) body.set('name', nickname);
    if (email) body.set('email', email);
    if (draft.reference) {
      body.set('reference_work_slug', draft.reference.slug);
      body.set('reference_work_title', draft.reference.title);
    }
    body.set('_gotcha', form.querySelector<HTMLInputElement>('input[name="_gotcha"]')?.value ?? '');

    submitBtn.disabled = true;
    submitBtn.textContent = '送信中…';
    error.hidden = true;

    let ok = false;
    try {
      const res = await fetch(form.action, { method: 'POST', body, headers: { Accept: 'application/json' } });
      ok = res.ok;
    } catch {
      ok = false;
    }

    submitBtn.textContent = 'リクエストを送る';
    if (!ok) {
      submitBtn.disabled = false;
      error.textContent = '送信できませんでした。時間をおいてもう一度お試しください（入力した内容はそのまま残っています）。';
      error.hidden = false;
      return;
    }

    const saved = saveMyRequest({ id: receiptId, date: today(), summary: summarizeDraft(draft) });
    $('done-receipt').textContent = receiptId;
    $('done-saved').hidden = !saved;
    $('done-unsaved').hidden = saved;
    form.hidden = true;
    const done = $('request-done');
    done.hidden = false;
    done.focus();
    done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    renderMyRequests();
  });

  update();
}
