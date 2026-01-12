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
│   ├── works.json                 # 作品データ（25件）
│   └── commission.json            # 依頼受付情報
│
├── templates/                      # Jinja2テンプレート
│   ├── base.html                  # ベーステンプレート
│   ├── index.html                 # ホームページ
│   ├── gallery.html               # ギャラリー一覧
│   ├── work_detail.html           # 作品詳細ページ
│   ├── cliantshare.html           # 🔒限定コンテンツ（複数ディレクトリ対応）
│   ├── commission.html            # 依頼情報
│   ├── about.html                 # Aboutページ
│   ├── contact.html               # コンタクトフォーム
│   └── privacy.html               # プライバシーポリシー
│
├── static/                         # 静的ファイル
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── main.js
│   │   ├── gallery.js
│   │   └── work_detail.js
│   └── img/
│       ├── works/                 # 公開作品画像
│       ├── cliantshare/           # 🚫限定コンテンツ（ローカルのみ・.gitignore）
│       │   ├── 1st_base/         # 46枚のPNG画像
│       │   ├── 2nd_miku-inspired/
│       │   └── 3rd/
│       └── cliantshare_encrypted/ # ✅暗号化済み限定コンテンツ（GitHub公開）
│           └── 1st_base/         # 01.enc ~ 46.enc
│
├── dist/                          # ビルド出力先（GitHub Pagesデプロイ）
│
├── generator.py                   # メインビルドスクリプト
├── encrypt_images_multi.py        # 🔒画像暗号化スクリプト（複数ディレクトリ対応）
├── encrypt_images.py              # 旧：単一ディレクトリ暗号化（非推奨）
├── img_converter.py               # WebP変換ツール
└── README.md                      # このファイル
```

---

## 🔒 Cliant Share（限定コンテンツ）システム

### 概要
- パスワード保護された画像閲覧システム
- **複数ディレクトリ対応**：ディレクトリごとに画像グループを管理
- クライアントサイド暗号化・復号化により、GitHubリポジトリ経由でも画像を保護

### 技術仕様

#### 1. 暗号化方式
- **アルゴリズム**: XOR暗号化
- **パスワード**: `Viskorin_temp`
- **ファイル形式**: `.enc`（暗号化されたPNGデータ）

#### 2. パスワード難読化
JavaScriptにパスワードを埋め込む際、以下の手法で難読化：
```javascript
// ASCIIコード配列として分割
const _0x4a2b = ['86','105','115','107','111','114','105','110','95','116','101','109','112'];
// 動的に再構成
const _0x1c5e = (h) => String.fromCharCode(...h.map(x => parseInt(x)));
const _k = () => _0x1c5e(_0x4a2b);  // 'Viskorin_temp' を返す
```

**注意**: これはあくまで「見つけにくくする」ための難読化で、完全な秘匿ではありません。静的サイトの性質上、決定的なセキュリティは実現不可能です。

#### 3. フロー
```
[パスワード入力] → [認証成功] → [ディレクトリ選択] → [画像復号化] → [ビューア表示]
```

1. **パスワード認証**: ユーザーがパスワードを入力
2. **ディレクトリ選択**: 複数のディレクトリカードから選択
3. **画像復号化**: 選択されたディレクトリの`.enc`ファイルを取得し、JavaScriptで復号化
4. **表示**: Blob URLとして画像を表示（ダウンロード可能）

---

## 🚀 使い方

### 1. 初回セットアップ

```bash
# 依存関係インストール
pip install jinja2

# 動作確認
python generator.py
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

# 5. 動作確認（ローカル）
# dist/cliantshare.html をブラウザで開いてテスト

# 6. デプロイ
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

### Cliant Shareで画像が表示されない

1. **パスワードを確認**
   - 現在のパスワード: `Viskorin_temp`
   - `encrypt_images_multi.py` と `templates/cliantshare.html` の `_0x4a2b` が一致しているか

2. **暗号化ファイルを確認**
   ```bash
   ls static/img/cliantshare_encrypted/1st_base/
   # 01.enc, 02.enc... が存在するか
   ```

3. **ブラウザの開発者ツールでエラー確認**
   - F12 → Console タブ
   - `Failed to load image` などのエラーがないか

4. **再暗号化**
   ```bash
   python encrypt_images_multi.py
   python generator.py
   ```

### 文字化けが発生する

すべてのファイルを**UTF-8（BOM無し）**で保存してください。
- VS Codeで右下の文字コード表示をクリック → "UTF-8" を選択

### Twitter Cardが表示されない

- WebP形式は非対応 → JPG/PNG画像を使用
- `twitter_card_image` に絶対URL（`/mopslipper-Illustration-site/static/img/...`）を指定

### GitHub Pagesで404エラー

- `data/config.json` の `base_path` が正しいか確認
- リポジトリ名と一致させる: `/mopslipper-Illustration-site`

---

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

---

## 📅 更新履歴

### 2026-01-11
- ✅ Cliant Shareを**複数ディレクトリ対応**に変更
- ✅ `encrypt_images_multi.py` を作成（複数ディレクトリを自動処理）
- ✅ ディレクトリ選択UIを追加（カード形式）
- ✅ パスワード難読化を修正（シンプルな実装に変更）

### 2026-01-10
- ✅ Cliant Share機能を追加（単一ディレクトリ対応）
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
