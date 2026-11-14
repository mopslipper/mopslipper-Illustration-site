/**
 * 管理ツールのローカルサーバ本体（Node 標準機能のみ）。
 *
 * - 127.0.0.1 にだけ待ち受ける。Host / Origin / Sec-Fetch-Site を確かめ、書き込みには専用ヘッダーを必須にする
 *   （ほかのサイトを開いているブラウザから、勝手に操作・読み取りされないようにするため）
 * - root（data/・static/img/・.git があるフォルダ）は引数で差し替えられる。テストや確認は一時フォルダを相手に行う
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, createReadStream } from 'node:fs';
import { stat, readdir, unlink } from 'node:fs/promises';

import { CATEGORIES } from '../../../site/src/lib/schema.ts';
import { REQUEST_STATUSES, STATUS_LABELS } from '../../../site/src/lib/request.ts';
import { createStore } from './store.mjs';
import {
  ValidationError,
  WORKS_PREFIX,
  applyWorkForm,
  collectTags,
  findWorkConflicts,
  isImageName,
  isVideoName,
  mediaFileName,
  nextWorkId,
  normalizeMediaPath,
  thumbnailNameFor,
  toForm,
  uploadFileName,
} from './works.mjs';
import {
  generateReceiptId,
  mergeRequests,
  parseRequestMessage,
  removeRequest,
  requestFromMail,
  syncWorkLinks,
  unlinkWork,
  upsertRequest,
} from './requests.mjs';
import {
  validateAll,
  validateCommission,
  validateNotes,
  validateRequestOptions,
  validateRequests,
  validateWorks,
} from './validate.mjs';
import {
  AiError,
  createAiConfigTemplates,
  defaultsFromConfig,
  generateDescription,
  getAiStatus,
  loadAiConfig,
  saveAiDefaults,
} from './ai.mjs';
import { UploadError, makeJpgThumbnail, makePreview, readImageSize, saveStream, shrinkForAi } from './media.mjs';
import { getGitStatus, publish } from './git.mjs';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

const JSON_LIMIT = 2 * 1024 * 1024;
const IMAGE_LIMIT = 60 * 1024 * 1024;
const VIDEO_LIMIT = 500 * 1024 * 1024;

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function localDate(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function localTime(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${localDate(date)} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > JSON_LIMIT) throw new HttpError(413, '送信された内容が大きすぎます');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    if (!value || typeof value !== 'object') throw new Error('not an object');
    return value;
  } catch {
    throw new HttpError(400, '送信された内容を読み取れませんでした');
  }
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(text);
}

/** 作品フォルダ直下のファイル名として安全か（URL から受け取った名前の確認用） */
function safeWorksName(raw) {
  let name;
  try {
    name = decodeURIComponent(raw);
  } catch {
    return '';
  }
  return mediaFileName(`${WORKS_PREFIX}${name}`);
}

