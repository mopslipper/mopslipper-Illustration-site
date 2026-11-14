/**
 * データの検証。サイトと同じスキーマ (site/src/lib/schema.ts) を使い、
 * サイトの契約テストと同じ決まり（ID・slug の重複、画像の実在、リクエストと作品の対応）を確かめる。
 * 保存のたび、および公開前のチェックで使う。
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  worksSchema,
  requestsSchema,
  requestOptionsSchema,
  notesSchema,
  commissionSchema,
  configSchema,
} from '../../../site/src/lib/schema.ts';
import { FILES } from './store.mjs';
import { mediaFileName, isSiteImageName } from './works.mjs';

/** zod のエラーを「どこが・なぜ」の短い文にする */
export function formatIssues(error, describe = (index) => `${index + 1}件目`) {
  return error.issues.map((issue) => {
    const [first, ...rest] = issue.path;
    const where = typeof first === 'number' ? [describe(first), ...rest].join(' / ') : issue.path.join(' / ');
    return where ? `${where}: ${issue.message}` : issue.message;
  });
}

const duplicates = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

/** @returns {string[]} 問題の一覧（無ければ空） */
export function validateWorks(works, { root } = {}) {
  const parsed = worksSchema.safeParse(works);
  if (!parsed.success) return formatIssues(parsed.error, (i) => `作品 ${works?.[i]?.id ?? i + 1}`);

  const problems = [];
  for (const id of duplicates(works.map((w) => w.id))) problems.push(`ID ${id} が重複しています`);
  for (const slug of duplicates(works.map((w) => w.slug))) problems.push(`slug「${slug}」が重複しています`);

  for (const work of works) {
    if (!isSiteImageName(mediaFileName(work.thumbnail))) {
      problems.push(`作品 ${work.id}: サムネイルが画像ではありません (${work.thumbnail})`);
    }
    if (!root) continue;
    const paths = [work.image_path, work.thumbnail, ...(work.additional_images ?? []), ...(work.x_thumbnail ? [work.x_thumbnail] : [])];
    for (const mediaPath of paths) {
      const name = mediaFileName(mediaPath);
      if (!name || !existsSync(path.join(root, 'static/img/works', name))) {
        problems.push(`作品 ${work.id}: ファイルが見つかりません (${mediaPath})`);
      }
    }
  }
  return problems;
}

/** @returns {string[]} */
export function validateRequests(requests, works) {
  const parsed = requestsSchema.safeParse(requests);
  if (!parsed.success) return formatIssues(parsed.error, (i) => `リクエスト ${requests?.[i]?.id ?? i + 1}`);

  const problems = [];
  for (const id of duplicates(requests.map((r) => r.id))) problems.push(`受付番号 ${id} が重複しています`);
  if (works) {
    const slugs = new Set(works.map((w) => w.slug));
    for (const request of requests) {
      if (request.work_slug && !slugs.has(request.work_slug)) {
        problems.push(`リクエスト ${request.id}: 作品「${request.work_slug}」が見つかりません`);
      }
    }
  }
  return problems;
}

export function validateRequestOptions(options) {
  const parsed = requestOptionsSchema.safeParse(options);
  if (!parsed.success) return formatIssues(parsed.error);
  const problems = [];
  for (const id of duplicates(options.groups.map((g) => g.id))) problems.push(`グループ ID「${id}」が重複しています`);
  for (const group of options.groups) {
    for (const option of duplicates(group.options)) problems.push(`「${group.label}」の選択肢「${option}」が重複しています`);
  }
  for (const id of duplicates(options.variants.map((v) => v.id))) problems.push(`別バージョン ID「${id}」が重複しています`);
  return problems;
}

export function validateNotes(notes) {
  const parsed = notesSchema.safeParse(notes);
  return parsed.success ? [] : formatIssues(parsed.error);
}

export function validateCommission(commission) {
  const parsed = commissionSchema.safeParse(commission);
  return parsed.success ? [] : formatIssues(parsed.error);
}

/**
 * 公開前チェック: すべてのデータファイルを確かめる。
 * @param {ReturnType<import('./store.mjs').createStore>} store
 * @returns {Promise<{ ok: boolean, problems: { file: string, message: string }[] }>}
 */
export async function validateAll(store) {
  const problems = [];
  const check = async (key, validate) => {
    try {
      const value = await store.read(key);
      for (const message of validate(value)) problems.push({ file: FILES[key], message });
      return value;
    } catch (error) {
      problems.push({ file: FILES[key], message: error.message });
      return undefined;
    }
  };

  const works = await check('works', (value) => validateWorks(value, { root: store.root }));
  await check('requests', (value) => validateRequests(value, works));
  await check('requestOptions', validateRequestOptions);
  await check('notes', validateNotes);
  await check('commission', validateCommission);
  await check('config', (value) => {
    const parsed = configSchema.safeParse(value);
    return parsed.success ? [] : formatIssues(parsed.error);
  });
  return { ok: problems.length === 0, problems };
}
