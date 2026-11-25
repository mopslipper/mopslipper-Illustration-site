/**
 * Abacus API から全作品の閲覧数・いいね数を取得して data/counts.json に保存する。
 * GitHub Actions (update-counts.yml) から日次実行。手動実行: node tools/fetch_counts.mjs
 * - レート制限 30req/10s に収まるよう、BATCH 件ずつ取得して WAIT_MS 待つ
 * - 未作成キー(404)は 0 扱い
 * - 500・429・タイムアウトなどは、待ってから送り直す。それでも取れない数は前回の値を残す
 * - サービスがとても遅いときは、全体で 15 分を過ぎたら残りを前回の値のまま保存して終える
 * - 1件も取れなかったとき（サービス停止中）だけ失敗にして、ファイルは書き換えない
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRetryableStatus, mergeCounts, retryDelayMs } from './counts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COUNTS_FILE = resolve(ROOT, 'data/counts.json');
const API = 'https://abacus.jasoncameron.dev';
const NAMESPACE = 'mopslipper-illustration-site';
const BATCH = 12;
const WAIT_MS = 11_000;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 10_000;
/** サービスがとても遅いときに、いつまでも終わらないのを防ぐ。過ぎたら残りは前回の値のまま */
const DEADLINE = Date.now() + 15 * 60_000;

const works = JSON.parse(readFileSync(resolve(ROOT, 'data/works.json'), 'utf-8'));
const ids = works.map((w) => w.id);
const previous = existsSync(COUNTS_FILE) ? JSON.parse(readFileSync(COUNTS_FILE, 'utf-8')) : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 取れなければ null（理由はログに出す） */
async function getValue(key) {
  for (let attempt = 0; ; attempt++) {
    if (Date.now() > DEADLINE) {
      if (attempt > 0) console.warn(`${key}: time limit reached`);
      return null;
    }
    let reason;
    let retryAfter = null;
    try {
      const res = await fetch(`${API}/get/${NAMESPACE}/${key}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status === 404) return 0;
      if (res.ok) {
        const { value } = await res.json();
        if (typeof value === 'number') return value;
        reason = 'unexpected response';
      } else {
        reason = `HTTP ${res.status}`;
        if (!isRetryableStatus(res.status)) {
          console.warn(`${key}: ${reason}`);
          return null;
        }
        retryAfter = res.headers.get('Retry-After');
      }
    } catch (error) {
      reason = error?.name === 'TimeoutError' ? 'timeout' : (error?.message ?? String(error));
    }
    if (attempt >= MAX_RETRIES) {
      console.warn(`${key}: ${reason} (gave up after ${attempt + 1} tries)`);
      return null;
    }
    await sleep(retryDelayMs(attempt, retryAfter));
  }
}

const keys = ids.flatMap((id) => [`views-${id}`, `likes-${id}`]);
const fetched = new Map();

for (let i = 0; i < keys.length; i += BATCH) {
  if (Date.now() > DEADLINE) {
    console.warn(`time limit reached: skipped ${keys.length - i} keys (previous values kept)`);
    break;
  }
  const batch = keys.slice(i, i + BATCH);
  const results = await Promise.all(batch.map((k) => getValue(k)));
  batch.forEach((k, j) => fetched.set(k, results[j]));
  console.log(`fetched ${Math.min(i + BATCH, keys.length)}/${keys.length}`);
  if (i + BATCH < keys.length) await sleep(WAIT_MS);
}

const { counts, failed, kept } = mergeCounts(ids, previous, fetched);

if (failed.length === keys.length) {
  console.error(`::error::Abacus から1件も取得できませんでした。data/counts.json は前回のまま残します。`);
  process.exit(1);
}

writeFileSync(COUNTS_FILE, JSON.stringify(counts, null, 2) + '\n');
console.log(`wrote data/counts.json (${ids.length} works)`);
if (failed.length > 0) {
  const listed = failed.slice(0, 20).join(', ') + (failed.length > 20 ? ` ほか ${failed.length - 20} 件` : '');
  console.log(`::warning::${failed.length}/${keys.length} 件を取得できませんでした（前回の値を残したもの ${kept.length} 件）: ${listed}`);
}
