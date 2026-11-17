/**
 * 管理ツールのサーバ (tools/manager/lib/app.mjs) の契約テスト。
 * 本物のデータには触れず、一時フォルダを相手に動かす。
 * - ほかのサイトからの操作・読み取りを断ること、フォルダの外に出られないこと
 * - 内容を載せない設定のリクエストの内容が、公開ファイル・git に入らないこと
 * - 画像の登録、作品とリクエストの紐付け、公開 (commit / push) の流れ
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
// @ts-expect-error 型定義の無い Node モジュール
import { startManagerServer } from '../../../tools/manager/lib/app.mjs';
// @ts-expect-error 型定義の無い Node モジュール
import { runGit, parseStatus, classifyPath, groupChanges } from '../../../tools/manager/lib/git.mjs';
// @ts-expect-error 型定義の無いブラウザ用モジュール
import { wrapText, fitText, ellipsize } from '../../../tools/manager/public/js/marshmallow.js';
import { requestsSchema, worksSchema } from '../../src/lib/schema';

const REPO = resolve(__dirname, '../../..');
const sharp = createRequire(join(REPO, 'site/package.json'))('sharp');
const SECRET_KEY = 'FAKE-TEST-KEY-do-not-leak-12345';

type Reply = { status: number; headers: http.IncomingHttpHeaders; text: string; json: () => any; buffer: Buffer };

const roots: string[] = [];
const servers: { close: () => Promise<void> }[] = [];

async function noiseImage(file: string, width = 200, height = 300) {
  // ファイルをつかんだままにしないよう、Buffer で作ってから書き出す（Windows では開いたままのファイルを置き換えられない）
  writeFileSync(file, await sharp(randomBytes(width * height * 3), { raw: { width, height, channels: 3 } }).webp({ quality: 90 }).toBuffer());
}

async function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'mgr-server-'));
  roots.push(root);
  mkdirSync(join(root, 'data'), { recursive: true });
  mkdirSync(join(root, 'static/img/works'), { recursive: true });
  for (const name of ['config.json', 'commission.json', 'request_options.json', 'notes.json']) {
    copyFileSync(join(REPO, 'data', name), join(root, 'data', name));
  }
  copyFileSync(join(REPO, '.gitignore'), join(root, '.gitignore'));
  await noiseImage(join(root, 'static/img/works/1.webp'));
  writeFileSync(join(root, 'static/img/works/1.jpg'), await sharp(readFileSync(join(root, 'static/img/works/1.webp'))).jpeg().toBuffer());
  const works = [
    {
      id: 1, slug: 'first', title: '最初の作品', date: '2026-01-01', image_path: '/static/img/works/1.webp', thumbnail: '/static/img/works/1.jpg',
      category: 'Original', tags: ['オリジナル', 'ネコミミ'], request_tags: ['ふわふわ'], nsfw: false,
      external_links: { twitter: 'https://x.com/example/status/1' },
    },
  ];
  writeFileSync(join(root, 'data/works.json'), `${JSON.stringify(works, null, 2)}\n`);
  writeFileSync(join(root, 'data/requests.json'), '[]\n');
  return root;
}

async function start(root: string, options: Record<string, unknown> = {}) {
  const server = await startManagerServer({ root, port: 0, retryDelayMs: 1, ...options });
  servers.push(server);
  return server;
}

function call(port: number, method: string, path: string, options: { headers?: Record<string, string | undefined>; body?: unknown; raw?: Buffer } = {}): Promise<Reply> {
  const payload = options.raw ?? (options.body === undefined ? undefined : Buffer.from(JSON.stringify(options.body)));
  const headers: Record<string, string> = {};
  if (method !== 'GET') headers['X-Manager'] = '1';
  if (payload && !options.raw) headers['Content-Type'] = 'application/json';
  if (payload) headers['Content-Length'] = String(payload.length);
  for (const [key, value] of Object.entries(options.headers ?? {})) {
    if (value === undefined) delete headers[key];
    else headers[key] = value;
  }
  return new Promise((done, fail) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf-8');
        done({ status: res.statusCode ?? 0, headers: res.headers, text, buffer, json: () => JSON.parse(text) });
      });
    });
    req.on('error', fail);
    req.end(payload);
  });
}

const readJson = (root: string, file: string) => JSON.parse(readFileSync(join(root, file), 'utf-8'));

afterAll(async () => {
  await Promise.all(servers.map((server) => server.close()));
  // Windows では閉じた直後のファイルを消せないことがあるので、少し待ってやり直す
  for (const root of roots) rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

// ---- 安全対策 -----------------------------------------------------------------

describe('ローカルサーバの安全対策', () => {
  let port: number;
  let root: string;
  beforeAll(async () => {
    root = await makeRoot();
    port = (await start(root)).port;
  });

  it('管理画面を配信し、外部のスクリプトを読み込めない設定 (CSP) を付ける', async () => {
    const page = await call(port, 'GET', '/');
    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.headers['content-security-policy']).toContain("script-src 'self'");
    expect(page.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect((await call(port, 'GET', '/assets/js/app.js')).status).toBe(200);
    expect((await call(port, 'GET', '/assets/style.css')).headers['content-type']).toContain('text/css');
  });

  it('別の名前 (Host) でのアクセスは断る（DNS リバインディング対策）', async () => {
    expect((await call(port, 'GET', '/api/bootstrap', { headers: { Host: 'evil.example' } })).status).toBe(403);
    expect((await call(port, 'GET', '/', { headers: { Host: `evil.example:${port}` } })).status).toBe(403);
    expect((await call(port, 'GET', '/api/bootstrap', { headers: { Host: `localhost:${port}` } })).status).toBe(200);
  });

  it('書き込みは管理画面からだけ（専用ヘッダー・同じ Origin が必要）', async () => {
    const body = { id: 'R-AAAA', date: '2026-11-14', status: 'received', public: false };
    expect((await call(port, 'POST', '/api/requests', { body, headers: { 'X-Manager': undefined } })).status).toBe(403);
    expect((await call(port, 'POST', '/api/requests', { body, headers: { Origin: 'https://evil.example' } })).status).toBe(403);
    expect((await call(port, 'POST', '/api/requests', { body, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(403);
    expect(readJson(root, 'data/requests.json').some((entry: { id: string }) => entry.id === 'R-HOLD')).toBe(false);
    expect((await call(port, 'POST', '/api/requests', { body, headers: { Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin' } })).status).toBe(200);
  });

  it('ほかのサイトからは読み取りもできない', async () => {
    const cross = { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'no-cors' };
    expect((await call(port, 'GET', '/api/requests', { headers: cross })).status).toBe(403);
    expect((await call(port, 'GET', '/media/works/1.webp', { headers: cross })).status).toBe(403);
    // リンクから管理画面を開くのはよい（データの API は不可）
    const navigate = { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate' };
    expect((await call(port, 'GET', '/', { headers: navigate })).status).toBe(200);
    expect((await call(port, 'GET', '/api/requests', { headers: navigate })).status).toBe(403);
  });

  it('フォルダの外のファイルは読めない', async () => {
    for (const path of [
      '/assets/..%2F..%2Flib%2Fapp.mjs',
      '/assets/../../lib/app.mjs',
      '/assets/%2e%2e/server.mjs',
      '/media/works/..%2F..%2F..%2Fdata%2Fworks.json',
      '/media/works/..%5C..%5C..%5Cdata%5Cworks.json',
      '/preview/works/..%2F..%2F..%2F.gitignore',
      '/data/works.json',
      '/.gitignore',
    ]) {
      const reply = await call(port, 'GET', path);
      expect(reply.status, path).toBe(404);
      expect(reply.text, path).not.toContain('最初の作品');
    }
  });

  it('画像の配信（範囲指定・縮小版）', async () => {
    const full = await call(port, 'GET', '/media/works/1.webp');
    expect(full.status).toBe(200);
    expect(full.headers['content-type']).toBe('image/webp');
    const part = await call(port, 'GET', '/media/works/1.webp', { headers: { Range: 'bytes=0-9' } });
    expect(part.status).toBe(206);
    expect(part.buffer.length).toBe(10);
    expect(part.headers['content-range']).toBe(`bytes 0-9/${full.buffer.length}`);
    const small = await call(port, 'GET', '/preview/works/1.webp?w=80');
    expect(small.status).toBe(200);
    expect((await sharp(small.buffer).metadata()).width).toBe(80);
    expect((await call(port, 'GET', '/media/works/nope.webp')).status).toBe(404);
  });

  it('存在しない操作・壊れた送信内容', async () => {
    expect((await call(port, 'GET', '/api/unknown')).status).toBe(404);
    expect((await call(port, 'DELETE', '/api/works')).status).toBe(405);
    expect((await call(port, 'POST', '/api/requests', { raw: Buffer.from('{not json'), headers: { 'Content-Type': 'application/json' } })).status).toBe(400);
    expect((await call(port, 'POST', '/')).status).toBe(405);
  });
});

// ---- リクエスト ---------------------------------------------------------------

describe('リクエストの取り込みと公開・非公開', () => {
  let port: number;
  let root: string;
  beforeAll(async () => {
    root = await makeRoot();
    port = (await start(root)).port;
  });

  // consent を渡すと、掲載可否のチェックがあった頃のメールになる。いまのメールにその行は無い
  const mail = (id: string, consent: string | null, text: string) =>
    `message:\n【受付番号】${id}\n${consent === null ? '' : `【サイト掲載】${consent}\n`}【ニックネーム】もふ\n\n【リクエスト内容】\n${text}\n【以上】\n\nreceipt_id:\n${id}\n`;

  it('昔の「掲載しない」のリクエスト: 内容は非公開ファイルだけに入り、公開ファイルには入らない', async () => {
    const parsed = (await call(port, 'POST', '/api/requests/parse', { body: { text: mail('R-HIDE', '掲載しない', 'ひみつのお願い') } })).json();
    expect(parsed).toMatchObject({ found: true, duplicate: false, publishOk: false, request: { id: 'R-HIDE', public: false, text: 'ひみつのお願い', nickname: 'もふ' } });

    expect((await call(port, 'POST', '/api/requests', { body: parsed.request })).json()).toEqual({ id: 'R-HIDE' });
    const publicFile = readFileSync(join(root, 'data/requests.json'), 'utf-8');
    expect(publicFile).not.toContain('ひみつ');
    expect(publicFile).not.toContain('もふ');
    expect(readJson(root, 'data/requests.json')[0]).toMatchObject({ id: 'R-HIDE', status: 'received', public: false });
    expect(readJson(root, 'data/private/requests_private.json')).toEqual({ 'R-HIDE': { text: 'ひみつのお願い', nickname: 'もふ' } });
    expect(requestsSchema.safeParse(readJson(root, 'data/requests.json')).success).toBe(true);

    // 管理画面には内容が見える
    const listed = (await call(port, 'GET', '/api/requests')).json();
    expect(listed.requests[0]).toMatchObject({ id: 'R-HIDE', text: 'ひみつのお願い', nickname: 'もふ', public: false });
    expect((await call(port, 'POST', '/api/requests/parse', { body: { text: mail('R-HIDE', null, 'x') } })).json().duplicate).toBe(true);
    expect((await call(port, 'POST', '/api/requests', { body: parsed.request })).status).toBe(400);
  });

  it('メールから保留した内容は非公開保存され、後から対応予定に追加できる', async () => {
    const parsed = (await call(port, 'POST', '/api/requests/parse', { body: { text: mail('R-HOLD', null, 'あとで判断するお願い') } })).json();
    expect(parsed).toMatchObject({ found: true, duplicate: false, held: false, request: { id: 'R-HOLD' } });

    expect((await call(port, 'POST', '/api/request-drafts', { body: { request: parsed.request } })).json()).toEqual({ id: 'R-HOLD' });
    expect((await call(port, 'GET', '/api/request-drafts')).json().drafts[0]).toMatchObject({
      request: { id: 'R-HOLD', text: 'あとで判断するお願い', nickname: 'もふ' },
    });
    expect(readJson(root, 'data/requests.json').some((entry: { id: string }) => entry.id === 'R-HOLD')).toBe(false);
    expect(readFileSync(join(root, 'data/requests.json'), 'utf-8')).not.toContain('あとで判断する');
    expect(readJson(root, 'data/private/request_drafts.json')[0].request.text).toBe('あとで判断するお願い');
    expect((await call(port, 'POST', '/api/requests/parse', { body: { text: mail('R-HOLD', null, '重複') } })).json()).toMatchObject({
      duplicate: true,
      held: true,
    });
    expect((await call(port, 'POST', '/api/request-drafts', { body: { request: parsed.request } })).status).toBe(400);

    const restartedPort = (await start(root)).port;
    expect((await call(restartedPort, 'GET', '/api/request-drafts')).json().drafts).toHaveLength(1);
    expect((await call(restartedPort, 'POST', '/api/request-drafts/R-HOLD/promote', { body: {} })).json()).toEqual({ id: 'R-HOLD' });
    expect(readJson(root, 'data/requests.json')[0]).toMatchObject({
      id: 'R-HOLD',
      public: true,
      text: 'あとで判断するお願い',
      nickname: 'もふ',
    });
    expect(readJson(root, 'data/private/request_drafts.json')).toEqual([]);
    expect((await call(restartedPort, 'GET', '/api/request-drafts')).json().drafts).toEqual([]);

    const another = (await call(port, 'POST', '/api/requests/parse', { body: { text: mail('R-DEL', null, '削除する保留') } })).json().request;
    await call(port, 'POST', '/api/request-drafts', { body: { request: another } });
    expect((await call(port, 'DELETE', '/api/request-drafts/R-DEL')).status).toBe(200);
    expect((await call(port, 'GET', '/api/request-drafts')).json().drafts).toEqual([]);
  });

  it('いまのメール（掲載可否の行なし）のリクエストは公開ファイルに入る。取り下げると消える', async () => {
    const parsed = (await call(port, 'POST', '/api/requests/parse', { body: { text: mail('R-OPEN', null, 'ネコミミちゃん\nピース') } })).json();
    expect(parsed).toMatchObject({ found: true, duplicate: false, publishOk: true, request: { id: 'R-OPEN', public: true } });
    await call(port, 'POST', '/api/requests', { body: parsed.request });
    expect(readJson(root, 'data/requests.json')[0]).toEqual({ id: 'R-OPEN', date: parsed.request.date, status: 'received', public: true, text: 'ネコミミちゃん\nピース', nickname: 'もふ' });

    const update = { ...parsed.request, status: 'making', reply: 'いま作ってます', memo: '構図を検討中' };
    expect((await call(port, 'PUT', '/api/requests/R-OPEN', { body: update })).status).toBe(200);
    expect(readJson(root, 'data/requests.json')[0]).toMatchObject({ status: 'making', reply: 'いま作ってます' });
    expect(readFileSync(join(root, 'data/requests.json'), 'utf-8')).not.toContain('構図を検討中');
    expect(readJson(root, 'data/private/requests_private.json')['R-OPEN']).toEqual({ memo: '構図を検討中' });

    await call(port, 'PUT', '/api/requests/R-OPEN', { body: { ...update, public: false } });
    expect(readFileSync(join(root, 'data/requests.json'), 'utf-8')).not.toContain('ネコミミちゃん');
    expect(readJson(root, 'data/private/requests_private.json')['R-OPEN']).toEqual({ text: 'ネコミミちゃん\nピース', nickname: 'もふ', memo: '構図を検討中' });
  });

  it('手入力の追加は受付番号を自動で付ける。誤りは保存しない', async () => {
    const added = (await call(port, 'POST', '/api/requests', { body: { public: false, text: 'DM でもらったお願い' } })).json();
    expect(added.id).toMatch(/^R-[2-9A-HJKMNP-Z]{4}$/);
    const before = readFileSync(join(root, 'data/requests.json'), 'utf-8');
    const bad = await call(port, 'PUT', `/api/requests/${added.id}`, { body: { id: added.id, date: '2026-11-14', status: 'finished', public: true, text: '' } });
    expect(bad.status).toBe(400);
    expect(bad.json().problems.length).toBeGreaterThanOrEqual(2);
    expect((await call(port, 'PUT', `/api/requests/${added.id}`, { body: { id: added.id, date: '2026-11-14', status: 'done', public: false, work_slug: 'nope' } })).status).toBe(400);
    expect(readFileSync(join(root, 'data/requests.json'), 'utf-8')).toBe(before);

    expect((await call(port, 'DELETE', `/api/requests/${added.id}`)).status).toBe(200);
    expect(readJson(root, 'data/requests.json').map((r: { id: string }) => r.id)).toEqual(['R-OPEN', 'R-HOLD', 'R-HIDE']);
    expect(readJson(root, 'data/private/requests_private.json')[added.id]).toBeUndefined();
    expect((await call(port, 'DELETE', '/api/requests/R-NONE')).status).toBe(400);
  });

  it('受付番号の無い文章は取り込まない', async () => {
    expect((await call(port, 'POST', '/api/requests/parse', { body: { text: 'こんにちは' } })).json()).toEqual({ found: false });
  });

  it('保存前の内容をバックアップに残す（git の管理対象外）', () => {
    const backups = readdirSync(join(root, 'data/private/backup'));
    expect(backups.some((name) => name.startsWith('requests.'))).toBe(true);
  });
});

// ---- 作品 ---------------------------------------------------------------------

describe('作品の登録・画像の登録・リクエストとの紐付け', () => {
  let port: number;
  let root: string;
  let image: Buffer;
  beforeAll(async () => {
    root = await makeRoot();
    port = (await start(root)).port;
    await noiseImage(join(root, 'upload-source.webp'), 120, 160);
    image = readFileSync(join(root, 'upload-source.webp'));
    await call(port, 'POST', '/api/requests', { body: { id: 'R-WORK', date: '2026-11-10', status: 'making', public: true, text: '狐っ娘' } });
  });

  it('一覧はフォーム用の形で返る（触らない項目も確認用に含む）', async () => {
    const list = (await call(port, 'GET', '/api/works')).json();
    expect(list.nextId).toBe(2);
    expect(list.tags).toEqual(['オリジナル', 'ネコミミ']);
    expect(list.works[0]).toMatchObject({ id: 1, slug: 'first', sensitive: false, external_links: { twitter: 'https://x.com/example/status/1' }, request_ids: [] });
  });

  it('画像を登録すると、決まった名前で保存されて JPG サムネイルが作られる', async () => {
    const check = (await call(port, 'GET', '/api/upload/check?workId=2&kind=main&name=My%20Picture.WEBP')).json();
    expect(check).toEqual({ fileName: '2.webp', exists: false, inUse: false });

    const reply = await call(port, 'POST', '/api/upload?workId=2&kind=main&name=My%20Picture.WEBP', { raw: image });
    expect(reply.status).toBe(200);
    expect(reply.json()).toMatchObject({ path: '/static/img/works/2.webp', thumbnail: '/static/img/works/2.jpg', isVideo: false, width: 120, height: 160 });
    expect(existsSync(join(root, 'static/img/works/2.webp'))).toBe(true);
    const thumb = await sharp(readFileSync(join(root, 'static/img/works/2.jpg'))).metadata();
    expect(thumb).toMatchObject({ format: 'jpeg', width: 120, height: 160 });

    // 同じ名前は、確認 (overwrite) が無ければ置き換えない
    const again = await call(port, 'POST', '/api/upload?workId=2&kind=main&name=x.webp', { raw: image });
    expect(again.status).toBe(409);
    expect(again.json().code).toBe('exists');
    expect((await call(port, 'POST', '/api/upload?workId=2&kind=main&name=x.webp&overwrite=1', { raw: image })).status).toBe(200);

    const extra1 = (await call(port, 'POST', '/api/upload?workId=2&kind=extra&name=a.webp', { raw: image })).json();
    const extra2 = (await call(port, 'POST', '/api/upload?workId=2&kind=extra&name=b.webp', { raw: image })).json();
    expect([extra1.path, extra2.path]).toEqual(['/static/img/works/2-1.webp', '/static/img/works/2-2.webp']);
    expect((await call(port, 'POST', '/api/upload?workId=2&kind=x&name=x.webp', { raw: image })).json().path).toBe('/static/img/works/2-x.webp');
  });

  it('使えないファイルは保存しない', async () => {
    const before = readdirSync(join(root, 'static/img/works')).sort();
    expect((await call(port, 'POST', '/api/upload?workId=3&kind=main&name=evil.html', { raw: Buffer.from('<script>') })).status).toBe(400);
    expect((await call(port, 'POST', '/api/upload?workId=3&kind=main&name=..%2F..%2Fx.webp', { raw: image })).json().path).toBe('/static/img/works/3.webp');
    expect((await call(port, 'POST', '/api/upload?workId=4&kind=main&name=fake.webp', { raw: Buffer.from('this is not an image') })).status).toBe(400);
    expect((await call(port, 'POST', '/api/upload?workId=4&kind=main&name=empty.webp', { raw: Buffer.alloc(0) })).status).toBe(400);
    expect((await call(port, 'POST', '/api/upload?workId=abc&kind=main&name=a.webp', { raw: image })).status).toBe(400);
    expect((await call(port, 'POST', '/api/upload?workId=4&kind=thumb&name=a.mp4', { raw: image })).status).toBe(400);
    // ほかの作品 (ID 1) が使っているファイルは、確認があっても置き換えない
    writeFileSync(join(root, 'static/img/works/9.webp'), readFileSync(join(root, 'static/img/works/1.webp')));
    const works = readJson(root, 'data/works.json');
    works[0].additional_images = ['/static/img/works/9.webp'];
    writeFileSync(join(root, 'data/works.json'), `${JSON.stringify(works, null, 2)}\n`);
    const inUse = await call(port, 'POST', '/api/upload?workId=9&kind=main&name=a.webp&overwrite=1', { raw: image });
    expect(inUse.status).toBe(409);
    expect(inUse.json().code).toBe('in-use');

    const after = readdirSync(join(root, 'static/img/works')).sort();
    expect(after).toEqual([...before, '3.webp', '3.jpg', '9.webp'].sort());
    expect(after.filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('リクエストから作品を登録すると、リクエストが「できました」になって相互に紐付く', async () => {
    const form = {
      id: 2, slug: '2', title: '狐っ娘', date: '2026-11-14', category: 'Original', image_path: '/static/img/works/2.webp', thumbnail: '/static/img/works/2.jpg',
      x_thumbnail: '/static/img/works/2-x.webp', additional_images: ['/static/img/works/2-1.webp'], tags: ['キツネ'], description: 'しっぽがふわふわ',
      sensitive: true, hidden: false, hide_sensitive_thumbnail_on_x: true,
    };
    const saved = await call(port, 'POST', '/api/works', { body: { form, requestIds: ['R-WORK'] } });
    expect(saved.json()).toEqual({ id: 2, slug: '2' });

    const works = readJson(root, 'data/works.json');
    expect(worksSchema.safeParse(works).success).toBe(true);
    expect(works[2 - 1]).toMatchObject({ id: 2, sensitive: true, hide_sensitive_thumbnail_on_x: true, nsfw: false, external_links: {} });
    expect(readJson(root, 'data/requests.json')[0]).toMatchObject({ id: 'R-WORK', status: 'done', work_slug: '2' });
    expect((await call(port, 'GET', '/api/works')).json().works[0].request_ids).toEqual(['R-WORK']);

    // 同じ ID・slug では登録できない。存在しない画像でも保存できない
    expect((await call(port, 'POST', '/api/works', { body: { form } })).status).toBe(400);
    const missing = await call(port, 'POST', '/api/works', { body: { form: { ...form, id: 5, slug: '5', image_path: '5.webp', thumbnail: '5.jpg' } } });
    expect(missing.status).toBe(400);
    expect(missing.json().error).toContain('ファイルが見つかりません');
    expect(readJson(root, 'data/works.json')).toHaveLength(2);
  });

  it('編集しても、画面に無い項目（外部リンク・リクエストタグ）は消えない。slug を変えると紐付けも付け替わる', async () => {
    const list = (await call(port, 'GET', '/api/works')).json();
    const first = list.works.find((w: { id: number }) => w.id === 1);
    expect((await call(port, 'PUT', '/api/works/1', { body: { form: { ...first, title: '題名を変更', hidden: true } } })).status).toBe(200);
    expect(readJson(root, 'data/works.json')[0]).toMatchObject({
      title: '題名を変更', hidden: true, request_tags: ['ふわふわ'], external_links: { twitter: 'https://x.com/example/status/1' },
    });

    const second = list.works.find((w: { id: number }) => w.id === 2);
    expect((await call(port, 'PUT', '/api/works/2', { body: { form: { ...second, slug: 'fox-girl' } } })).status).toBe(200);
    expect(readJson(root, 'data/requests.json')[0]).toMatchObject({ id: 'R-WORK', status: 'done', work_slug: 'fox-girl' });
    expect((await call(port, 'PUT', '/api/works/2', { body: { form: { ...second, id: 77 } } })).status).toBe(400);
    expect((await call(port, 'PUT', '/api/works/99', { body: { form: second } })).status).toBe(404);
  });

  it('作品を削除すると、リクエストの紐付けが外れる（画像ファイルは残す）', async () => {
    expect((await call(port, 'DELETE', '/api/works/2')).status).toBe(200);
    expect(readJson(root, 'data/works.json').map((w: { id: number }) => w.id)).toEqual([1]);
    expect(readJson(root, 'data/requests.json')[0].work_slug).toBeUndefined();
    expect(existsSync(join(root, 'static/img/works/2.webp'))).toBe(true);
    expect(requestsSchema.safeParse(readJson(root, 'data/requests.json')).success).toBe(true);
  });
});

// ---- サイトの設定 --------------------------------------------------------------

describe('ひとこと・フォームの選択肢・有償依頼', () => {
  let port: number;
  let root: string;
  beforeAll(async () => {
    root = await makeRoot();
    port = (await start(root)).port;
  });

  it('ひとことを保存する。誤った日付は保存しない', async () => {
    const notes = [{ date: '2026-11-15', text: ' 新作を追加しました ', link: '/gallery.html?tag=キツネ' }, { date: '2026-11-14', text: 'リニューアル', link: '' }];
    expect((await call(port, 'PUT', '/api/site/notes', { body: { notes } })).status).toBe(200);
    expect(readJson(root, 'data/notes.json')).toEqual([{ date: '2026-11-15', text: '新作を追加しました', link: '/gallery.html?tag=キツネ' }, { date: '2026-11-14', text: 'リニューアル' }]);
    expect((await call(port, 'PUT', '/api/site/notes', { body: { notes: [{ date: '昨日', text: 'x' }] } })).status).toBe(400);
    expect((await call(port, 'PUT', '/api/site/notes', { body: { notes: [{ date: '2026-11-15', text: '' }] } })).status).toBe(400);
    expect(readJson(root, 'data/notes.json')).toHaveLength(2);
  });

  it('フォームの選択肢を保存する。重複・空のグループは保存しない', async () => {
    const current = (await call(port, 'GET', '/api/site')).json().requestOptions;
    const next = { ...current, groups: [...current.groups, { id: 'gnew1', label: ' 小物 ', options: ['ぬいぐるみ', ' 傘 ', 'ぬいぐるみ'] }] };
    expect((await call(port, 'PUT', '/api/site/request-options', { body: { requestOptions: next } })).status).toBe(200);
    expect(readJson(root, 'data/request_options.json').groups.at(-1)).toEqual({ id: 'gnew1', label: '小物', options: ['ぬいぐるみ', '傘'] });
    const empty = { ...current, groups: [{ id: 'g1', label: '空', options: [] }] };
    expect((await call(port, 'PUT', '/api/site/request-options', { body: { requestOptions: empty } })).status).toBe(400);
    const dup = { ...current, groups: [current.groups[0], current.groups[0]] };
    expect((await call(port, 'PUT', '/api/site/request-options', { body: { requestOptions: dup } })).status).toBe(400);
  });

  it('有償依頼の受付状態だけを書き換える（料金メニューなどは変えない）', async () => {
    const before = readJson(root, 'data/commission.json');
    expect((await call(port, 'PUT', '/api/site/commission', { body: { open: true, message: '受付中', next_update: '2027-01-01' } })).status).toBe(200);
    const after = readJson(root, 'data/commission.json');
    expect(after.status).toEqual({ open: true, message: '受付中', next_update: '2027-01-01' });
    expect({ ...after, status: before.status }).toEqual(before);
    await call(port, 'PUT', '/api/site/commission', { body: { open: false, message: '現在受付していません', next_update: '' } });
    expect(readJson(root, 'data/commission.json').status).toEqual({ open: false, message: '現在受付していません' });
    expect((await call(port, 'PUT', '/api/site/commission', { body: { open: true, message: ' ' } })).status).toBe(400);
  });
});

// ---- AI 説明文 -----------------------------------------------------------------

describe('AI 説明文（OpenAI への送信は差し替えて確認）', () => {
  let port: number;
  let root: string;
  const calls: { url: string; headers: Record<string, string>; body: any }[] = [];
  let responses: (() => Response)[] = [];
  const ok = (content: unknown) => () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  const fail = (status: number, message: string) => () => new Response(JSON.stringify({ error: { message } }), { status });

  beforeAll(async () => {
    root = await makeRoot();
    const fetchImpl = async (url: string, init: { headers: Record<string, string>; body: string }) => {
      calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      return (responses.shift() ?? ok('既定の説明文'))();
    };
    port = (await start(root, { fetchImpl, openAiBaseUrl: 'https://openai.test/v1' })).port;
  });

  it('API キーが無い間は使えないと伝える。ひな形は既存のファイルを上書きしない', async () => {
    expect((await call(port, 'GET', '/api/ai')).json()).toMatchObject({ available: false, hasConfig: false });
    const none = await call(port, 'POST', '/api/ai/describe', { body: { title: 't', image_path: '/static/img/works/1.webp' } });
    expect(none.status).toBe(400);
    expect(none.json().error).toContain('api_keys.json');
    expect(calls).toHaveLength(0);

    expect((await call(port, 'POST', '/api/ai/setup')).json().created).toEqual(['ai_config.json', 'api_keys.json']);
    expect((await call(port, 'GET', '/api/ai')).json().available).toBe(false); // ひな形のままでは使えない
    writeFileSync(join(root, 'api_keys.json'), JSON.stringify({ openai_api_key: SECRET_KEY }));
    expect((await call(port, 'POST', '/api/ai/setup')).json().created).toEqual([]);
    expect(readJson(root, 'api_keys.json').openai_api_key).toBe(SECRET_KEY);
  });

  it('API キーはブラウザに渡さない', async () => {
    const status = await call(port, 'GET', '/api/ai');
    expect(status.json().available).toBe(true);
    expect(status.text).not.toContain(SECRET_KEY);
    for (const path of ['/api/bootstrap', '/api/works', '/api/site', '/api/publish']) {
      expect((await call(port, 'GET', path)).text, path).not.toContain(SECRET_KEY);
    }
    expect((await call(port, 'GET', '/assets/../api_keys.json')).status).toBe(404);
  });

  it('画像つきで生成する。作品のリクエストタグも伝える', async () => {
    responses = [ok('  ふわふわの猫耳ちゃんです。  ')];
    const reply = await call(port, 'POST', '/api/ai/describe', {
      body: { id: 1, title: '最初の作品', category: 'Original', tags: ['ネコミミ'], image_path: '/static/img/works/1.webp', thumbnail: '/static/img/works/1.jpg', directives: { tone_preset: 'poetic' } },
    });
    expect(reply.json()).toEqual({ description: 'ふわふわの猫耳ちゃんです。', usedImage: true });
    const sent = calls.at(-1)!;
    expect(sent.url).toBe('https://openai.test/v1/chat/completions');
    expect(sent.headers.Authorization).toBe(`Bearer ${SECRET_KEY}`);
    expect(sent.body.model).toBe('gpt-4o-mini');
    const [text, picture] = sent.body.messages[0].content;
    expect(text.text).toContain('タイトル: 最初の作品');
    expect(text.text).toContain('リクエストタグ: ふわふわ');
    expect(text.text).toContain('詩的で余韻のある語り口');
    expect(picture.image_url.url).toMatch(/^data:image\/webp;base64,/);
  });

  it('大きい画像は縮小して送る（旧ツールは画像なしで生成していた）', async () => {
    const config = readJson(root, 'ai_config.json');
    writeFileSync(join(root, 'ai_config.json'), JSON.stringify({ ...config, image_max_bytes: 2000 }));
    responses = [ok([{ type: 'text', text: '配列形式の' }, { type: 'output_text', text: '応答' }])];
    const reply = await call(port, 'POST', '/api/ai/describe', { body: { title: 't', image_path: '/static/img/works/1.webp' } });
    expect(reply.json()).toEqual({ description: '配列形式の応答', usedImage: true });
    expect(calls.at(-1)!.body.messages[0].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    writeFileSync(join(root, 'ai_config.json'), JSON.stringify(config));
  });

  it('混雑 (429) のときは再試行し、だめなら文章だけ → 別のモデルの順に試す', async () => {
    const before = calls.length;
    responses = [fail(429, 'slow down'), fail(429, 'slow down'), fail(429, 'slow down'), ok('文章だけで生成')];
    const reply = await call(port, 'POST', '/api/ai/describe', { body: { title: 't', image_path: '/static/img/works/1.webp' } });
    expect(reply.json()).toEqual({ description: '文章だけで生成', usedImage: false });
    const attempts = calls.slice(before);
    expect(attempts).toHaveLength(4);
    expect(typeof attempts.at(-1)!.body.messages[0].content).toBe('string');
    expect(attempts.at(-1)!.body.model).toBe('gpt-4.1-mini');
  });

  it('エラーは分かる言葉で返し、API キーを含めない', async () => {
    responses = [fail(401, 'Incorrect API key provided'), fail(401, 'Incorrect API key provided')];
    const reply = await call(port, 'POST', '/api/ai/describe', { body: { title: 't', image_path: '/static/img/works/1.webp' } });
    expect(reply.status).toBe(400);
    expect(reply.json().error).toContain('認証エラー');
    expect(reply.text).not.toContain(SECRET_KEY);
    expect((await call(port, 'POST', '/api/ai/describe', { body: { title: '', image_path: '/static/img/works/1.webp' } })).json().error).toContain('タイトル');
    expect((await call(port, 'POST', '/api/ai/describe', { body: { title: 't', image_path: '/static/img/works/none.webp' } })).json().error).toContain('画像が見つかりません');
  });

  it('全体デフォルトの指示を保存できる', async () => {
    const saved = (await call(port, 'PUT', '/api/ai/defaults', { body: { directives: { tone_preset: 'minimal', must_include: ['color'], custom_instruction: 'やさしく' } } })).json();
    expect(saved.defaults).toMatchObject({ tone_preset: 'minimal', must_include: ['color'], custom_instruction: 'やさしく' });
    expect(readJson(root, 'ai_config.json')).toMatchObject({ model: 'gpt-4o-mini', description_generation: { tone_preset: 'minimal' } });
    expect((await call(port, 'GET', '/api/works')).json().works[0].ai_directives.tone_preset).toBe('minimal');
  });
});

// ---- 公開 ---------------------------------------------------------------------

describe('公開（一時リポジトリとローカルのリモートで確認）', () => {
  let port: number;
  let root: string;
  let remote: string;
  const git = async (args: string[], cwd = root) => {
    const result = await runGit(args, cwd);
    if (result.code !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  };

  beforeAll(async () => {
    root = await makeRoot();
    remote = mkdtempSync(join(tmpdir(), 'mgr-remote-'));
    roots.push(remote);
    await git(['init', '--bare', '-b', 'main'], remote);
    await git(['init', '-b', 'main']);
    for (const [key, value] of [['user.name', 'tester'], ['user.email', 'tester@example.com'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']]) {
      await git(['config', key, value]);
    }
    port = (await start(root)).port;
    // 非公開の内容と API キーを置く（どちらも git に入ってはいけない）
    await call(port, 'POST', '/api/requests', { body: { id: 'R-HIDE', date: '2026-11-14', status: 'received', public: false, text: 'ひみつのお願い', memo: 'メモ' } });
    writeFileSync(join(root, 'api_keys.json'), JSON.stringify({ openai_api_key: SECRET_KEY }));
  }, 60_000);

  it('リモートが無い間は、記録 (commit) までで止まる', async () => {
    const status = (await call(port, 'GET', '/api/publish')).json();
    expect(status).toMatchObject({ isRepo: true, branch: 'main', hasRemote: false, hasCommits: false });
    expect(status.groups.map((g: { name: string }) => g.name)).toEqual(['作品データ', '画像・動画', 'リクエスト', 'サイトの設定・文章', 'プログラム・その他']);
    expect(status.changes.map((c: { path: string }) => c.path).filter((p: string) => p.includes('private') || p.includes('api_keys'))).toEqual([]);

    const result = (await call(port, 'POST', '/api/publish', { body: { message: '最初の記録' } })).json();
    expect(result).toMatchObject({ ok: true, committed: true, pushed: false });
    expect(await git(['log', '--format=%s'])).toBe('最初の記録');
    const tracked = await git(['ls-files']);
    expect(tracked).toContain('data/requests.json');
    expect(tracked).not.toMatch(/private|api_keys/);
    expect(await git(['grep', '-c', 'ひみつ', 'HEAD', '--', '.']).catch(() => 'none')).toBe('none');
    expect((await call(port, 'GET', '/api/publish')).json().changes).toEqual([]);
  }, 60_000);

  it('データに問題があるときは公開しない', async () => {
    const good = readFileSync(join(root, 'data/requests.json'), 'utf-8');
    writeFileSync(join(root, 'data/requests.json'), JSON.stringify([{ id: 'R-HIDE', date: '2026-11-14', status: 'received', public: false, text: 'ひみつのお願い' }]));
    const check = (await call(port, 'POST', '/api/publish/check')).json();
    expect(check.ok).toBe(false);
    expect(check.problems[0]).toMatchObject({ file: 'data/requests.json' });

    const blocked = await call(port, 'POST', '/api/publish', { body: { message: 'だめな公開' } });
    expect(blocked.status).toBe(400);
    expect(blocked.json().check.ok).toBe(false);
    expect(await git(['log', '--format=%s'])).toBe('最初の記録');
    writeFileSync(join(root, 'data/requests.json'), good);
    expect((await call(port, 'POST', '/api/publish/check')).json()).toEqual({ ok: true, problems: [] });
    expect((await call(port, 'POST', '/api/publish', { body: { message: ' ' } })).status).toBe(400);
  }, 60_000);

  it('リモートがあれば push まで行う。リモート側の変更は取り込んでから送る', async () => {
    await git(['remote', 'add', 'origin', remote]);
    expect((await call(port, 'GET', '/api/publish')).json()).toMatchObject({ hasRemote: true, unpushed: true });
    const first = (await call(port, 'POST', '/api/publish', { body: { message: '送るだけ' } })).json();
    expect(first).toMatchObject({ ok: true, committed: false, pushed: true });
    expect(await git(['--git-dir', remote, 'log', '--format=%s', 'main'], tmpdir())).toBe('最初の記録');

    // 別の場所からリモートに変更が入る（閲覧数の日次更新を想定）
    const other = mkdtempSync(join(tmpdir(), 'mgr-other-'));
    roots.push(other);
    await git(['clone', remote, other], tmpdir());
    writeFileSync(join(other, 'data/counts.json'), '{}\n');
    await git(['add', '-A'], other);
    await git(['-c', 'user.name=bot', '-c', 'user.email=bot@example.com', 'commit', '-m', 'bot: counts'], other);
    await git(['push'], other);

    await call(port, 'PUT', '/api/site/notes', { body: { notes: [{ date: '2026-11-15', text: '公開テスト' }] } });
    expect((await call(port, 'GET', '/api/publish')).json().changes).toEqual([{ path: 'data/notes.json', state: '変更', group: 'サイトの設定・文章' }]);
    const second = (await call(port, 'POST', '/api/publish', { body: { message: 'ひとことを更新' } })).json();
    expect(second).toMatchObject({ ok: true, committed: true, pushed: true });
    expect((await git(['--git-dir', remote, 'log', '--format=%s', 'main'], tmpdir())).split('\n')).toEqual(['ひとことを更新', 'bot: counts', '最初の記録']);
    expect(existsSync(join(root, 'data/counts.json'))).toBe(true);
    expect((await call(port, 'GET', '/api/publish')).json()).toMatchObject({ changes: [], unpushed: false });
  }, 90_000);
});

describe('変更の一覧', () => {
  it('git status の出力を読み、作者に分かる区分に分ける', () => {
    const output = ['?? static/img/works/a b.webp', ' M data/works.json', 'R  new name.txt', 'old name.txt', ' D data/notes.json', 'A  tools/x.mjs', ''].join('\0');
    const changes = parseStatus(output);
    expect(changes).toEqual([
      { path: 'static/img/works/a b.webp', state: '追加', group: '画像・動画' },
      { path: 'data/works.json', state: '変更', group: '作品データ' },
      { path: 'new name.txt', state: '名前変更', group: 'プログラム・その他' },
      { path: 'data/notes.json', state: '削除', group: 'サイトの設定・文章' },
      { path: 'tools/x.mjs', state: '追加', group: 'プログラム・その他' },
    ]);
    expect(groupChanges(changes).map((g: { name: string }) => g.name)).toEqual(['作品データ', '画像・動画', 'サイトの設定・文章', 'プログラム・その他']);
    expect(classifyPath('data/requests.json')).toBe('リクエスト');
    expect(classifyPath('data/counts.json')).toBe('閲覧数・いいね');
  });
});

// ---- X 投稿用の画像 ------------------------------------------------------------

describe('X 投稿用の画像の文字組み', () => {
  const measure = (text: string) => [...text].length * 10; // 1文字 10px とみなす
  const measureAt = (size: number) => (text: string) => [...text].length * size;

  it('幅に合わせて折り返し、改行は保つ', () => {
    expect(wrapText('あいうえおかきくけこ', 50, measure)).toEqual(['あいうえお', 'かきくけこ']);
    expect(wrapText('あい\nうえ', 50, measure)).toEqual(['あい', 'うえ']);
    expect(wrapText('', 50, measure)).toEqual(['']);
  });

  it('句読点を行頭に置かず、開きかっこを行末に置かない（禁則）', () => {
    expect(wrapText('あいうえお、かきく', 50, measure)).toEqual(['あいうえお、', 'かきく']);
    expect(wrapText('あいうえ「かきく」', 50, measure)).toEqual(['あいうえ', '「かきく」']);
  });

  it('英単語の途中では折り返さない', () => {
    expect(wrapText('あいう hello', 60, measure)).toEqual(['あいう', 'hello']);
  });

  it('枠に収まる最大の文字サイズを選び、収まらなければ省略する', () => {
    const opts = { maxWidth: 400, maxHeight: 200, maxFontSize: 40, minFontSize: 20, lineHeight: 1.5 };
    expect(fitText('ねこ', opts, measureAt)).toEqual({ fontSize: 40, lines: ['ねこ'], truncated: false });
    const long = fitText('あ'.repeat(500), opts, measureAt);
    expect(long.fontSize).toBe(20);
    expect(long.truncated).toBe(true);
    expect(long.lines.at(-1)!.endsWith('…')).toBe(true);
    expect(long.lines.length * 20 * 1.5).toBeLessThanOrEqual(200);
    expect(ellipsize('あいうえおかきく', 50, measure)).toBe('あいうえ…');
  });
});
