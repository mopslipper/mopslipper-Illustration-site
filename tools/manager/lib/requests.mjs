/**
 * リクエストの純粋ロジック。
 *
 * 保存先は2つに分かれる:
 * - data/requests.json（公開）        … 受付番号・日付・進み具合・返信・作品との紐付け。内容は掲載同意があるときだけ
 * - data/private/requests_private.json … 掲載同意の無い内容・ニックネーム、作業メモ（この PC だけ・git 管理外）
 *
 * 管理画面はこの2つを合わせた1件（MergedRequest）として扱い、保存時にここで振り分ける。
 */
import { REQUEST_STATUSES, RECEIPT_PATTERN, createReceiptId } from '../../../site/src/lib/request.ts';
import { ValidationError } from './works.mjs';

/**
 * @typedef {object} MergedRequest
 * @property {string} id
 * @property {string} date
 * @property {string} status
 * @property {boolean} public   内容をサイトに載せるか（送り主の同意があるときだけ true）
 * @property {string} text
 * @property {string} nickname
 * @property {string} reply     作者の返信（公開）
 * @property {string} work_slug できあがった作品
 * @property {string} memo      作業メモ（非公開）
 */

const END_MARK = '【以上】';
// 【以上】が無い古いメール用: Formspree のメールで本文のあとに並ぶ、ほかのフォーム項目名を終わりの目印にする
const OTHER_FIELDS = /^(receipt_id|publish_ok|subject|name|email|reference_work_slug|reference_work_title|_gotcha)\s*(:|$)/i;

/**
 * メール本文からリクエストを取り出す。受付番号が見つからなければ null。
 * @param {string} source
 * @returns {{ id: string, publishOk: boolean, nickname?: string, text: string } | null}
 */
export function parseRequestMessage(source) {
  // 返信・転送の引用記号（>）と、項目行（【…】）の字下げを取り除く
  const lines = String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^(\s*>)+ ?/, '').replace(/^\s+(?=【)/, ''));

  // 項目（受付番号・掲載可否など）は【リクエスト内容】より前の行だけから読む。
  // 自由記入の文章に同じ書式の行があっても、掲載の同意などを書き換えられないようにするため。
  const start = lines.findIndex((line) => line.startsWith('【リクエスト内容】'));
  const header = start >= 0 ? lines.slice(0, start) : lines;
  const field = (name) => {
    const hit = header.find((line) => line.startsWith(`【${name}】`));
    return hit === undefined ? undefined : hit.slice(name.length + 2).trim();
  };

  const id = field('受付番号')?.toUpperCase();
  if (!id || !RECEIPT_PATTERN.test(id)) return null;

  // 内容の終わり: 最後の【以上】。無い古いメールは、次のフォーム項目名の手前まで
  let body = [];
  if (start >= 0) {
    const rest = lines.slice(start + 1);
    const end = rest.findLastIndex((line) => line.startsWith(END_MARK));
    if (end >= 0) {
      body = rest.slice(0, end);
    } else {
      const next = rest.findIndex((line) => OTHER_FIELDS.test(line.trim()));
      body = next >= 0 ? rest.slice(0, next) : rest;
    }
  }
  const text = body
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const nickname = field('ニックネーム');

  return {
    id,
    publishOk: field('サイト掲載') === 'OK',
    ...(nickname ? { nickname } : {}),
    text,
  };
}

/** メールから読み取った内容 → 管理画面の1件（進み具合は「受付」） */
export function requestFromMail(parsed, date) {
  return {
    id: parsed.id,
    date,
    status: 'received',
    public: parsed.publishOk && parsed.text !== '',
    text: parsed.text,
    nickname: parsed.nickname ?? '',
    reply: '',
    work_slug: '',
    memo: '',
  };
}

/** ほかと重ならない受付番号を作る（メール以外で受けたリクエスト用） */
export function generateReceiptId(existingIds, random = Math.random) {
  const used = new Set(existingIds);
  for (let attempt = 0; attempt < 1000; attempt++) {
    const id = createReceiptId(random);
    if (!used.has(id)) return id;
  }
  throw new Error('受付番号を作れませんでした');
}

/** 非公開ファイルの中身を安全な形にする（壊れた値・不要な項目は捨てる） */
export function sanitizePrivate(raw) {
  const result = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const [id, value] of Object.entries(raw)) {
    if (!RECEIPT_PATTERN.test(id) || !value || typeof value !== 'object') continue;
    const entry = {};
    for (const key of ['text', 'nickname', 'memo']) {
      if (typeof value[key] === 'string' && value[key].trim() !== '') entry[key] = value[key];
    }
    if (Object.keys(entry).length > 0) result[id] = entry;
  }
  return result;
}

/**
 * 公開ファイルと非公開ファイルを合わせて、管理画面用の一覧にする（ファイルに書かれた順）
 * @returns {MergedRequest[]}
 */
export function mergeRequests(publicList, privateMap) {
  const priv = sanitizePrivate(privateMap);
  return publicList.map((entry) => {
    const hidden = priv[entry.id] ?? {};
    return {
      id: entry.id,
      date: entry.date,
      status: entry.status,
      public: entry.public === true,
      text: (entry.public ? entry.text : hidden.text) ?? '',
      nickname: (entry.public ? entry.nickname : hidden.nickname) ?? '',
      reply: entry.reply ?? '',
      work_slug: entry.work_slug ?? '',
      memo: hidden.memo ?? '',
    };
  });
}

const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