export function createManagerApp({ root, fetchImpl, openAiBaseUrl, retryDelayMs } = {}) {
  if (!root || !existsSync(path.join(root, 'data'))) {
    throw new Error(`data フォルダが見つかりません: ${root}`);
  }
  const store = createStore(root);
  const worksDir = path.join(root, 'static/img/works');
  const app = { port: 0, handle };

  // 書き込みは1つずつ順番に行う（同時に保存しても、片方の変更が消えないように）
  let queue = Promise.resolve();
  const exclusive = (task) => {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  };

  const throwIfProblems = (problems) => {
    if (problems.length > 0) throw new ValidationError(problems);
  };

  const aiDefaults = async () => defaultsFromConfig(await loadAiConfig(root));

  // ---- 作品 -------------------------------------------------------------------

  async function listWorks() {
    const [works, requests, defaults] = await Promise.all([store.read('works'), store.read('requests', []), aiDefaults()]);
    return {
      works: works
        .map((work) => ({
          ...toForm(work, defaults),
          nsfw: work.nsfw === true,
          external_links: work.external_links ?? {},
          request_ids: requests.filter((r) => r.work_slug === work.slug).map((r) => r.id),
        }))
        .sort((a, b) => b.id - a.id),
      tags: collectTags(works),
      nextId: nextWorkId(works),
      categories: CATEGORIES,
      today: localDate(),
    };
  }

  function saveWork(originalId, body) {
    return exclusive(async () => {
      const works = await store.read('works');
      const existing = originalId === undefined ? undefined : works.find((w) => w.id === originalId);
      if (originalId !== undefined && !existing) throw new HttpError(404, `作品 ${originalId} が見つかりません`);

      const work = applyWorkForm(existing, body.form ?? {}, { aiDefaults: await aiDefaults() });
      if (existing && work.id !== existing.id) throw new ValidationError(['ID は変更できません']);
      throwIfProblems(findWorkConflicts(works, work, originalId));

      const nextWorks = existing ? works.map((w) => (w.id === originalId ? work : w)) : [...works, work];
      throwIfProblems(validateWorks(nextWorks, { root }));

      // リクエストとの紐付け。指定が無ければ今の紐付けを保つ（slug を変えたときは付け替える）
      const requests = await store.read('requests', []);
      const requestIds = Array.isArray(body.requestIds)
        ? body.requestIds.map(String)
        : requests.filter((r) => existing && r.work_slug === existing.slug).map((r) => r.id);
      const nextRequests = syncWorkLinks(requests, { slug: work.slug, previousSlug: existing?.slug, requestIds });
      throwIfProblems(validateRequests(nextRequests, nextWorks));

      await store.write('works', nextWorks);
      await store.write('requests', nextRequests);
      return { id: work.id, slug: work.slug };
    });
  }

  function deleteWork(id) {
    return exclusive(async () => {
      const works = await store.read('works');
      const target = works.find((w) => w.id === id);
      if (!target) throw new HttpError(404, `作品 ${id} が見つかりません`);
      const nextWorks = works.filter((w) => w.id !== id);
      const requests = await store.read('requests', []);
      const nextRequests = unlinkWork(requests, target.slug);
      throwIfProblems(validateRequests(nextRequests, nextWorks));
      await store.write('works', nextWorks);
      await store.write('requests', nextRequests);
      return { ok: true };
    });
  }

  /** アップロード先の名前と、すでにあるか・ほかの作品が使っているかを調べる */
  async function planUpload(query) {
    const workId = Number(query.get('workId'));
    const kind = String(query.get('kind') ?? '');
    const taken = existsSync(worksDir) ? await readdir(worksDir) : [];
    const fileName = uploadFileName({ workId, kind, originalName: String(query.get('name') ?? ''), taken });

    const works = await store.read('works');
    const usedByOther = (name) =>
      works.some(
        (w) =>
          w.id !== workId &&
          [w.image_path, w.thumbnail, w.x_thumbnail, ...(w.additional_images ?? [])].some(
            (p) => p && mediaFileName(p).toLowerCase() === name.toLowerCase(),
          ),
      );
    return {
      kind,
      fileName,
      destination: path.join(worksDir, fileName),
      exists: taken.some((name) => name.toLowerCase() === fileName.toLowerCase()),
      inUse: usedByOther(fileName),
      usedByOther,
    };
  }

  async function checkUpload(query) {
    const { fileName, exists, inUse } = await planUpload(query);
    return { fileName, exists, inUse };
  }

  async function handleUpload(req, query) {
    const overwrite = query.get('overwrite') === '1';

    return exclusive(async () => {
      const { kind, fileName, destination, exists, inUse, usedByOther } = await planUpload(query);

      // ほかの作品が使っているファイルは、確認があっても置き換えない
      if (inUse) {
        throw new HttpError(409, `${fileName} はほかの作品が使っているため、置き換えられません`, { code: 'in-use' });
      }
      if (exists && !overwrite) {
        throw new HttpError(409, `${fileName} はすでにあります`, { code: 'exists', fileName });
      }

      const video = isVideoName(fileName);
      await saveStream(req, destination, video ? VIDEO_LIMIT : IMAGE_LIMIT);

      let size = null;
      let thumbnail = null;
      let thumbnailNote = '';
      if (!video) {
        try {
          size = await readImageSize(destination);
        } catch (error) {
          await unlink(destination).catch(() => undefined);
          throw error;
        }
        if (kind === 'main') {
          const thumbName = thumbnailNameFor(fileName);
          if (thumbName && usedByOther(thumbName)) {
            thumbnailNote = `${thumbName} はほかの作品が使っているため、サムネイルを作れませんでした`;
          } else if (thumbName && (await makeJpgThumbnail(destination, path.join(worksDir, thumbName)))) {
            thumbnail = `${WORKS_PREFIX}${thumbName}`;
          } else {
            thumbnailNote = 'サムネイルを自動で作れませんでした。サムネイル画像を登録してください';
          }
        }
      }
      return { path: `${WORKS_PREFIX}${fileName}`, fileName, isVideo: video, thumbnail, thumbnailNote, ...(size ?? {}) };
    });
  }

  // ---- リクエスト ---------------------------------------------------------------

  async function listRequests() {
    const [publicList, privateMap, works] = await Promise.all([
      store.read('requests', []),
      store.read('privateRequests', {}),
      store.read('works'),
    ]);
    return {
      requests: mergeRequests(publicList, privateMap),
      works: works.map((w) => ({ id: w.id, slug: w.slug, title: w.title, hidden: w.hidden === true || w.nsfw === true })).sort((a, b) => b.id - a.id),
      statuses: REQUEST_STATUSES.map((status) => [status, STATUS_LABELS[status]]),
      today: localDate(),
    };
  }

  function saveRequest(originalId, input) {
    return exclusive(async () => {
      const [publicList, privateMap, works] = await Promise.all([
        store.read('requests', []),
        store.read('privateRequests', {}),
        store.read('works'),
      ]);
      const request = { ...input };
      if (originalId === undefined) {
        request.id = String(request.id ?? '').trim() || generateReceiptId(publicList.map((r) => r.id));
        request.date = String(request.date ?? '').trim() || localDate();
        request.status = request.status || 'received';
      }
      const next = upsertRequest(publicList, privateMap, request, { originalId, workSlugs: works.map((w) => w.slug) });
      throwIfProblems(validateRequests(next.publicList, works));
      // 非公開側を先に書く（途中で止まっても、公開ファイルに同意の無い内容が残らない順）
      await store.write('privateRequests', next.privateMap);
      await store.write('requests', next.publicList);
      return { id: next.entry.id };
    });
  }

  function deleteRequest(id) {
    return exclusive(async () => {
      const [publicList, privateMap] = await Promise.all([store.read('requests', []), store.read('privateRequests', {})]);
      const next = removeRequest(publicList, privateMap, id);
      await store.write('requests', next.publicList);
      await store.write('privateRequests', next.privateMap);
      return { ok: true };
    });
  }

  async function parseMail(body) {
    const parsed = parseRequestMessage(String(body.text ?? ''));
    if (!parsed) return { found: false };
    const publicList = await store.read('requests', []);
    return {
      found: true,
      duplicate: publicList.some((r) => r.id === parsed.id),
      publishOk: parsed.publishOk,
      request: requestFromMail(parsed, localDate()),
    };
  }

  // ---- サイト -------------------------------------------------------------------

  async function getSite() {
    const [notes, requestOptions, commission] = await Promise.all([
      store.read('notes', []),
      store.read('requestOptions'),
      store.read('commission'),
    ]);
    return {
      notes,
      requestOptions,
      commission: {
        open: commission.status?.open === true,
        message: commission.status?.message ?? '',
        next_update: commission.status?.next_update ?? '',
      },
      today: localDate(),
    };
  }

  function saveNotes(body) {
    return exclusive(async () => {
      const notes = (Array.isArray(body.notes) ? body.notes : []).map((note) => {
        const link = String(note?.link ?? '').trim();
        return { date: String(note?.date ?? '').trim(), text: String(note?.text ?? '').trim(), ...(link ? { link } : {}) };
      });
      throwIfProblems(validateNotes(notes));
      await store.write('notes', notes);
      return { ok: true };
    });
  }

  function saveRequestOptions(body) {
    return exclusive(async () => {
      const source = body.requestOptions ?? {};
      const clean = (list) => [...new Set((Array.isArray(list) ? list : []).map((v) => String(v ?? '').trim()).filter(Boolean))];
      const options = {
        groups: (Array.isArray(source.groups) ? source.groups : []).map((group) => ({
          id: String(group?.id ?? '').trim(),
          label: String(group?.label ?? '').trim(),
          options: clean(group?.options),
        })),
        variants: (Array.isArray(source.variants) ? source.variants : []).map((variant) => ({
          id: String(variant?.id ?? '').trim(),
          label: String(variant?.label ?? '').trim(),
        })),
      };
      throwIfProblems(validateRequestOptions(options));
      await store.write('requestOptions', options);
      return { ok: true };
    });
  }

  function saveCommissionStatus(body) {
    return exclusive(async () => {
      const commission = await store.read('commission');
      const message = String(body.message ?? '').trim();
      if (!message) throw new ValidationError(['表示する文言を入力してください']);
      const nextUpdate = String(body.next_update ?? '').trim();
      const status = { ...commission.status, open: body.open === true, message };
      if (nextUpdate) status.next_update = nextUpdate;
      else delete status.next_update;
      const next = { ...commission, status };
      throwIfProblems(validateCommission(next));
      await store.write('commission', next);
      return { ok: true };
    });
  }

  // ---- AI 説明文 ----------------------------------------------------------------

  async function describe(body) {
    const pick = (value) => {
      const name = mediaFileName(normalizeMediaPath(value));
      return name && isImageName(name) && existsSync(path.join(worksDir, name)) ? path.join(worksDir, name) : undefined;
    };
    const imageFile = pick(body.image_path) ?? pick(body.thumbnail);
    if (!imageFile) throw new AiError('画像が見つかりません。先に画像（動画の場合はサムネイル）を登録してください。');

    const works = await store.read('works');
    const existing = works.find((w) => w.id === Number(body.id));
    return generateDescription({
      root,
      context: {
        title: body.title,
        category: body.category,
        tags: Array.isArray(body.tags) ? body.tags : [],
        request_tags: existing?.request_tags ?? [],
      },
      directives: body.directives,
      imageFile,
      shrinkImage: shrinkForAi,
      ...(fetchImpl ? { fetchImpl } : {}),
      ...(openAiBaseUrl ? { baseUrl: openAiBaseUrl } : {}),
      ...(retryDelayMs !== undefined ? { retryDelayMs } : {}),
    });
  }

  // ---- 公開 ---------------------------------------------------------------------

  async function publishStatus() {
    const status = await getGitStatus(root);
    return { ...status, defaultMessage: `サイトを更新 ${localTime()}` };
  }

  function runPublish(body) {
    return exclusive(async () => {
      const message = String(body.message ?? '').trim();
      if (!message) throw new ValidationError(['コミットメッセージを入力してください']);
      const check = await validateAll(store);
      if (!check.ok) throw new HttpError(400, '公開前チェックで問題が見つかったため、公開を中止しました', { check });
      return publish(root, message.slice(0, 500));
    });
  }

  async function previewStatus() {
    const config = await store.read('config');
    const url = `http://localhost:4321${String(config.base_path ?? '').replace(/\/$/, '')}/`;
    let running = false;
    try {
      const response = await fetch(url.replace('localhost', '127.0.0.1'), { signal: AbortSignal.timeout(800) });
      running = response.ok;
    } catch {
      running = false;
    }
    return { running, url };
  }

  // ---- ルーティング -------------------------------------------------------------

  const routes = [
    ['GET', /^\/api\/bootstrap$/, async () => {
      const config = await store.read('config');
      return {
        manager: true,
        root,
        siteName: config.site_name,
        siteUrl: `${config.site_url}${config.base_path ?? ''}/`,
        statuses: REQUEST_STATUSES.map((status) => [status, STATUS_LABELS[status]]),
        categories: CATEGORIES,
        today: localDate(),
      };
    }],
    ['GET', /^\/api\/requests$/, () => listRequests()],
    ['POST', /^\/api\/requests\/parse$/, ({ body }) => parseMail(body)],
    ['POST', /^\/api\/requests$/, ({ body }) => saveRequest(undefined, body)],
    ['PUT', /^\/api\/requests\/([^/]+)$/, ({ body, match }) => saveRequest(decodeURIComponent(match[1]), body)],
    ['DELETE', /^\/api\/requests\/([^/]+)$/, ({ match }) => deleteRequest(decodeURIComponent(match[1]))],
    ['GET', /^\/api\/works$/, () => listWorks()],
    ['POST', /^\/api\/works$/, ({ body }) => saveWork(undefined, body)],
    ['PUT', /^\/api\/works\/(\d+)$/, ({ body, match }) => saveWork(Number(match[1]), body)],
    ['DELETE', /^\/api\/works\/(\d+)$/, ({ match }) => deleteWork(Number(match[1]))],
    ['GET', /^\/api\/upload\/check$/, ({ query }) => checkUpload(query)],
    ['POST', /^\/api\/upload$/, ({ req, query }) => handleUpload(req, query), { rawBody: true }],
    ['GET', /^\/api\/site$/, () => getSite()],
    ['PUT', /^\/api\/site\/notes$/, ({ body }) => saveNotes(body)],
    ['PUT', /^\/api\/site\/request-options$/, ({ body }) => saveRequestOptions(body)],
    ['PUT', /^\/api\/site\/commission$/, ({ body }) => saveCommissionStatus(body)],
    ['GET', /^\/api\/ai$/, () => getAiStatus(root)],
    ['PUT', /^\/api\/ai\/defaults$/, async ({ body }) => ({ defaults: await saveAiDefaults(root, body.directives) })],
    ['POST', /^\/api\/ai\/setup$/, async () => ({ created: await createAiConfigTemplates(root) })],
    ['POST', /^\/api\/ai\/describe$/, ({ body }) => describe(body)],
    ['GET', /^\/api\/publish$/, () => publishStatus()],
    ['POST', /^\/api\/publish\/check$/, () => validateAll(store)],
    ['POST', /^\/api\/publish$/, ({ body }) => runPublish(body)],
    ['GET', /^\/api\/preview$/, () => previewStatus()],
  ];

  /** リクエスト元の確認。問題があれば HttpError */
  function guard(req, pathname) {
    const allowedHosts = [`127.0.0.1:${app.port}`, `localhost:${app.port}`];
    if (!allowedHosts.includes(req.headers.host ?? '')) throw new HttpError(403, 'このアドレスからは使えません');

    // ブラウザが付ける「どこからのリクエストか」。ほかのサイトからの読み込み・送信は断る（直接開くのは可）
    const site = req.headers['sec-fetch-site'];
    const crossSite = site !== undefined && !['same-origin', 'none'].includes(site);
    if (crossSite && !(req.headers['sec-fetch-mode'] === 'navigate' && req.method === 'GET' && !pathname.startsWith('/api/'))) {
      throw new HttpError(403, 'ほかのサイトからの操作はできません');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.headers['x-manager'] !== '1') throw new HttpError(403, '管理画面以外からの操作はできません');
      const origin = req.headers.origin;
      if (origin !== undefined && !allowedHosts.some((host) => origin === `http://${host}`)) {
        throw new HttpError(403, 'ほかのサイトからの操作はできません');
      }
    }
  }

  async function sendFile(req, res, file, { cache = false } = {}) {
    let info;
    try {
      info = await stat(file);
    } catch {
      throw new HttpError(404, 'ファイルが見つかりません');
    }
    if (!info.isFile()) throw new HttpError(404, 'ファイルが見つかりません');

    const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    const headers = {
      'Content-Type': type,
      'Cache-Control': cache ? 'private, max-age=60' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
      ...(type.startsWith('text/html') ? { 'Content-Security-Policy': CSP, 'Referrer-Policy': 'no-referrer' } : {}),
    };

    // 動画の再生位置の移動に必要な範囲指定
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
        res.end();
        return;
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, { ...headers, 'Content-Length': info.size });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  }

  async function serveStatic(req, res, pathname, query) {
    if (pathname === '/' || pathname === '/index.html') return sendFile(req, res, path.join(PUBLIC_DIR, 'index.html'));

    if (pathname.startsWith('/assets/')) {
      let relative;
      try {
        relative = decodeURIComponent(pathname.slice('/assets/'.length));
      } catch {
        throw new HttpError(400, 'アドレスが正しくありません');
      }
      const file = path.resolve(PUBLIC_DIR, relative);
      if (!file.startsWith(path.resolve(PUBLIC_DIR) + path.sep)) throw new HttpError(404, 'ファイルが見つかりません');
      return sendFile(req, res, file);
    }

    const media = /^\/(media|preview)\/works\/([^/]+)$/.exec(pathname);
    if (media) {
      const name = safeWorksName(media[2]);
      if (!name) throw new HttpError(404, 'ファイルが見つかりません');
      const file = path.join(worksDir, name);
      if (media[1] === 'media') return sendFile(req, res, file, { cache: true });

      if (!existsSync(file)) throw new HttpError(404, 'ファイルが見つかりません');
      const width = Math.min(1200, Math.max(40, Number(query.get('w')) || 200));
      const buffer = await makePreview(file, { width, fit: query.get('fit') === 'inside' ? 'inside' : 'cover' });
      if (!buffer) throw new HttpError(404, '画像を表示できません');
      res.writeHead(200, {
        'Content-Type': 'image/webp',
        'Content-Length': buffer.length,
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : buffer);
      return;
    }

    throw new HttpError(404, 'ページが見つかりません');
  }

  async function handle(req, res) {
    let pathname = '/';
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      pathname = url.pathname;
      guard(req, pathname);

      if (pathname.startsWith('/api/')) {
        const route = routes.find(([method, pattern]) => method === req.method && pattern.test(pathname));
        if (!route) throw new HttpError(routes.some(([, pattern]) => pattern.test(pathname)) ? 405 : 404, 'この操作はできません');
        const [, pattern, handler, options] = route;
        const body = options?.rawBody || req.method === 'GET' || req.method === 'DELETE' ? {} : await readJsonBody(req);
        sendJson(res, 200, await handler({ req, body, query: url.searchParams, match: pattern.exec(pathname) }));
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'この操作はできません');
      await serveStatic(req, res, pathname, url.searchParams);
    } catch (error) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      // 本文を読み切らずにエラーを返すとき（アップロードの拒否など）は、残りを読み捨ててから返す
      // （途中で接続を切ると、ブラウザにエラー内容が届かないため）
      if (!req.complete && !req.destroyed) {
        req.resume();
        await new Promise((resolve) => {
          for (const event of ['end', 'close', 'error']) req.once(event, resolve);
        });
      }
      if (error instanceof ValidationError) {
        sendJson(res, 400, { error: error.problems.join('\n'), problems: error.problems });
      } else if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.message, ...error.extra });
      } else if (error instanceof AiError || error instanceof UploadError) {
        sendJson(res, 400, { error: error.message });
      } else {
        console.error(`[manager] ${req.method} ${pathname}:`, error);
        sendJson(res, 500, { error: `処理中にエラーが起きました: ${error?.message ?? error}` });
      }
    }
  }

  return app;
}

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(server.address().port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

/**
 * サーバを起動する。port が使用中なら次の番号を試す（port: 0 なら空いている番号を自動で使う）。
 * @returns {Promise<{ port: number, url: string, close: () => Promise<void> }>}
 */
export async function startManagerServer({ root, port = 4400, host = '127.0.0.1', portTries = 10, ...options } = {}) {
  const app = createManagerApp({ root, ...options });
  const server = http.createServer((req, res) => {
    app.handle(req, res);
  });
  // 大きな動画のアップロードや、時間のかかる push の途中で切らない
  server.requestTimeout = 0;
  server.timeout = 0;

  let actualPort;
  for (let attempt = 0; ; attempt++) {
    try {
      actualPort = await listen(server, host, port === 0 ? 0 : port + attempt);
      break;
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || port === 0 || attempt >= portTries - 1) throw error;
    }
  }
  app.port = actualPort;

  return {
    port: actualPort,
    url: `http://127.0.0.1:${actualPort}/`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      }),
  };
}
