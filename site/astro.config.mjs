// @ts-check
import { defineConfig } from 'astro/config';

// 公開URL: https://mopslipper.github.io/mopslipper-Illustration-site/
// dev/preview でも base が適用される（本番URL構造をローカルで再現）
export default defineConfig({
  site: 'https://mopslipper.github.io',
  base: '/mopslipper-Illustration-site',
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