/**
 * 管理画面の1件を、公開する部分と非公開の部分に分ける。問題があれば ValidationError。
 * @param {Partial<MergedRequest>} input
 * @param {{ workSlugs?: string[] }} [options] 紐付けできる作品の slug
 * @returns {{ entry: object, private: object | null }}
 */
export function splitRequest(input, { workSlugs } = {}) {
  const problems = [];
  const id = String(input.id ?? '').trim().toUpperCase();
  if (!RECEIPT_PATTERN.test(id)) problems.push('受付番号は R- のあとに英大文字・数字 3〜8 文字で入力してください（例: R-7K2M）');

  const date = String(input.date ?? '').trim();
  if (!isValidDate(date)) problems.push('日付は 2026-11-14 の形式で入力してください');

  const status = String(input.status ?? '');
  if (!REQUEST_STATUSES.includes(status)) problems.push('進み具合を選んでください');

  const isPublic = input.public === true;
  const text = String(input.text ?? '').replace(/\r\n?/g, '\n').trim();
  const nickname = String(input.nickname ?? '').trim();
  const reply = String(input.reply ?? '').replace(/\r\n?/g, '\n').trim();
  const memo = String(input.memo ?? '').replace(/\r\n?/g, '\n').trim();
  const workSlug = String(input.work_slug ?? '').trim();

  if (isPublic && !text) problems.push('内容をサイトに載せるには、リクエスト内容が必要です');
  if (workSlug && workSlugs && !workSlugs.includes(workSlug)) problems.push(`作品「${workSlug}」が見つかりません`);
  if (problems.length > 0) throw new ValidationError(problems);

  const entry = orderEntry({
    id,
    date,
    status,
    public: isPublic,
    text: isPublic ? text : undefined,
    nickname: isPublic && nickname ? nickname : undefined,
    work_slug: workSlug || undefined,
    reply: reply || undefined,
  });
  const hidden = {
    ...(!isPublic && text ? { text } : {}),
    ...(!isPublic && nickname ? { nickname } : {}),
    ...(memo ? { memo } : {}),
  };
  return { entry, private: Object.keys(hidden).length > 0 ? hidden : null };
}

/**
 * 1件を追加（先頭）または更新（同じ位置）する。元の配列・オブジェクトは変更しない。
 * @param {object[]} publicList
 * @param {object} privateMap
 * @param {Partial<MergedRequest>} input
 * @param {{ originalId?: string, workSlugs?: string[] }} [options] originalId を渡すと更新
 */
export function upsertRequest(publicList, privateMap, input, { originalId, workSlugs } = {}) {
  const { entry, private: hidden } = splitRequest(input, { workSlugs });
  const priv = { ...sanitizePrivate(privateMap) };
  let list;

  if (originalId === undefined) {
    if (publicList.some((r) => r.id === entry.id)) {
      throw new ValidationError([`${entry.id} はすでに登録されています`]);
    }
    list = [entry, ...publicList];
  } else {
    if (entry.id !== originalId) throw new ValidationError(['受付番号は変更できません']);
    if (!publicList.some((r) => r.id === originalId)) throw new ValidationError([`${originalId} が見つかりません`]);
    list = publicList.map((r) => (r.id === originalId ? entry : r));
  }

  if (hidden) priv[entry.id] = hidden;
  else delete priv[entry.id];
  return { publicList: list, privateMap: priv, entry };
}

export function removeRequest(publicList, privateMap, id) {
  if (!publicList.some((r) => r.id === id)) throw new ValidationError([`${id} が見つかりません`]);
  const priv = { ...sanitizePrivate(privateMap) };
  delete priv[id];
  return { publicList: publicList.filter((r) => r.id !== id), privateMap: priv };
}

const ENTRY_KEYS = ['id', 'date', 'status', 'public', 'text', 'nickname', 'work_slug', 'reply'];

/** data/requests.json の1件を、決まった項目順にそろえる（未設定の項目は書かない） */
function orderEntry(entry) {
  const ordered = {};
  for (const key of ENTRY_KEYS) {
    if (entry[key] !== undefined) ordered[key] = entry[key];
  }
  return ordered;
}

/**
 * 作品とリクエストの紐付けを、作品側の指定に合わせる。
 * - requestIds に入っているもの: work_slug を付ける。新しく紐付いたものは「できました」にする
 * - 入っていないのに、この作品（旧 slug を含む）を指しているもの: 紐付けを外す
 */
export function syncWorkLinks(publicList, { slug, previousSlug, requestIds }) {
  const wanted = new Set(requestIds ?? []);
  const unknown = [...wanted].filter((id) => !publicList.some((r) => r.id === id));
  if (unknown.length > 0) throw new ValidationError([`リクエスト ${unknown.join(', ')} が見つかりません`]);

  return publicList.map((request) => {
    const linkedHere = request.work_slug !== undefined && (request.work_slug === slug || request.work_slug === previousSlug);
    if (wanted.has(request.id)) {
      if (request.work_slug === slug) return request;
      return orderEntry({ ...request, status: linkedHere ? request.status : 'done', work_slug: slug });
    }
    if (linkedHere) return orderEntry({ ...request, work_slug: undefined });
    return request;
  });
}

/** 作品を削除したとき: その作品を指す紐付けを外す */
export function unlinkWork(publicList, slug) {
  return syncWorkLinks(publicList, { slug, requestIds: [] });
}

/** 一覧などに出す短い要約 */
export function summarizeText(text, maxLength = 40) {
  const chars = [...String(text ?? '').replace(/\s+/g, ' ').trim()];
  return chars.length > maxLength ? `${chars.slice(0, maxLength - 1).join('')}…` : chars.join('');
}
