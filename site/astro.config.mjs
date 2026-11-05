// @ts-check
import { defineConfig } from 'astro/config';

// 開発者向けページ（`npm run dev` のときだけルート登録。本番ビルドには出力されない）
/** @type {import('astro').AstroIntegration} */
const devOnlyPages = {
  name: 'dev-only-pages',
  hooks: {
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command !== 'dev') return;
      injectRoute({ pattern: '/dev/requests', entrypoint: './src/dev/requests.astro' });
    },
  },
};

// 公開URL: https://mopslipper.github.io/mopslipper-Illustration-site/
// dev/preview でも base が適用される（本番URL構造をローカルで再現）
export default defineConfig({
  site: 'https://mopslipper.github.io',
  base: '/mopslipper-Illustration-site',
  trailingSlash: 'ignore',
  integrations: [devOnlyPages],
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
