# mopslipper - Portfolio of Illustrations

個人イラストのポートフォリオサイト。
公開URL: https://mopslipper.github.io/mopslipper-Illustration-site/

## 構成

- `site/` … Astro 製の静的サイト本体（ギャラリー / Commission / Contact / 限定共有）
- `data/` … 作品・サイト設定データ（works.json / config.json / commission.json）
- `static/img/` … 画像・動画の原本（works_manager と Astro が共有）
- `works_manager_qt.py` … 作品登録 GUI（PyQt6）。`run_works_manager.bat` で起動
- `tools/` … 限定共有コンテンツの暗号化ツールなど

## 開発

```
cd site
npm install
npm run dev      # 開発サーバ
npm test         # 契約テスト (vitest)
npm run build    # 本番ビルド
```

## デプロイ

main ブランチへの push で GitHub Actions が自動ビルドし GitHub Pages に公開されます。
