// @ts-check
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 公開先は data/config.json の site_url / base_path が唯一の設定元。
// 一時的に変えたいときは環境変数 SITE_URL / BASE_PATH で上書きできる。
const config = JSON.parse(
  readFileSync(new URL('../data/config.json', import.meta.url), 'utf-8').replace(/^\uFEFF/, ''),
);
const site = process.env.SITE_URL ?? config.site_url;
const base = (process.env.BASE_PATH ?? config.base_path ?? '').replace(/\/$/, '') || '/';

/**
 * 確認用のサイト (astro dev) に、画像フォルダ ../static/img の増減を見張らせる。
 * 画像は site/ の外にあるため、そのままでは新しく追加した作品の画像に気づかず、
 * サーバを再起動するまで「No image」になってしまう。
 * @type {import('vite').Plugin}
 */
const watchMediaDir = {
  name: 'watch-media-dir',
  apply: 'serve',
  configureServer(server) {
    server.watcher.add(fileURLToPath(new URL('../static/img', import.meta.url)));
  },
};

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  build: {
    format: 'file',
  },
  vite: {
    plugins: [watchMediaDir],
    server: {
      fs: {
        // 正準メディアディレクトリ ../static/img をdevサーバから配信可能にする
        allow: ['..'],
      },
    },
  },
});
