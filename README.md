# Illustration Portfolio Site

**2次元イラスト作家向けポートフォリオサイト**  
Python + Jinja2による静的サイトジェネレーター / GitHub Pages対応

---

## 📋 プロジェクト概要

- **目的**: イラスト作品のポートフォリオ展示と限定コンテンツ共有
- **技術スタック**: Python 3.10, Jinja2 3.1.3, 静的HTML生成
- **ホスティング**: GitHub Pages
- **URL**: https://mopslipper.github.io/mopslipper-Illustration-site/

---

## 🗂️ ディレクトリ構造

```
illustration_site/
├── data/                           # JSONデータ
│   ├── config.json                # サイト全体の設定
│   ├── works.json                 # 作品データ（28件）
│   └── commission.json            # 依頼受付情報
│
├── templates/                      # Jinja2テンプレート
│   ├── base.html                  # ベーステンプレート（lightbox.js追加）
│   ├── index.html                 # ホームページ
│   ├── gallery.html               # ギャラリー一覧（ページネーション対応）
│   ├── work_detail.html           # 作品詳細ページ
│   ├── cliantshare.html           # 🔒限定コンテンツ（削除済み・プロジェクト完了）
│   ├── commission.html            # 依頼情報
│   ├── about.html                 # Aboutページ
│   ├── contact.html               # コンタクトフォーム
│   └── privacy.html               # プライバシーポリシー
│
├── static/                         # 静的ファイル
│   ├── css/
│   │   └── style.css             # ライトボックススタイル含む
│   ├── js/
│   │   ├── main.js
│   │   ├── gallery.js            # フィルター・検索・ページネーション
│   │   ├── work_detail.js
│   │   └── lightbox.js           # 🆕 画像ビューア機能
│   └── img/
│       └── works/                # 公開作品画像（28件）
│           ├── cat-girl-001.webp
│           ├── 028-blonde_zoom_kururin.mp4
│           └── ... (26件の画像・動画)
│
├── dist/                          # ビルド出力先（GitHub Pagesデプロイ）
│
├── generator.py                   # メインビルドスクリプト
├── encrypt_images_multi.py        # 🔒画像暗号化スクリプト（複数ディレクトリ対応）
├── encrypt_images.py              # 旧：単一ディレクトリ暗号化（非推奨）
├── create_thumbnail.py            # 動画サムネイル生成（OpenCV使用）
├── encrypt_images_multi.py        # 🔒画像暗号化スクリプト（プロジェクト完了
└── README.md                      # このファイル
```

---
🎨 主要機能

### 1. ギャラリーシステム
- **レスポンシブグリッド**: モバイル2列、PC3列表示
- **フィルタリング**: カテゴリ（Original, Animation, Manga, Fanart, Live2D）
- **検索機能**: タイトル・タグ・説明文から検索
- **ページネーション**: 30件以上の作品に対応（現在28件）
- **R-18フィルター**: 成人向けコンテンツ表示制御（予定なし表示）

### 2. ライトボックス（画像ビューア）
**最新の2カラムレイアウト**: 左側に画像、右側に詳細情報

#### 機能一覧
- ✅ **全画面表示**: サムネイルクリックで開く
- ✅ **ズーム機能**: 画像クリックで2倍ズームON/OFF
- ✅ **キーボード操作**:
  - `←` / `→`: 前後の作品に移動
  - `Esc`: ライトボックスを閉じる
  - `Space`: ズームON/OFF
- ✅ **作品情報表示**:
  - タイトル（1.4rem、太字）
  - カテゴリ・投稿日（バッジ表示）
  - タグ一覧（ピンク色バッジ）
  - 作品説明文
- ✅ **レスポンシブ対応**: モバイルでは縦並び（上：画像、下：情報）

