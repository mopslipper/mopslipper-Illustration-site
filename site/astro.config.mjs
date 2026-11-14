// @ts-check
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';

// 公開先は data/config.json の site_url / base_path が唯一の設定元。
// 一時的に変えたいときは環境変数 SITE_URL / BASE_PATH で上書きできる。
const config = JSON.parse(
  readFileSync(new URL('../data/config.json', import.meta.url), 'utf-8').replace(/^\uFEFF/, ''),
);
const site = process.env.SITE_URL ?? config.site_url;
const base = (process.env.BASE_PATH ?? config.base_path ?? '').replace(/\/$/, '') || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  build: {
    format: 'file',
  },
  vite: {
    server: {
      fs: {
        // 正準メディアディレクトリ ../static/img をdevサーバから配信可能にする
        allow: ['..'],
      },
    },
  },
});
