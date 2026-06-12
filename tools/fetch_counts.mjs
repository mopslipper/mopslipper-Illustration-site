/**
 * Abacus API から全作品の閲覧数・いいね数を取得して data/counts.json に保存する。
 * GitHub Actions (update-counts.yml) から日次実行。手動実行: node tools/fetch_counts.mjs
 * - レート制限 30req/10s に収まるよう 25req ごとに 11 秒待機
 * - 未作成キー(404)は 0 扱い
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://abacus.jasoncameron.dev';
const NAMESPACE = 'mopslipper-illustration-site';
const BATCH = 15;
const WAIT_MS = 11_000;
const MAX_RETRIES = 5;

const works = JSON.parse(readFileSync(resolve(ROOT, 'data/works.json'), 'utf-8'));
const ids = works.map((w) => w.id);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getValue(key) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/get/${NAMESPACE}/${key}`);
    if (res.status === 404) return 0;
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('Retry-After')) || WAIT_MS;
      await sleep(retryAfter + 1_000);
      continue;
    }
    if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
    const { value } = await res.json();
    return value;
  }
}

const keys = ids.flatMap((id) => [`views-${id}`, `likes-${id}`]);
const values = new Map();

for (let i = 0; i < keys.length; i += BATCH) {
  const batch = keys.slice(i, i + BATCH);
  const results = await Promise.all(batch.map((k) => getValue(k)));
  batch.forEach((k, j) => values.set(k, results[j]));
  console.log(`fetched ${Math.min(i + BATCH, keys.length)}/${keys.length}`);
  if (i + BATCH < keys.length) await sleep(WAIT_MS);
}

const counts = {};
for (const id of ids) {
  counts[id] = { views: values.get(`views-${id}`), likes: values.get(`likes-${id}`) };
}

writeFileSync(resolve(ROOT, 'data/counts.json'), JSON.stringify(counts, null, 2) + '\n');
console.log(`wrote data/counts.json (${ids.length} works)`);