#### 技術仕様
- **ファイル**: `static/js/lightbox.js` (354行)
- **クラス設計**: ES6 Class構文
- **データ収集**: `collectImages()` - DOM解析でメタデータ取得
- **表示制御**: `showImage()` - 動的HTML生成
- **状態管理**: インデックスベースのナビゲーション

### 3. 動画作品対応
- **対応形式**: `.mp4`, `.mov`, `.webm`
- **サムネイル生成**: `create_thumbnail.py`（OpenCV使用）
- **実装例**: 作品#10, #13, #28
- **注意**: ライトボックスでは静止画のみ表示

### 4. マルチイメージギャラリー
- **データ構造**: `additional_images` 配列で複数画像を管理
- **実装例**: 作品#26（ちびキャラ3枚）、作品#27（金髪ちびキャラ3枚）
- **表示**: 作品詳細ページでサムネイルクリックで切替

### 5. 準備中表示システム
- **BOOTH/FANBOX** opencv-python

# 動作確認
python generator.py
```

### 2. 作品を追加する

#### 静止画作品
1. `data/works.json` に作品情報を追加
   ```json
   {
     "id": 29,
     "slug": "new-work-029",
     "title": "新作タイトル",
     "date": "2026-01-15",
     "image_path": "/static/img/works/029-new-work.webp",
     "thumbnail": "/static/img/works/029-new-work.jpg",
     "tags": ["オリジナル", "タグ1", "タグ2"],
     "category": "Original",
     "description": "作品説明文",
     "nsfw": false,
     "external_links": {}
   }
   ```
2. 画像を `static/img/works/` に配置
3. `python generator.py` でビルド

#### 動画作品
1. 動画ファイル（.mp4）を `static/img/works/` に配置
2. サムネイル生成:
   ```bash
   python create_thumbnail.py
   # 入力: static/img/works/029-animation.mp4
   # 出力: static/img/works/029-animation-thumb.png
   ```
3. `data/works.json` に追加（`image_path`に動画、`thumbnail`にPNG）
4. `python generator.py` でビルド

#### マルチイメージ作品（複数画像）
```json
{
  "id": 30,
  "slug": "collection-030",
  "title": "イラスト集",
  "image_path": "/static/img/works/030-img1.webp",
  "thumbnail": "/static/img/works/030-img1.jpg",
  "additional_images": [
    "/static/img/works/030-img2.webp",
    "/static/img/works/030-img3.webp"
  ],
  "tags": ["オリジナル", "コレクション"]
}
```

### 2. 作品を追加する

#### 通常の作品（公開）
1. `data/works.json` に作品情報を追加
2. 画像を `static/img/works/` に配置
3. `python generator.py` でビルド

#### 限定コンテンツ（Cliant Share）
```bash
# 1. 新しいディレクトリを作成
mkdir static/img/cliantshare/new_collection

# 2. PNG画像を配置（ファイル名: 01.png, 02.png, 03.png...）
# 必ず連番で命名すること

# 3. 暗号化
python encrypt_images_multi.py
# → static/img/cliantshare_encrypted/new_collection/*.enc が生成される

