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

## 閲覧数・いいね機能

カウントは無料カウンター API([Abacus](https://abacus.jasoncameron.dev), namespace `mopslipper-illustration-site`, キー `views-{id}` / `likes-{id}`)に保存されます。

### カウントが更新されるタイミング(仕様)

| 場所 | 表示方法 | 更新タイミング |
| --- | --- | --- |
| 作品詳細ページ | `counter.ts` が API を直接呼ぶ | リアルタイム(ページを開くたびに閲覧数 +1) |
| ギャラリーのカード | ビルド時に `data/counts.json` から静的に埋め込み | 1日1回(最大約1日遅れ) |

ギャラリーを静的表示にしているのは、1ページに数十作品が並ぶためページ表示ごとに全作品分の API を呼ぶと Abacus のレート制限(30リクエスト/10秒/IP)に達するためです。これは意図した設計です。

### 日次更新の流れ

1. 毎日 JST 3:00 に `.github/workflows/update-counts.yml` が起動(手動実行も可: Actions タブ → update-counts → Run workflow)
2. `tools/fetch_counts.mjs` が全作品のカウントを API から取得し `data/counts.json` を更新(15件ずつ・11秒間隔、429 時は自動リトライ)
3. 変化があれば自動 commit → deploy.yml をトリガーしてサイト再ビルド・公開

補足:

- いいねは1作品につき1回まで(取消不可、`localStorage` の `liked-{id}` で判定)
- Abacus のキーは最終アクセスから6ヶ月で失効するが、日次取得がアクセスを兼ねるため実質失効しない
- ギャラリーの数字を今すぐ反映したい場合は update-counts を手動実行する

