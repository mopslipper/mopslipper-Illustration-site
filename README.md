# 2次元美少女イラスト作家向けWebサイト

Pythonで静的サイトを生成する、イラスト作家向けポートフォリオ＆依頼受付サイトです。

## 特徴

- ✨ **完全静的サイト** - GitHub Pages / Netlify等に無料でホスティング可能
- 🎨 **レスポンシブデザイン** - PC・タブレット・スマホ完全対応
- 🌙 **ダークモード** - 作品が映える暗色デザイン
- 🔞 **R-18対応** - 年齢確認モーダル＋フィルタ機能
- 📱 **SNS最適化** - OGP設定済み、シェアしやすい
- 🚀 **高速表示** - 軽量なHTML/CSS/JS、画像遅延読み込み
- 📝 **JSONで管理** - コードを触らず作品データを更新可能

## プロジェクト構造

```
illustration_site/
├── generator.py          # サイト生成スクリプト
├── requirements.txt      # Python依存パッケージ
├── data/                 # データファイル
│   ├── config.json       # サイト設定
│   ├── works.json        # 作品データ
│   └── commission.json   # 依頼情報
├── templates/            # HTMLテンプレート
│   ├── base.html
│   ├── home.html
│   ├── gallery.html
│   ├── work_detail.html
│   ├── commission.html
│   ├── about.html
│   ├── contact.html
│   └── privacy.html
├── static/               # 静的ファイル
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── main.js
│   │   ├── gallery.js
│   │   └── work_detail.js
│   └── img/
│       ├── hero.svg
│       └── works/
└── dist/                 # 生成されたサイト（ビルド後）
```

## セットアップ

### 1. 必要な環境

- Python 3.8以上
- pip

### 2. 依存パッケージのインストール

```bash
pip install -r requirements.txt
```

### 3. データを編集

#### `data/config.json`
サイト全体の設定（サイト名、SNSリンク等）

#### `data/works.json`
作品データ（タイトル、日付、タグ、画像パス等）

#### `data/commission.json`
依頼情報（料金、受付状況、規約等）

### 4. 画像を配置

`static/img/works/` に作品画像を配置してください。

推奨サイズ：
- 作品画像: 3000x4000px程度
- サムネイル: 600x800px程度
- Hero画像: 1920x1080px

### 5. サイトをビルド

```bash
python generator.py
```

`dist/` ディレクトリにHTMLが生成されます。

### 6. ローカルで確認

```bash
cd dist
python -m http.server 8000
```

ブラウザで `http://localhost:8000` を開く

## カスタマイズ

### 色を変更

`static/css/style.css` の `:root` セクションで色を変更できます：

```css
:root {
    --accent-primary: #ff69b4;   /* アクセントカラー */
    --accent-secondary: #ff1493; /* アクセントカラー（濃） */
    --bg-primary: #0f0f0f;       /* 背景色 */
}
```

### お問い合わせフォーム

`data/config.json` の `contact_form_action` を設定：

```json
"contact_form_action": "https://formspree.io/f/YOUR_FORM_ID"
```

[Formspree](https://formspree.io/) で無料フォームを作成できます。

## デプロイ

### GitHub Pagesにデプロイ

1. GitHubリポジトリを作成
2. `dist/` の内容をpush
3. Settings → Pages → Branch を `main` → `/root` に設定

### Netlifyにデプロイ

1. Netlifyアカウント作成
2. `dist/` フォルダをドラッグ&ドロップ
3. 独自ドメイン設定（任意）

## 更新方法

### 作品を追加

1. `data/works.json` に新しい作品データを追加
2. 作品画像を `static/img/works/` に配置
3. `python generator.py` でビルド
4. `dist/` をアップロード

### 依頼状況を変更

1. `data/commission.json` の `status` を編集
2. `python generator.py` でビルド
3. `dist/` をアップロード

## R-18作品の扱い

- 年齢確認モーダルが初回アクセス時に表示
- `localStorage` で確認状態を保存
- `works.json` の `nsfw: true` でR-18作品を指定
- ギャラリーページで「R-18作品を非表示」チェックボックスあり

## ライセンス

このテンプレートは自由に使用・改変できます。

## トラブルシューティング

### ビルドエラー

- Python 3.8以上がインストールされているか確認
- `pip install -r requirements.txt` が完了しているか確認
- `data/` の各JSONファイルが正しい形式か確認

### 画像が表示されない

- 画像パスが正しいか確認（`/static/img/works/...`）
- ファイル名の大文字小文字が一致しているか確認
- 画像ファイルが実際に存在するか確認

### お問い合わせフォームが動かない

- Formspree等の外部サービスのForm IDが正しいか確認
- `config.json` の `contact_form_action` が設定されているか確認

## サポート

質問や不具合報告は、GitHubのIssuesまでお願いします。