# 4. サイトをビルド
python generator.py
（フィルター・検索・ページネーション）
- `dist/works/*.html` - 作品詳細ページ（28件）
- `dist/commission.html` - 依頼情報
- `dist/about.html` - Aboutページ
- `dist/contact.html` - コンタクトフォーム
- `dist/privacy.html` - プライバシーポリシーデプロイ
git add .
git commit -m "Add new cliantshare collection"
git push origin main
```

### 3. サイト全体のビルド

```bash
python generator.py
```

以下が生成されます：
- `dist/index.html` - ホーム
- `dist/gallery.html` - ギャラリー
- `dist/works/*.html` - 作品詳細ページ（25件）
- `dist/cliantshare.html` - 限定コンテンツ
- `dist/commission.html` - 依頼情報
- その他

### 4. GitHub Pagesへデプロイ

```bash
git add .
git commit -m "Update site content"
git push origin main
```

1-2分後にGitHub Pagesに反映されます。

---

## 📝 重要な設定ファイル

### data/config.json
```json
{
  "site_title": "facet boy - Illustration Portfolio",
  "site_description": "2次元美少女イラスト作品集",
  "author": "facet boy",
  "base_path": "/mopslipper-Illustration-site",
  "site_url": "https://mopslipper.github.io",
  "twitter_handle": "@facet_boy",
  "formspree_id": "xnjjazjr"
}
```

### data/works.json
```json
[
  {
    "id": 1,
    "title": "作品タイトル",
    "description": "作品説明",
    "date": "2024-12-25",
    "tags": ["オリジナル", "女の子"],
    "image": "/static/img/works/01_work.webp",
    "thumbnail": "/static/img/works/01_work.webp",
    "rating": "safe",
    "twitter_card_image": "/static/img/works/01_work.jpg"
  }
]
```

**rating**: `safe`, `sensitive`, `r15`, `r18`

### .gitignore
```
# 暗号化前の元画像（GitHub非公開）
static/img/cliantshare/
static/img/works/cliant share/

# その他
__pycache__/
*.pyc
dist/
```

---

## 🛠️ トラブルシューティング
ライトボックスが動作しない

1. **JavaScript読み込み確認**
   ```html
   <!-- base.html に存在するか確認 -->
   <script src="{{ base_path }}/static/js/lightbox.js"></script>
   ```

2. **ブラウザコンソールでエラー確認**
   - F12 → Console タブ
   - `Uncaught ReferenceError` などのエラー

3. **動画作品の除外確認**
   - ライトボックスは静止画のみ対応
   - `.mp4`, `.mov`, `.webm` は自動除外

### ページネーションが表示されない

- 30件未満の場合は自動で非表示
- 現在28件のため、あと2件追加すると表示されます

### レスポンシブグリッドが崩れる

1. **キャッシュクリア**: Ctrl + Shift + R（強制再読み込み）
2. **CSS確認**:
   ```css
   /* style.css */
   .works-grid { grid-template-columns: repeat(2, 1fr); } /* モバイル */
   @media (min-width: 768px) {
     .works-grid { grid-template-columns: repeat(3, 1fr); } /* PC */
   }es_multi.py
   python generator.py
   ```

### 文字化けが発生する

すべてのファイルを**UTF-8（BOM無し）**で保存してください。
- VS Codeで右下の文字コード表示をクリック → "UTF-8" を選択

### Twitter Cardが表示されない
🎯 今後の拡張案

### 実装推奨機能
1. **ソート機能**: 新着順・古い順・人気順
2. **カラーパレット検索**: 色ベースのフィルタリング
3. **作品シリーズ**: 関連作品のグループ化
4. **ダウンロード統計**: 作品ごとの閲覧数
5. **おすすめ作品**: 類似作品の表示
6. **AIチャットボット**: 作品に関する問い合わせ対応

### 技術的改善
- **画像遅延読み込み**: Intersection Observer API
- **プログレッシブ画像**: 低解像度→高解像度
- **Service Worker**: オフライン対応

## 🔐 セキュリティに関する注意

### Cliant Shareの限界
- **クライアントサイド暗号化**のため、完全な秘匿性はありません
- JavaScriptを解析すれば、誰でもパスワードと復号化ロジックを発見可能
- **目的**: GitHubリポジトリを直接見ただけでは画像が見られないようにする

### 推奨される使い方
- **重要機密ではない画像**の共有に使用
- 真に秘密にしたい場合は、サーバーサイド認証が必要

---

## 📞 連絡先

- **X (Twitter)**: [@facet_boy](https://twitter.com/facet_boy)
- **Pixiv**: [facet boy](https://www.pixiv.net/users/98890952)
- **GitHub**: [mopslipper](https://github.com/mopslipper)
- **Email**: Formspreeフォーム（ID: xnjjazjr）

---2
- ✅ ライトボックスを**2カラムレイアウト**に変更（左：画像、右：詳細情報）
- ✅ 著作権表示を削除（ユーザー要望）
- ✅ モバイルでは縦並びレイアウトに自動切替

### 2026-01-12（ライトボックス機能強化）
- ✅ **詳細情報表示**: タイトル、カテゴリ、投稿日、タグ、説明文
- ✅ 画像カウンター（"1 / 28"）を削除
- ✅ 著作権表示を追加（後に削除）

### 2026-01-12（ライトボックス実装）
- ✅ **ライトボックス機能**を実装
  - 全画面画像ビューア
  - ズーム機能（2倍）
  - キーボードナビゲーション（←→Esc Space）
  - 前後ボタン
  - ローディングアニメーション

### 2026-01-11（ギャラリー改善）
- ✅ **ページネーション**システム実装（30件以上対応）
- ✅ ギャラリーサイドバー間隔を縮小（1rem→0.5rem）
- ✅ R-18フィルターに"(予定なし)"表示
- ✅ 検索・タグクラウド機能の初期化順序を修正

### 2026-01-11（コンテンツ整理）
- ✅ Fanart・Live2Dカテゴリに"(準備中)"表示
- ✅ **Cliant Share完了**: 暗号化画像75件を削除（GitHub・ローカル）
- ✅ Aboutページに"Cliant Share"リンク追加

これは2Dイラスト作家向けポートフォリオサイトで、Python+Jinja2で静的サイトを生成し、
GitHub Pagesでホスティングしています。

主要な実装済み機能：
1. ギャラリーシステム（フィルター・検索・ページネーション）
2. ライトボックス（2カラムレイアウト: 左画像・右詳細情報）
3. 動画作品対応（サムネイル自動生成）
4. マルチイメージギャラリー（1作品に複数画像）
5. レスポンシブデザイン（モバイル2列・PC3列）

Cliant Share（暗号化画像配信）プロジェクトは完了し、全ファイル削除済み。
現在28作品を公開中
- ✅ サムネイルのタグ表示を削除
- ✅ **レスポンシブグリッド修正**: モバイル2列、PC3列

### 2026-01-10（作品追加）
- ✅ **作品#28追加**: ブロンドズームくるりん（動画・MP4）
- ✅ 動画サムネイル自動生成（OpenCV）

### 2026-01-11（Cliant Share開発）
- ✅ Cliant Shareを**複数ディレクトリ対応**に変更
- ✅ `encrypt_images_multi.py` を作成（複数ディレクトリを自動処理）
- ✅ ディレクトリ選択UIを追加（カード形式）
- ✅ パスワード難読化を修正（シンプルな実装に変更）

### 2026-01-10（Cliant Share初版）
- ✅ Cliant Share機能を追加（単一ディレクトリ対応）
- ✅ XOR暗号化による画像保護
- ✅ パスワード認証システム

### 2024-12-25（初回リリース）re機能を追加（単一ディレクトリ対応）
- ✅ XOR暗号化による画像保護
- ✅ パスワード認証システム

### 2024-12-25
- 🎉 初回デプロイ
- 作品25件を公開
- ギャラリー、検索、タグ機能実装

---

## 📚 次回のAIセッションで伝えるべきこと

次回チャットを開始したら、以下を伝えてください：

```
README.mdを読んで、このプロジェクトの構造を理解してください。
これは2Dイラスト作家向けポートフォリオサイトで、Python+Jinja2で静的サイトを生成しています。
特に重要なのは、Cliant Share（限定コンテンツ）機能で、複数ディレクトリに分けた暗号化画像を
パスワード認証後にブラウザで復号化して表示する仕組みです。
```

これにより、次回のAIが迅速にプロジェクトを理解できます。

---

## ライセンス

このコードはポートフォリオサイト用に作成されたものです。  
イラスト作品の著作権は facet boy に帰属します。
