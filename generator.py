"""
2次元美少女イラスト作家向け 静的サイトジェネレーター
Python + Jinja2 でHTMLを生成
"""

import json
import shutil
from pathlib import Path
from datetime import datetime
from jinja2 import Environment, FileSystemLoader


class SiteGenerator:
    """静的サイトを生成するメインクラス"""
    
    def __init__(self):
        self.root = Path(__file__).parent
        self.data_dir = self.root / "data"
        self.template_dir = self.root / "templates"
        self.static_dir = self.root / "static"
        self.dist_dir = self.root / "dist"
        
        # データ保持用
        self.works = []
        self.commission = {}
        self.config = {}
        
        # Jinja2環境設定
        self.env = Environment(
            loader=FileSystemLoader(str(self.template_dir)),
            autoescape=True
        )
        self.env.globals['now'] = datetime.now()
    
    def load_data(self):
        """データファイルを読み込み"""
        print("📂 データを読み込み中...")
        
        with open(self.data_dir / "config.json", "r", encoding="utf-8") as f:
            self.config = json.load(f)
        
        # Jinja2にbase_pathを渡す
        self.env.globals['base_path'] = self.config.get('base_path', '')
        
        with open(self.data_dir / "works.json", "r", encoding="utf-8") as f:
            self.works = json.load(f)
        
        with open(self.data_dir / "commission.json", "r", encoding="utf-8") as f:
            self.commission = json.load(f)
        
        print(f"  ✓ 作品: {len(self.works)}件")
        print(f"  ✓ 依頼状況: {'受付中' if self.commission.get('status', {}).get('open') else '停止中'}")
    
    def get_tags(self):
        """全作品からタグを抽出"""
        tags = set()
        for work in self.works:
            tags.update(work.get("tags", []))
        return sorted(tags)
    
    def get_categories(self):
        """カテゴリ一覧を取得"""
        categories = set()
        for work in self.works:
            if work.get("category"):
                categories.add(work["category"])
        return sorted(categories)
    
    def get_recent_works(self, limit=6, exclude_nsfw=False):
        """最新作品を取得"""
        works = self.works
        if exclude_nsfw:
            works = [w for w in works if not w.get("nsfw", False)]
        
        return sorted(works, key=lambda x: x["date"], reverse=True)[:limit]
    
    def get_related_works(self, work, limit=6):
        """関連作品を取得（同じタグを持つ作品）"""
        related = []
        work_tags = set(work.get("tags", []))
        
        for w in self.works:
            if w["id"] == work["id"]:
                continue
            
            w_tags = set(w.get("tags", []))
            if work_tags & w_tags:  # 共通のタグがある
                related.append(w)
        
        # 共通タグが多い順にソート
        related.sort(
            key=lambda x: len(set(x.get("tags", [])) & work_tags),
            reverse=True
        )
        
        return related[:limit]
    
    def generate_home(self):
        """トップページ生成"""
        template = self.env.get_template("home.html")
        
        recent_works = self.get_recent_works(limit=6)
        
        html = template.render(
            config=self.config,
            recent_works=recent_works,
            commission_status=self.commission.get("status", {})
        )
        
        (self.dist_dir / "index.html").write_text(html, encoding="utf-8")
    
    def generate_gallery(self):
        """ギャラリー一覧生成"""
        template = self.env.get_template("gallery.html")
        
        # 日付順にソート
        sorted_works = sorted(
            self.works,
            key=lambda x: x["date"],
            reverse=True
        )
        
        html = template.render(
            config=self.config,
            works=sorted_works,
            tags=self.get_tags(),
            categories=self.get_categories()
        )
        
        (self.dist_dir / "gallery.html").write_text(html, encoding="utf-8")
    
    def generate_work_details(self):
        """各作品詳細ページ生成"""
        template = self.env.get_template("work_detail.html")
        
        works_dir = self.dist_dir / "works"
        works_dir.mkdir(exist_ok=True)
        
        for work in self.works:
            related_works = self.get_related_works(work, limit=6)
            
            html = template.render(
                config=self.config,
                work=work,
                related_works=related_works
            )
            
            (works_dir / f"{work['slug']}.html").write_text(html, encoding="utf-8")
    
    def generate_commission(self):
        """依頼ページ生成"""
        template = self.env.get_template("commission.html")
        
        html = template.render(
            config=self.config,
            commission=self.commission
        )
        
        (self.dist_dir / "commission.html").write_text(html, encoding="utf-8")
    
    def generate_about(self):
        """プロフィールページ生成"""
        template = self.env.get_template("about.html")
        
        html = template.render(config=self.config)
        
        (self.dist_dir / "about.html").write_text(html, encoding="utf-8")
    
    def generate_contact(self):
        """お問い合わせページ生成"""
        template = self.env.get_template("contact.html")
        
        html = template.render(config=self.config)
        
        (self.dist_dir / "contact.html").write_text(html, encoding="utf-8")
    
    def generate_cliantshare(self):
        """パスワード保護された特別コンテンツページ生成（複数ディレクトリ対応）"""
        template = self.env.get_template("cliantshare.html")
        
        # cliantshare_encrypted フォルダ内のディレクトリ情報を取得
        cliantshare_base = self.static_dir / "img" / "cliantshare_encrypted"
        directories = []
        
        if cliantshare_base.exists():
            for subdir in sorted(cliantshare_base.iterdir()):
                if subdir.is_dir():
                    enc_files = sorted(subdir.glob("*.enc"))
                    if enc_files:
                        directories.append({
                            'name': subdir.name,
                            'display_name': subdir.name.replace('_', ' ').title(),
                            'count': len(enc_files)
                        })
        
        html = template.render(
            config=self.config,
            directories=directories
        )
        
        (self.dist_dir / "cliantshare.html").write_text(html, encoding="utf-8")
        
        # 旧keyshare.htmlからのリダイレクトページも生成
        redirect_template = self.env.get_template("keyshare_redirect.html")
        redirect_html = redirect_template.render(config=self.config)
        (self.dist_dir / "keyshare.html").write_text(redirect_html, encoding="utf-8")
    
    def generate_privacy(self):
        """プライバシーポリシーページ生成"""
        template = self.env.get_template("privacy.html")
        
        html = template.render(config=self.config)
        
        (self.dist_dir / "privacy.html").write_text(html, encoding="utf-8")
    
    def copy_static(self):
        """静的ファイルをコピー"""
        if (self.dist_dir / "static").exists():
            shutil.rmtree(self.dist_dir / "static")
        shutil.copytree(self.static_dir, self.dist_dir / "static")
    
    def build(self):
        """サイト全体をビルド"""
        print("\n🎨 サイトをビルド中...\n")
        
        # distディレクトリ作成
        self.dist_dir.mkdir(exist_ok=True)
        
        # データ読み込み
        self.load_data()
        
        print("\n📝 ページを生成中...")
        
        # 各ページ生成
        print("  ✓ Home (index.html)")
        self.generate_home()
        
        print("  ✓ Gallery (gallery.html)")
        self.generate_gallery()
        
        print(f"  ✓ Works ({len(self.works)}件の詳細ページ)")
        self.generate_work_details()
        
        print("  ✓ Commission (commission.html)")
        self.generate_commission()
        
        print("  ✓ About (about.html)")
        self.generate_about()
        
        print("  ✓ Contact (contact.html)")
        self.generate_contact()
        
        print("  ✓ Cliant Share (cliantshare.html)")
        self.generate_cliantshare()
        
        print("  ✓ Privacy (privacy.html)")
        self.generate_privacy()
        
        # 静的ファイルコピー
        print("\n📦 静的ファイルをコピー中...")
        self.copy_static()
        
        print(f"\n✨ ビルド完了！")
        print(f"📁 出力先: {self.dist_dir.absolute()}")
        print(f"\n💡 ブラウザで開く: {self.dist_dir.absolute() / 'index.html'}")


def main():
    """メイン処理"""
    generator = SiteGenerator()
    generator.build()


if __name__ == "__main__":
    main()
