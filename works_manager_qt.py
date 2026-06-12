"""
Works.json 作品管理ツール (PyQt6)
モダンでプロフェッショナルなGUIアプリケーション
"""

import json
import sys
from pathlib import Path
from datetime import datetime
import shutil
import mimetypes
import subprocess

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QListWidget, QLabel, QLineEdit, QTextEdit,
    QComboBox, QCheckBox, QFileDialog, QMessageBox, QSplitter,
    QScrollArea, QFrame, QGridLayout, QInputDialog
)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QFont, QIcon, QImage, QPixmap


class ImageDropLabel(QLabel):
    """画像ファイルのドラッグ&ドロップを受け付けるプレビューラベル。"""

    def __init__(self, on_file_dropped, parent=None):
        super().__init__(parent)
        self.on_file_dropped = on_file_dropped
        self.setAcceptDrops(True)

    def dragEnterEvent(self, event):
        if self._has_valid_media_url(event):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dragMoveEvent(self, event):
        if self._has_valid_media_url(event):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event):
        mime_data = event.mimeData()
        if not mime_data or not mime_data.hasUrls():
            event.ignore()
            return

        for url in mime_data.urls():
            if not url.isLocalFile():
                continue
            local_path = url.toLocalFile()
            if self._is_supported_media(local_path):
                self.on_file_dropped(local_path)
                event.acceptProposedAction()
                return

        event.ignore()

    def _has_valid_media_url(self, event):
        mime_data = event.mimeData()
        if not mime_data or not mime_data.hasUrls():
            return False

        for url in mime_data.urls():
            if url.isLocalFile() and self._is_supported_media(url.toLocalFile()):
                return True
        return False

    @staticmethod
    def _is_supported_media(path):
        suffix = Path(path).suffix.lower()
        return suffix in {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.mp4', '.mov', '.webm'}


class WorksManagerQt(QMainWindow):
    DEFAULT_DESCRIPTION_DIRECTIVES = {
        "tone_preset": "casual_fun",
        "length_rule": "short_1_2_sentences",
        "must_include": ["composition", "color", "motif"],
        "instruction_preset": "none",
        "custom_instruction": ""
    }

    TONE_PRESETS = [
        ("casual_fun", "気さくで楽しそう"),
        ("polite", "丁寧で上品"),
        ("poetic", "詩的で余韻のある"),
        ("energetic", "元気で明るい"),
        ("minimal", "ミニマルで簡潔")
    ]

    LENGTH_RULES = [
        ("short_1_2_sentences", "1〜2文（短め）"),
        ("two_sentences_80_120", "2文 / 80〜120文字"),
        ("single_sentence_60_90", "1文 / 60〜90文字")
    ]

    MUST_INCLUDE_ITEMS = [
        ("composition", "構図"),
        ("color", "色"),
        ("motif", "モチーフ")
    ]

    INSTRUCTION_PRESETS = [
        ("none", "なし（手入力のみ）"),
        ("light_net_slang", "軽いネットスラング風（砕けた口調）"),
        ("friendly_streamer", "配信コメントっぽいフレンドリー口調"),
        ("cute_casual", "ゆるく可愛いカジュアル口調")
    ]

    INSTRUCTION_PRESET_TEXT = {
        "none": "",
        "light_net_slang": "語り口は砕けたネットスラング寄りで、軽くノリのある表現を使ってください。読みやすさを優先し、スラングは控えめに。",
        "friendly_streamer": "配信コメントのような親しみやすい語り口で、明るくテンポよくまとめてください。",
        "cute_casual": "やわらかく可愛いカジュアル口調で、親しみのある軽いトーンにしてください。"
    }

    def __init__(self):
        super().__init__()
        self.setWindowTitle("🎨 Works Manager - 作品管理ツール")
        self.setMinimumSize(1400, 900)
        
        # データファイル
        self.works_file = Path(__file__).parent / "data" / "works.json"
        self.works = []
        self.current_work = None
        self.current_index = -1
        
        # スタイル設定
        self.setup_style()
        
        # UI構築
        self.setup_ui()
        
        # データ読み込み
        self.load_works()
    
    def setup_style(self):
        """モダンなスタイルシートを適用"""
        self.setStyleSheet("""
            QMainWindow {
                background-color: #1e1e2e;
            }
            
            QWidget {
                background-color: #1e1e2e;
                color: #ffffff;
                font-family: 'Segoe UI', Arial;
                font-size: 10pt;
            }
            
            QLabel {
                color: #ffffff;
                font-weight: bold;
            }
            
            QLabel#title {
                font-size: 14pt;
                font-weight: bold;
                color: #4a9eff;
            }
            
            QLabel#subtitle {
                font-size: 9pt;
                color: #b4b4c8;
                font-weight: normal;
            }
            
            QLabel#section {
                font-size: 12pt;
                font-weight: bold;
                color: #4a9eff;
                padding: 10px 0px;
            }
            
            QListWidget {
                background-color: #2a2a3e;
                border: 1px solid #404050;
                border-radius: 8px;
                padding: 5px;
                font-size: 10pt;
            }
            
            QListWidget::item {
                padding: 4px 8px;
                border-radius: 4px;
                margin: 1px;
            }
            
            QListWidget::item:selected {
                background-color: #4a9eff;
                color: #ffffff;
            }
            
            QListWidget::item:hover {
                background-color: #3a3a4e;
            }
            
            QLineEdit, QComboBox {
                background-color: #3a3a4e;
                border: 2px solid #404050;
                border-radius: 6px;
                padding: 6px 10px;
                color: #ffffff;
                selection-background-color: #4a9eff;
            }
            
            QTextEdit {
                background-color: #3a3a4e;
                border: 2px solid #404050;
                border-radius: 6px;
                padding: 8px;
                color: #ffffff;
                selection-background-color: #4a9eff;
            }
            
            QLineEdit:focus, QTextEdit:focus, QComboBox:focus {
                border-color: #4a9eff;
            }
            
            QComboBox::drop-down {
                border: none;
                padding-right: 10px;
            }
            
            QComboBox::down-arrow {
                image: none;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid #ffffff;
                margin-right: 5px;
            }
            
            QPushButton {
                background-color: #4a9eff;
                color: #ffffff;
                border: none;
                border-radius: 6px;
                padding: 10px 20px;
                font-weight: bold;
                font-size: 10pt;
            }
            
            QPushButton:hover {
                background-color: #5ba8ff;
            }
            
            QPushButton:pressed {
                background-color: #3a8eef;
            }
            
            QPushButton#success {
                background-color: #4ade80;
            }
            
            QPushButton#success:hover {
                background-color: #5de890;
            }
            
            QPushButton#danger {
                background-color: #f43f5e;
            }
            
            QPushButton#danger:hover {
                background-color: #f55f7e;
            }
            
            QPushButton#warning {
                background-color: #fbbf24;
                color: #000000;
            }
            
            QPushButton#warning:hover {
                background-color: #fcd34d;
            }
            
            QCheckBox {
                spacing: 8px;
                font-weight: bold;
            }
            
            QCheckBox::indicator {
                width: 20px;
                height: 20px;
                border-radius: 4px;
                border: 2px solid #404050;
                background-color: #3a3a4e;
            }
            
            QCheckBox::indicator:checked {
                background-color: #4a9eff;
                border-color: #4a9eff;
            }
            
            QScrollArea {
                border: none;
                background-color: transparent;
            }
            
            QScrollBar:vertical {
                background-color: #2a2a3e;
                width: 12px;
                border-radius: 6px;
            }
            
            QScrollBar::handle:vertical {
                background-color: #404050;
                border-radius: 6px;
                min-height: 20px;
            }
            
            QScrollBar::handle:vertical:hover {
                background-color: #4a9eff;
            }
            
            QFrame#card {
                background-color: #2a2a3e;
                border-radius: 10px;
                padding: 15px;
            }
        """)
    
    def setup_ui(self):
        """UIを構築"""
        # 中央ウィジェット
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # メインレイアウト
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(20, 10, 20, 20)
        main_layout.setSpacing(10)
        
        # スプリッター（左右分割）
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # 左側：作品リスト
        left_widget = self.create_list_panel()
        splitter.addWidget(left_widget)
        
        # 右側：編集フォーム
        right_widget = self.create_form_panel()
        splitter.addWidget(right_widget)
        
        # スプリッターの幅比率
        splitter.setSizes([400, 900])
        
        main_layout.addWidget(splitter)
    
    def create_list_panel(self):
        """作品リストパネルを作成"""
        panel = QFrame()
        panel.setObjectName("card")
        
        layout = QVBoxLayout(panel)
        layout.setSpacing(10)
        
        # タイトル
        title = QLabel("作品リスト")
        title.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
        layout.addWidget(title)
        
        # リストウィジェット
        self.works_list = QListWidget()
        self.works_list.setMinimumWidth(350)
        self.works_list.currentRowChanged.connect(self.on_work_selected)
        layout.addWidget(self.works_list)
        
        # ボタン
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(8)
        
        new_btn = QPushButton("➕ 新規")
        new_btn.clicked.connect(self.new_work)
        btn_layout.addWidget(new_btn)
        
        delete_btn = QPushButton("🗑️ 削除")
        delete_btn.setObjectName("danger")
        delete_btn.clicked.connect(self.delete_work)
        btn_layout.addWidget(delete_btn)
        
        up_btn = QPushButton("⬆️")
        up_btn.clicked.connect(self.move_up)
        up_btn.setMaximumWidth(50)
        btn_layout.addWidget(up_btn)
        
        down_btn = QPushButton("⬇️")
        down_btn.clicked.connect(self.move_down)
        down_btn.setMaximumWidth(50)
        btn_layout.addWidget(down_btn)
        
        layout.addLayout(btn_layout)
        
        return panel
    
    def create_form_panel(self):
        """編集フォームパネルを作成"""
        panel = QFrame()
        panel.setObjectName("card")
        
        layout = QVBoxLayout(panel)
        layout.setSpacing(10)
        
        # タイトル
        title = QLabel("作品情報編集")
        title.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
        layout.addWidget(title)
        
        # スクロールエリア
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        
        # フォームウィジェット
        form_widget = QWidget()
        form_widget.setStyleSheet("background-color: #2a2a3e;")
        form_layout = QGridLayout(form_widget)
        form_layout.setSpacing(8)
        form_layout.setVerticalSpacing(8)
        form_layout.setColumnStretch(1, 1)
        
        row = 0
        
        # 基本情報
        # ID
        form_layout.addWidget(QLabel("ID:"), row, 0)
        self.id_input = QLineEdit()
        form_layout.addWidget(self.id_input, row, 1)
        row += 1
        
        # Slug
        form_layout.addWidget(QLabel("Slug:"), row, 0)
        self.slug_input = QLineEdit()
        form_layout.addWidget(self.slug_input, row, 1)
        row += 1
        
        # タイトル
        form_layout.addWidget(QLabel("タイトル:"), row, 0)
        self.title_input = QLineEdit()
        form_layout.addWidget(self.title_input, row, 1)
        row += 1
        
        # 公開日
        form_layout.addWidget(QLabel("公開日:"), row, 0)
        date_layout = QHBoxLayout()
        self.date_input = QLineEdit()
        date_layout.addWidget(self.date_input)
        today_btn = QPushButton("今日")
        today_btn.setObjectName("warning")
        today_btn.setMaximumWidth(80)
        today_btn.clicked.connect(lambda: self.date_input.setText(datetime.now().strftime("%Y-%m-%d")))
        date_layout.addWidget(today_btn)
        form_layout.addLayout(date_layout, row, 1)
        row += 1
        
        # カテゴリ
        form_layout.addWidget(QLabel("カテゴリ:"), row, 0)
        self.category_combo = QComboBox()
        self.category_combo.addItems(["Original", "Fanart", "Animation", "Manga", "Live2D"])
        form_layout.addWidget(self.category_combo, row, 1)
        row += 1
        
        # 画像パス
        form_layout.addWidget(QLabel("画像パス:"), row, 0)
        img_layout = QHBoxLayout()
        self.image_path_input = QLineEdit()
        self.image_path_input.textChanged.connect(self.auto_fill_from_image_path)
        self.image_path_input.textChanged.connect(self.update_image_preview)
        img_layout.addWidget(self.image_path_input)
        browse_btn = QPushButton("📁 参照")
        browse_btn.setMaximumWidth(100)
        browse_btn.clicked.connect(lambda: self.browse_file(self.image_path_input))
        img_layout.addWidget(browse_btn)
        form_layout.addLayout(img_layout, row, 1)
        row += 1

        # 画像プレビュー
        form_layout.addWidget(QLabel("プレビュー:"), row, 0, Qt.AlignmentFlag.AlignTop)
        self.image_preview_label = ImageDropLabel(self.handle_image_drop)
        self.image_preview_label.setFixedSize(320, 240)
        self.image_preview_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.image_preview_label.setStyleSheet(
            "background-color: #1e1e2e; border: 2px solid #404050; border-radius: 8px;"
        )
        self.image_preview_label.setText("画像なし\n(ここに画像をドロップ)")
        form_layout.addWidget(self.image_preview_label, row, 1, Qt.AlignmentFlag.AlignLeft)
        row += 1

        # サムネイル
        form_layout.addWidget(QLabel("サムネイル:"), row, 0)
        thumb_layout = QHBoxLayout()
        self.thumbnail_input = QLineEdit()
        thumb_layout.addWidget(self.thumbnail_input)
        thumb_btn = QPushButton("📁 参照")
        thumb_btn.setMaximumWidth(100)
        thumb_btn.clicked.connect(lambda: self.browse_file(self.thumbnail_input))
        thumb_layout.addWidget(thumb_btn)
        form_layout.addLayout(thumb_layout, row, 1)
        row += 1

        # X投稿時サムネイル（任意）
        form_layout.addWidget(QLabel("X用サムネイル:"), row, 0)
        x_thumb_layout = QHBoxLayout()
        self.x_thumbnail_input = QLineEdit()
        self.x_thumbnail_input.setPlaceholderText("未入力なら通常サムネイルを使用")
        x_thumb_layout.addWidget(self.x_thumbnail_input)
        x_thumb_btn = QPushButton("📁 参照")
        x_thumb_btn.setMaximumWidth(100)
        x_thumb_btn.clicked.connect(lambda: self.browse_file(self.x_thumbnail_input))
        x_thumb_layout.addWidget(x_thumb_btn)
        form_layout.addLayout(x_thumb_layout, row, 1)
        row += 1
        
        # タグ
        form_layout.addWidget(QLabel("タグ:"), row, 0, Qt.AlignmentFlag.AlignTop)
        tags_container = QVBoxLayout()
        tags_container.setSpacing(5)
        
        # タグ入力行（コンボボックス + 入力欄 + 追加ボタン）
        tag_input_layout = QHBoxLayout()
        self.tag_combo = QComboBox()
        self.tag_combo.setEditable(True)
        self.tag_combo.setPlaceholderText("タグを選択または入力")
        self.tag_combo.setMinimumWidth(200)
        tag_input_layout.addWidget(self.tag_combo)
        
        tag_add_btn = QPushButton("追加")
        tag_add_btn.setMaximumWidth(80)
        tag_add_btn.clicked.connect(self.add_tag)
        tag_input_layout.addWidget(tag_add_btn)
        tag_input_layout.addStretch()
        tags_container.addLayout(tag_input_layout)
        
        # タグリスト表示
        self.tags_list = QListWidget()
        self.tags_list.setMaximumHeight(80)
        tags_container.addWidget(self.tags_list)
        
        # タグ削除ボタン
        tag_remove_btn = QPushButton("選択したタグを削除")
        tag_remove_btn.setMaximumWidth(150)
        tag_remove_btn.clicked.connect(self.remove_tag)
        tags_container.addWidget(tag_remove_btn)
        
        hint_label = QLabel("※既存タグから選択または新しいタグを入力して追加")
        hint_label.setStyleSheet("color: #b4b4c8; font-weight: normal; font-size: 9pt;")
        tags_container.addWidget(hint_label)
        form_layout.addLayout(tags_container, row, 1)
        row += 1

        # イラストリクエストタグ
        form_layout.addWidget(QLabel("リクエストタグ:"), row, 0, Qt.AlignmentFlag.AlignTop)
        request_tags_container = QVBoxLayout()
        request_tags_container.setSpacing(5)

        request_tag_input_layout = QHBoxLayout()
        self.request_tag_combo = QComboBox()
        self.request_tag_combo.setEditable(True)
        self.request_tag_combo.setPlaceholderText("リクエストタグを選択または入力")
        self.request_tag_combo.setMinimumWidth(200)
        request_tag_input_layout.addWidget(self.request_tag_combo)

        request_tag_add_btn = QPushButton("追加")
        request_tag_add_btn.setMaximumWidth(80)
        request_tag_add_btn.clicked.connect(self.add_request_tag)
        request_tag_input_layout.addWidget(request_tag_add_btn)
        request_tag_input_layout.addStretch()
        request_tags_container.addLayout(request_tag_input_layout)

        self.request_tags_list = QListWidget()
        self.request_tags_list.setMaximumHeight(80)
        request_tags_container.addWidget(self.request_tags_list)

        request_tag_remove_btn = QPushButton("選択したタグを削除")
        request_tag_remove_btn.setMaximumWidth(150)
        request_tag_remove_btn.clicked.connect(self.remove_request_tag)
        request_tags_container.addWidget(request_tag_remove_btn)

        request_hint_label = QLabel("※依頼時に参考として表示したいタグを指定")
        request_hint_label.setStyleSheet("color: #b4b4c8; font-weight: normal; font-size: 9pt;")
        request_tags_container.addWidget(request_hint_label)
        form_layout.addLayout(request_tags_container, row, 1)
        row += 1
        
        # 説明
        form_layout.addWidget(QLabel("説明:"), row, 0, Qt.AlignmentFlag.AlignTop)
        description_container = QVBoxLayout()
        
        self.description_input = QTextEdit()
        self.description_input.setMaximumHeight(100)
        description_container.addWidget(self.description_input)
        
        # AI生成ボタン
        ai_btn = QPushButton("🤖 AIで説明文を生成")
        ai_btn.setMaximumWidth(200)
        ai_btn.clicked.connect(self.generate_ai_description)
        description_container.addWidget(ai_btn)

        # AI生成向けの追加指示
        ai_directive_box = QFrame()
        ai_directive_box.setObjectName("card")
        ai_directive_layout = QGridLayout(ai_directive_box)
        ai_directive_layout.setSpacing(6)
        ai_directive_layout.setColumnStretch(1, 1)

        ai_title = QLabel("AI説明 追加指示")
        ai_title.setObjectName("section")
        ai_directive_layout.addWidget(ai_title, 0, 0, 1, 2)

        ai_directive_layout.addWidget(QLabel("口調:"), 1, 0)
        self.ai_tone_combo = QComboBox()
        for key, label in self.TONE_PRESETS:
            self.ai_tone_combo.addItem(label, key)
        ai_directive_layout.addWidget(self.ai_tone_combo, 1, 1)

        ai_directive_layout.addWidget(QLabel("文量:"), 2, 0)
        self.ai_length_combo = QComboBox()
        for key, label in self.LENGTH_RULES:
            self.ai_length_combo.addItem(label, key)
        ai_directive_layout.addWidget(self.ai_length_combo, 2, 1)

        ai_directive_layout.addWidget(QLabel("必須要素:"), 3, 0, Qt.AlignmentFlag.AlignTop)
        must_include_layout = QHBoxLayout()
        self.ai_include_composition_check = QCheckBox("構図")
        self.ai_include_color_check = QCheckBox("色")
        self.ai_include_motif_check = QCheckBox("モチーフ")
        must_include_layout.addWidget(self.ai_include_composition_check)
        must_include_layout.addWidget(self.ai_include_color_check)
        must_include_layout.addWidget(self.ai_include_motif_check)
        must_include_layout.addStretch()
        ai_directive_layout.addLayout(must_include_layout, 3, 1)

        ai_directive_layout.addWidget(QLabel("追加入力:"), 4, 0, Qt.AlignmentFlag.AlignTop)
        self.ai_custom_instruction_input = QTextEdit()
        self.ai_custom_instruction_input.setMaximumHeight(70)
        self.ai_custom_instruction_input.setPlaceholderText("例: ポップで親しみやすく。技法に軽く触れてください。")
        ai_directive_layout.addWidget(self.ai_custom_instruction_input, 4, 1)

        ai_directive_layout.addWidget(QLabel("追加指示プリセット:"), 5, 0)
        self.ai_instruction_preset_combo = QComboBox()
        for key, label in self.INSTRUCTION_PRESETS:
            self.ai_instruction_preset_combo.addItem(label, key)
        ai_directive_layout.addWidget(self.ai_instruction_preset_combo, 5, 1)

        directive_btn_layout = QHBoxLayout()
        save_default_btn = QPushButton("全体デフォルトに保存")
        save_default_btn.setMaximumWidth(180)
        save_default_btn.clicked.connect(self.save_ai_description_defaults)
        directive_btn_layout.addWidget(save_default_btn)

        reset_btn = QPushButton("デフォルトに戻す")
        reset_btn.setObjectName("warning")
        reset_btn.setMaximumWidth(160)
        reset_btn.clicked.connect(self.reset_ai_directives_to_defaults)
        directive_btn_layout.addWidget(reset_btn)
        directive_btn_layout.addStretch()
        ai_directive_layout.addLayout(directive_btn_layout, 6, 0, 1, 2)

        ai_hint = QLabel("※生成時は現在の入力値を優先。保存するとこの作品に上書き設定として保持されます。")
        ai_hint.setStyleSheet("color: #b4b4c8; font-weight: normal; font-size: 9pt;")
        ai_directive_layout.addWidget(ai_hint, 7, 0, 1, 2)

        description_container.addWidget(ai_directive_box)
        
        form_layout.addLayout(description_container, row, 1)
        row += 1
        
        # チェックボックス
        check_layout = QHBoxLayout()
        self.nsfw_check = QCheckBox("🔞 R-18作品")
        self.nsfw_check.setStyleSheet("color: #f43f5e;")
        check_layout.addWidget(self.nsfw_check)
        
        self.sensitive_check = QCheckBox("⚠️ センシティブ")
        self.sensitive_check.setStyleSheet("color: #fbbf24;")
        check_layout.addWidget(self.sensitive_check)

        self.hidden_check = QCheckBox("🙈 非表示（ギャラリーに出さない）")
        self.hidden_check.setStyleSheet("color: #a78bfa;")
        check_layout.addWidget(self.hidden_check)
        check_layout.addStretch()
        
        form_layout.addLayout(check_layout, row, 1)
        row += 1

        # R15時のXサムネイル設定（デフォルト: 表示する）
        x_thumb_layout = QHBoxLayout()
        self.hide_sensitive_thumbnail_on_x_check = QCheckBox("Xでサムネイルを非表示にする（R15時のみ）")
        self.hide_sensitive_thumbnail_on_x_check.setStyleSheet("color: #fbbf24;")
        self.hide_sensitive_thumbnail_on_x_check.setToolTip("オフ: 表示する（デフォルト） / オン: プレースホルダー表示")
        x_thumb_layout.addWidget(self.hide_sensitive_thumbnail_on_x_check)
        x_thumb_layout.addStretch()
        form_layout.addLayout(x_thumb_layout, row, 1)
        row += 1

        self.sensitive_check.stateChanged.connect(self.update_sensitive_x_option_state)
        self.update_sensitive_x_option_state()
        
        # セクション：外部リンク
        section_label = QLabel("外部リンク")
        section_label.setObjectName("section")
        form_layout.addWidget(section_label, row, 0, 1, 2)
        row += 1
        
        # Pixiv
        form_layout.addWidget(QLabel("Pixiv URL:"), row, 0)
        self.pixiv_input = QLineEdit()
        form_layout.addWidget(self.pixiv_input, row, 1)
        row += 1
        
        # Twitter
        form_layout.addWidget(QLabel("Twitter URL:"), row, 0)
        self.twitter_input = QLineEdit()
        form_layout.addWidget(self.twitter_input, row, 1)
        row += 1
        
        # BOOTH
        form_layout.addWidget(QLabel("BOOTH URL:"), row, 0)
        self.booth_input = QLineEdit()
        form_layout.addWidget(self.booth_input, row, 1)
        row += 1
        
        # FANBOX
        form_layout.addWidget(QLabel("FANBOX URL:"), row, 0)
        self.fanbox_input = QLineEdit()
        form_layout.addWidget(self.fanbox_input, row, 1)
        row += 1
        
        # セクション：追加画像
        section_label2 = QLabel("追加画像（複数画像作品用）")
        section_label2.setObjectName("section")
        form_layout.addWidget(section_label2, row, 0, 1, 2)
        row += 1
        
        # 追加画像
        form_layout.addWidget(QLabel("追加画像パス:"), row, 0, Qt.AlignmentFlag.AlignTop)
        add_img_container = QVBoxLayout()
        self.additional_images_input = QTextEdit()
        self.additional_images_input.setMaximumHeight(80)
        add_img_container.addWidget(self.additional_images_input)
        hint_label2 = QLabel("※1行に1つのパスを入力")
        hint_label2.setStyleSheet("color: #b4b4c8; font-weight: normal; font-size: 9pt;")
        add_img_container.addWidget(hint_label2)
        form_layout.addLayout(add_img_container, row, 1)
        row += 1
        
        # 保存ボタン
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        save_btn = QPushButton("💾 保存")
        save_btn.setObjectName("success")
        save_btn.setMinimumWidth(150)
        save_btn.setMinimumHeight(45)
        save_btn.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
        save_btn.clicked.connect(self.save_work)
        btn_layout.addWidget(save_btn)
        
        reload_btn = QPushButton("🔄 リロード")
        reload_btn.setMinimumWidth(150)
        reload_btn.setMinimumHeight(45)
        reload_btn.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
        reload_btn.clicked.connect(self.load_works)
        btn_layout.addWidget(reload_btn)

        push_btn = QPushButton("📤 GitHub Push")
        push_btn.setObjectName("warning")
        push_btn.setMinimumWidth(180)
        push_btn.setMinimumHeight(45)
        push_btn.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
        push_btn.clicked.connect(self.push_to_github)
        btn_layout.addWidget(push_btn)
        
        btn_layout.addStretch()
        form_layout.addLayout(btn_layout, row, 0, 1, 2)
        
        scroll.setWidget(form_widget)
        layout.addWidget(scroll)

        self.apply_ai_directives_to_ui(self.get_default_description_directives())
        
        return panel

    def get_ai_config_file_path(self):
        return Path(__file__).parent / "ai_config.json"

    def sanitize_single_line_text(self, value, max_length=120):
        text = str(value or "").replace('\r', ' ').replace('\n', ' ').strip()
        if len(text) > max_length:
            text = text[:max_length]
        return text

    def sanitize_instruction_text(self, text, max_length=220):
        lines = [line.strip() for line in str(text or "").replace('\r', '').split('\n') if line.strip()]
        compact = ' '.join(lines)
        compact = compact.replace('```', '').replace('<', '').replace('>', '')
        if len(compact) > max_length:
            compact = compact[:max_length]
        return compact

    def load_ai_config_dict(self):
        config_file = self.get_ai_config_file_path()
        if not config_file.exists():
            return {}

        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}

    def get_default_description_directives(self, ai_config=None):
        if ai_config is None:
            ai_config = self.load_ai_config_dict()

        defaults = dict(self.DEFAULT_DESCRIPTION_DIRECTIVES)
        config_directives = ai_config.get("description_generation", {})
        if isinstance(config_directives, dict):
            if config_directives.get("tone_preset"):
                defaults["tone_preset"] = str(config_directives.get("tone_preset"))
            if config_directives.get("length_rule"):
                defaults["length_rule"] = str(config_directives.get("length_rule"))
            if isinstance(config_directives.get("must_include"), list):
                defaults["must_include"] = [str(x) for x in config_directives.get("must_include")]
            if config_directives.get("instruction_preset"):
                defaults["instruction_preset"] = str(config_directives.get("instruction_preset"))
            if config_directives.get("custom_instruction"):
                defaults["custom_instruction"] = self.sanitize_instruction_text(config_directives.get("custom_instruction"))

        return self.normalize_directives(defaults)

    def normalize_directives(self, directives):
        data = directives or {}
        tone = str(data.get("tone_preset") or self.DEFAULT_DESCRIPTION_DIRECTIVES["tone_preset"])
        length_rule = str(data.get("length_rule") or self.DEFAULT_DESCRIPTION_DIRECTIVES["length_rule"])
        instruction_preset = str(data.get("instruction_preset") or self.DEFAULT_DESCRIPTION_DIRECTIVES["instruction_preset"])
        must_include = data.get("must_include")
        has_explicit_must_include = isinstance(must_include, list)
        if not has_explicit_must_include:
            must_include = list(self.DEFAULT_DESCRIPTION_DIRECTIVES["must_include"])

        allowed_must = {key for key, _ in self.MUST_INCLUDE_ITEMS}
        filtered_must = []
        for item in must_include:
            key = str(item)
            if key in allowed_must and key not in filtered_must:
                filtered_must.append(key)

        if not filtered_must and not has_explicit_must_include:
            filtered_must = list(self.DEFAULT_DESCRIPTION_DIRECTIVES["must_include"])

        allowed_instruction_presets = {key for key, _ in self.INSTRUCTION_PRESETS}
        if instruction_preset not in allowed_instruction_presets:
            instruction_preset = self.DEFAULT_DESCRIPTION_DIRECTIVES["instruction_preset"]

        return {
            "tone_preset": tone,
            "length_rule": length_rule,
            "must_include": filtered_must,
            "instruction_preset": instruction_preset,
            "custom_instruction": self.sanitize_instruction_text(data.get("custom_instruction", ""))
        }

    def collect_ai_directives_from_ui(self):
        must_include = []
        if self.ai_include_composition_check.isChecked():
            must_include.append("composition")
        if self.ai_include_color_check.isChecked():
            must_include.append("color")
        if self.ai_include_motif_check.isChecked():
            must_include.append("motif")

        raw = {
            "tone_preset": self.ai_tone_combo.currentData(),
            "length_rule": self.ai_length_combo.currentData(),
            "must_include": must_include,
            "instruction_preset": self.ai_instruction_preset_combo.currentData(),
            "custom_instruction": self.ai_custom_instruction_input.toPlainText()
        }
        return self.normalize_directives(raw)

    def apply_ai_directives_to_ui(self, directives):
        normalized = self.normalize_directives(directives)

        tone_index = self.ai_tone_combo.findData(normalized["tone_preset"])
        if tone_index < 0:
            tone_index = 0
        self.ai_tone_combo.setCurrentIndex(tone_index)

        length_index = self.ai_length_combo.findData(normalized["length_rule"])
        if length_index < 0:
            length_index = 0
        self.ai_length_combo.setCurrentIndex(length_index)

        must_include = set(normalized["must_include"])
        self.ai_include_composition_check.setChecked("composition" in must_include)
        self.ai_include_color_check.setChecked("color" in must_include)
        self.ai_include_motif_check.setChecked("motif" in must_include)

        preset_index = self.ai_instruction_preset_combo.findData(normalized["instruction_preset"])
        if preset_index < 0:
            preset_index = 0
        self.ai_instruction_preset_combo.setCurrentIndex(preset_index)

        self.ai_custom_instruction_input.setPlainText(normalized["custom_instruction"])

    def merge_directives(self, defaults, override):
        base = self.normalize_directives(defaults)
        extra = override if isinstance(override, dict) else {}
        merged = {
            "tone_preset": extra.get("tone_preset", base["tone_preset"]),
            "length_rule": extra.get("length_rule", base["length_rule"]),
            "must_include": extra.get("must_include", base["must_include"]),
            "instruction_preset": extra.get("instruction_preset", base["instruction_preset"]),
            "custom_instruction": extra.get("custom_instruction", base["custom_instruction"])
        }
        return self.normalize_directives(merged)

    def directives_equal(self, left, right):
        l = self.normalize_directives(left)
        r = self.normalize_directives(right)
        return (
            l["tone_preset"] == r["tone_preset"] and
            l["length_rule"] == r["length_rule"] and
            sorted(l["must_include"]) == sorted(r["must_include"]) and
            l["instruction_preset"] == r["instruction_preset"] and
            l["custom_instruction"] == r["custom_instruction"]
        )

    def save_ai_description_defaults(self):
        config_file = self.get_ai_config_file_path()
        try:
            config = self.load_ai_config_dict()
            if not config:
                config = {
                    "api_keys_file": "api_keys.json",
                    "model": "gpt-4o-mini",
                    "fallback_model": "gpt-4.1-mini",
                    "max_tokens": 220,
                    "image_max_bytes": 1500000,
                    "retry_count": 2
                }

            config["description_generation"] = self.collect_ai_directives_from_ui()

            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)

            QMessageBox.information(self, "成功", "AI説明の全体デフォルト設定を保存しました")
        except Exception as e:
            QMessageBox.critical(self, "エラー", f"デフォルト設定の保存に失敗しました:\n{e}")

    def reset_ai_directives_to_defaults(self):
        defaults = self.get_default_description_directives()
        self.apply_ai_directives_to_ui(defaults)
        QMessageBox.information(self, "完了", "AI説明の入力を全体デフォルトに戻しました")

    def build_description_prompt(self, context, directives):
        normalized = self.normalize_directives(directives)

        tone_map = {
            "casual_fun": "気さくで楽しそうな語り口",
            "polite": "丁寧で上品な語り口",
            "poetic": "詩的で余韻のある語り口",
            "energetic": "元気で明るい語り口",
            "minimal": "ミニマルで簡潔な語り口"
        }
        length_map = {
            "short_1_2_sentences": "1〜2文で簡潔にまとめる",
            "two_sentences_80_120": "2文で80〜120文字を目安にまとめる",
            "single_sentence_60_90": "1文で60〜90文字を目安にまとめる"
        }
        include_map = {
            "composition": "構図",
            "color": "色",
            "motif": "モチーフ"
        }

        include_labels = [include_map[item] for item in normalized["must_include"] if item in include_map]
        include_text = "、".join(include_labels) if include_labels else "なし"
        instruction_preset_text = self.INSTRUCTION_PRESET_TEXT.get(normalized["instruction_preset"], "")
        custom_instruction = self.sanitize_instruction_text(normalized["custom_instruction"])

        title = self.sanitize_single_line_text(context.get("title", ""), max_length=120)
        tags = [self.sanitize_single_line_text(tag, max_length=50) for tag in context.get("tags", [])]
        tags = [tag for tag in tags if tag]
        request_tags = [self.sanitize_single_line_text(tag, max_length=50) for tag in context.get("request_tags", [])]
        request_tags = [tag for tag in request_tags if tag]
        category = self.sanitize_single_line_text(context.get("category", ""), max_length=40)

        lines = [
            "このイラスト作品について、ポートフォリオサイト掲載用の説明文を日本語で生成してください。",
            "読みやすく、魅力が伝わる自然な文章にしてください。",
            "",
            f"タイトル: {title}",
            f"カテゴリ: {category or '未設定'}",
            f"タグ: {'、'.join(tags) if tags else 'なし'}",
            f"リクエストタグ: {'、'.join(request_tags) if request_tags else 'なし'}",
            "",
            f"文体: {tone_map.get(normalized['tone_preset'], tone_map['casual_fun'])}",
            f"文量ルール: {length_map.get(normalized['length_rule'], length_map['short_1_2_sentences'])}",
            f"必須要素: {include_text}"
        ]

        if custom_instruction:
            lines.append(f"追加指示: {custom_instruction}")

        if instruction_preset_text:
            lines.append(f"口調プリセット指示: {instruction_preset_text}")

        lines.extend([
            "",
            "出力は説明文のみを返してください。"
        ])
        return "\n".join(lines)
    
    def browse_file(self, line_edit):
        """ファイル選択ダイアログ"""
        initial_dir = str(Path(__file__).parent / "static" / "img" / "works")
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "ファイルを選択",
            initial_dir,
            "画像・動画 (*.jpg *.jpeg *.png *.webp *.mp4 *.mov *.webm);;すべてのファイル (*.*)"
        )
        
        if file_path:
            try:
                rel_path = Path(file_path).relative_to(Path(__file__).parent)
                line_edit.setText(f"/{rel_path.as_posix()}")
            except ValueError:
                line_edit.setText(file_path)

    def resolve_local_media_path(self, media_path):
        """入力されたメディアパスをローカル実ファイルパスに解決"""
        if not media_path:
            return None

        project_root = Path(__file__).parent
        raw = str(media_path).strip().strip('"').strip("'")
        raw = raw.replace('\\', '/')
        raw = raw.split('?', 1)[0].split('#', 1)[0]

        # URLの場合はパス部分のみ利用
        if raw.startswith('http://') or raw.startswith('https://'):
            from urllib.parse import urlparse
            raw = urlparse(raw).path

        # /mopslipper-Illustration-site/static/... のようなbase_path付きURLにも対応
        static_idx = raw.find('/static/')
        if static_idx >= 0:
            raw = raw[static_idx:]
        elif raw.startswith('./static/'):
            raw = '/' + raw[2:]
        elif raw.startswith('static/'):
            raw = '/' + raw

        # 絶対パス or プロジェクト相対パスとして解決
        path_obj = Path(raw)
        if path_obj.is_absolute():
            return path_obj

        if raw.startswith('/'):
            return project_root / raw.lstrip('/')

        return project_root / raw

    def to_project_media_path(self, file_path):
        """ローカルファイルパスをプロジェクト向けメディアパスに変換"""
        if not file_path:
            return ""

        candidate = Path(str(file_path).strip().strip('"').strip("'"))
        project_root = Path(__file__).parent

        try:
            rel_path = candidate.resolve().relative_to(project_root.resolve())
            return f"/{rel_path.as_posix()}"
        except Exception:
            return str(candidate)

    def handle_image_drop(self, file_path):
        """プレビューへのドロップを image_path に反映"""
        normalized = self.to_project_media_path(file_path)
        self.image_path_input.setText(normalized)

    def resolve_existing_image_path(self, media_path):
        """画像パスを解決し、拡張子違いの候補も探索"""
        candidate = self.resolve_local_media_path(media_path)
        if not candidate:
            return None, None

        mime_type, _ = mimetypes.guess_type(str(candidate))
        if candidate.exists() and mime_type and mime_type.startswith('image/'):
            return candidate, mime_type

        # 例: .jpg設定だが実体は.png のようなケースを救済
        for ext in ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'):
            alt = candidate.with_suffix(ext)
            alt_mime, _ = mimetypes.guess_type(str(alt))
            if alt.exists() and alt_mime and alt_mime.startswith('image/'):
                return alt, alt_mime

        return candidate, mime_type

    def normalize_media_path(self, media_path):
        """メディアURLパスを正規化（Windows区切り -> URL区切り、フルパス -> 相対パス）"""
        if not media_path:
            return media_path

        p = str(media_path).strip().replace('\\', '/')

        # フルパスから /static/... を抽出
        static_idx = p.find('/static/')
        if static_idx != -1:
            p = p[static_idx:]

        # static配下の相対入力を /static/... に揃える
        if p.startswith('static/'):
            p = '/' + p

        return p

    def normalize_x_thumbnail_path(self, media_path):
        """Xカード向けサムネイルパスを正規化（指定値をそのまま保持）"""
        return self.normalize_media_path(media_path)
    
    def load_works(self):
        """works.jsonを読み込み"""
        try:
            with open(self.works_file, 'r', encoding='utf-8') as f:
                self.works = json.load(f)
            
            # 全タグを収集してコンボボックスに追加
            all_tags = set()
            all_request_tags = set()
            for work in self.works:
                if 'tags' in work:
                    all_tags.update(work['tags'])
                if 'request_tags' in work:
                    all_request_tags.update(work['request_tags'])
            
            self.tag_combo.clear()
            self.tag_combo.addItems(sorted(all_tags))
            self.tag_combo.clearEditText()

            self.request_tag_combo.clear()
            self.request_tag_combo.addItems(sorted(all_request_tags))
            self.request_tag_combo.clearEditText()
            
            # リストを更新
            self.works_list.clear()
            for work in self.works:
                hidden_mark = "🙈 " if work.get('hidden', False) else ""
                self.works_list.addItem(f"[{work['id']:02d}] {hidden_mark}{work['title']}")
            
            QMessageBox.information(self, "成功", f"{len(self.works)}件の作品を読み込みました")
            
        except Exception as e:
            QMessageBox.critical(self, "エラー", f"読み込みエラー:\n{e}")
    
    def on_work_selected(self, index):
        """作品を選択したとき"""
        if index < 0 or index >= len(self.works):
            return
        
        self.current_index = index
        self.current_work = self.works[index]
        self.display_work(self.current_work)
    
    def display_work(self, work):
        """作品データをフォームに表示"""
        self.id_input.setText(str(work.get('id', '')))
        self.slug_input.setText(work.get('slug', ''))
        self.title_input.setText(work.get('title', ''))
        self.date_input.setText(work.get('date', ''))
        
        category = work.get('category', 'Original')
        index = self.category_combo.findText(category)
        if index >= 0:
            self.category_combo.setCurrentIndex(index)
        
        self.image_path_input.setText(work.get('image_path', ''))
        self.thumbnail_input.setText(work.get('thumbnail', ''))
        self.x_thumbnail_input.setText(work.get('x_thumbnail', ''))
        
        # タグ
        self.tags_list.clear()
        if 'tags' in work:
            for tag in work['tags']:
                self.tags_list.addItem(tag)

        # イラストリクエストタグ
        self.request_tags_list.clear()
        if 'request_tags' in work:
            for tag in work['request_tags']:
                self.request_tags_list.addItem(tag)
        
        # 説明
        self.description_input.setPlainText(work.get('description', ''))

        defaults = self.get_default_description_directives()
        override = work.get('ai_desc_override', {})
        self.apply_ai_directives_to_ui(self.merge_directives(defaults, override))
        
        # チェックボックス
        self.nsfw_check.setChecked(work.get('nsfw', False))
        self.sensitive_check.setChecked(work.get('sensitive', False))
        self.hidden_check.setChecked(work.get('hidden', False))
        self.hide_sensitive_thumbnail_on_x_check.setChecked(work.get('hide_sensitive_thumbnail_on_x', False))
        self.update_sensitive_x_option_state()
        
        # 外部リンク
        external_links = work.get('external_links', {})
        self.pixiv_input.setText(external_links.get('pixiv', ''))
        self.twitter_input.setText(external_links.get('twitter', ''))
        self.booth_input.setText(external_links.get('booth', ''))
        self.fanbox_input.setText(external_links.get('fanbox', ''))
        
        # 追加画像
        if 'additional_images' in work:
            self.additional_images_input.setPlainText('\n'.join(work['additional_images']))
        else:
            self.additional_images_input.clear()

        # プレビュー更新
        self.update_image_preview()
    
    def update_image_preview(self):
        """画像パスからプレビューを更新"""
        image_path = self.image_path_input.text().strip()
        if not image_path:
            self.image_preview_label.setPixmap(QPixmap())
            self.image_preview_label.setText("画像なし\n(ここに画像をドロップ)")
            return

        resolved, mime_type = self.resolve_existing_image_path(image_path)
        if resolved and resolved.exists() and mime_type and mime_type.startswith('image/'):
            pixmap = QPixmap(str(resolved))
            if not pixmap.isNull():
                scaled = pixmap.scaled(
                    self.image_preview_label.size(),
                    Qt.AspectRatioMode.KeepAspectRatio,
                    Qt.TransformationMode.SmoothTransformation,
                )
                self.image_preview_label.setPixmap(scaled)
                self.image_preview_label.setText("")
                return

        self.image_preview_label.setPixmap(QPixmap())
        self.image_preview_label.setText("画像が見つかりません\n(ここに画像をドロップ)")

    def auto_fill_from_image_path(self):
        """画像パスからslugとサムネイルパスを自動生成"""
        image_path = self.normalize_media_path(self.image_path_input.text().strip())
        if image_path != self.image_path_input.text().strip():
            self.image_path_input.blockSignals(True)
            self.image_path_input.setText(image_path)
            self.image_path_input.blockSignals(False)

        if not image_path:
            return
        
        # /static/img/works/031-onback-winter.webp から 031-onback-winter を抽出
        from pathlib import Path
        path_obj = Path(image_path)
        
        # 拡張子を除いたファイル名をslugに
        slug = path_obj.stem
        
        # 画像パス入力時はslugをファイル名から自動設定
        if slug:
            self.slug_input.setText(slug)
        
        # サムネイルパスを推定
        if slug:
            ext = path_obj.suffix.lower()
            if ext in ('.mp4', '.mov', '.webm'):
                candidates = [
                    path_obj.parent / f"{slug}-thumb.jpg",
                    path_obj.parent / f"{slug}-thumb.png",
                    path_obj.parent / f"{slug}.jpg",
                    path_obj.parent / f"{slug}.png",
                ]
                thumbnail_path = candidates[0].as_posix()
            else:
                # 静止画の場合は .jpg サムネイルを自動生成（例: .webp -> .jpg）
                generated_thumb = path_obj.parent / f"{slug}.jpg"
                source_local = self.resolve_local_media_path(str(path_obj))
                target_local = self.resolve_local_media_path(str(generated_thumb))

                if source_local and source_local.exists() and target_local:
                    self.ensure_jpg_thumbnail(source_local, target_local)

                candidates = [
                    path_obj.parent / f"{slug}.jpg",
                    path_obj.parent / f"{slug}.png",
                    path_obj.parent / f"{slug}.webp",
                ]
                thumbnail_path = generated_thumb.as_posix()

            for c in candidates:
                # ワークスペース内の実在ファイルを優先
                local = self.resolve_local_media_path(str(c))
                if local and local.exists():
                    thumbnail_path = c.as_posix()
                    break

            # 画像パス入力時は常にサムネイルを同期
            self.thumbnail_input.setText(thumbnail_path)

    def ensure_jpg_thumbnail(self, source_path, target_path):
        """画像からJPGサムネイルを生成（必要時のみ）"""
        try:
            source = Path(source_path)
            target = Path(target_path)

            if not source.exists() or source == target:
                return False

            # 既存のJPGが新しい場合は再生成しない
            if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
                return True

            img = QImage(str(source))
            if img.isNull():
                return False

            # JPGはアルファを持てないためRGBへ変換
            img = img.convertToFormat(QImage.Format.Format_RGB888)

            target.parent.mkdir(parents=True, exist_ok=True)
            return img.save(str(target), 'JPG', 92)
        except Exception:
            return False
    
    def clear_form(self):
        """フォームをクリア"""
        self.id_input.clear()
        self.slug_input.clear()
        self.title_input.clear()
        self.date_input.clear()
        self.category_combo.setCurrentIndex(0)
        self.image_path_input.clear()
        self.thumbnail_input.clear()
        self.x_thumbnail_input.clear()
        self.tags_list.clear()
        self.tag_combo.clearEditText()
        self.request_tags_list.clear()
        self.request_tag_combo.clearEditText()
        self.description_input.clear()
        self.nsfw_check.setChecked(False)
        self.sensitive_check.setChecked(False)
        self.hidden_check.setChecked(False)
        self.hide_sensitive_thumbnail_on_x_check.setChecked(False)
        self.update_sensitive_x_option_state()
        self.pixiv_input.clear()
        self.twitter_input.clear()
        self.booth_input.clear()
        self.fanbox_input.clear()
        self.additional_images_input.clear()
        self.image_preview_label.setPixmap(QPixmap())
        self.image_preview_label.setText("画像なし\n(ここに画像をドロップ)")
        self.apply_ai_directives_to_ui(self.get_default_description_directives())
    
    def new_work(self):
        """新規作品を作成"""
        self.current_index = -1
        self.current_work = None
        self.clear_form()
        
        # 次のIDを自動設定
        if self.works:
            max_id = max(work.get('id', 0) for work in self.works)
            self.id_input.setText(str(max_id + 1))
        else:
            self.id_input.setText('1')
        
        # 今日の日付
        self.date_input.setText(datetime.now().strftime("%Y-%m-%d"))
        
        QMessageBox.information(self, "新規作品", "新しい作品を入力してください")

    def collect_work_data_from_form(self):
        """フォームから作品データを組み立てる"""
        work_data = {
            "id": int(self.id_input.text()),
            "slug": self.slug_input.text().strip(),
            "title": self.title_input.text().strip(),
            "date": self.date_input.text().strip(),
            "image_path": self.normalize_media_path(self.image_path_input.text().strip()),
            "thumbnail": self.normalize_media_path(self.thumbnail_input.text().strip()),
            "category": self.category_combo.currentText(),
        }

        x_thumb = self.normalize_x_thumbnail_path(self.x_thumbnail_input.text().strip())
        if x_thumb:
            work_data["x_thumbnail"] = x_thumb

        tags = []
        for i in range(self.tags_list.count()):
            tags.append(self.tags_list.item(i).text())
        work_data["tags"] = tags

        request_tags = []
        for i in range(self.request_tags_list.count()):
            request_tags.append(self.request_tags_list.item(i).text())
        if request_tags:
            work_data["request_tags"] = request_tags

        description = self.description_input.toPlainText().strip()
        if description:
            work_data["description"] = description

        defaults = self.get_default_description_directives()
        directives = self.collect_ai_directives_from_ui()
        if not self.directives_equal(directives, defaults):
            work_data["ai_desc_override"] = directives

        work_data["nsfw"] = self.nsfw_check.isChecked()
        if self.hidden_check.isChecked():
            work_data["hidden"] = True
        if self.sensitive_check.isChecked():
            work_data["sensitive"] = True
            if self.hide_sensitive_thumbnail_on_x_check.isChecked():
                work_data["hide_sensitive_thumbnail_on_x"] = True

        external_links = {}
        if self.pixiv_input.text().strip():
            external_links["pixiv"] = self.pixiv_input.text().strip()
        if self.twitter_input.text().strip():
            external_links["twitter"] = self.twitter_input.text().strip()
        if self.booth_input.text().strip():
            external_links["booth"] = self.booth_input.text().strip()
        if self.fanbox_input.text().strip():
            external_links["fanbox"] = self.fanbox_input.text().strip()
        work_data["external_links"] = external_links

        add_images_text = self.additional_images_input.toPlainText().strip()
        if add_images_text:
            work_data["additional_images"] = [
                self.normalize_media_path(img.strip()) for img in add_images_text.split('\n') if img.strip()
            ]

        return work_data

    def validate_work_data(self, work_data):
        """作品データを検証"""
        if not work_data["slug"]:
            raise ValueError("Slugは必須です")
        if not work_data["title"]:
            raise ValueError("タイトルは必須です")

    def persist_current_form(self, show_success_message=True):
        """現在のフォーム内容を works.json に保存"""
        work_data = self.collect_work_data_from_form()
        self.validate_work_data(work_data)

        if self.current_index == -1:
            self.works.append(work_data)
        else:
            self.works[self.current_index] = work_data

        self.save_to_file()
        self.load_works()

        target_slug = work_data["slug"]
        for index, work in enumerate(self.works):
            if work.get("slug") == target_slug:
                self.current_index = index
                self.current_work = work
                self.works_list.setCurrentRow(index)
                self.display_work(work)
                break

        if show_success_message:
            QMessageBox.information(self, "成功", "作品を保存しました")

        return True

    def form_has_meaningful_input(self):
        """フォームに未保存候補の入力があるか判定"""
        text_values = [
            self.id_input.text().strip(),
            self.slug_input.text().strip(),
            self.title_input.text().strip(),
            self.date_input.text().strip(),
            self.image_path_input.text().strip(),
            self.thumbnail_input.text().strip(),
            self.x_thumbnail_input.text().strip(),
            self.description_input.toPlainText().strip(),
            self.pixiv_input.text().strip(),
            self.twitter_input.text().strip(),
            self.booth_input.text().strip(),
            self.fanbox_input.text().strip(),
            self.additional_images_input.toPlainText().strip(),
            self.ai_custom_instruction_input.toPlainText().strip(),
        ]
        if any(text_values):
            return True
        if self.tags_list.count() or self.request_tags_list.count():
            return True
        if self.nsfw_check.isChecked() or self.sensitive_check.isChecked() or self.hidden_check.isChecked():
            return True
        if self.hide_sensitive_thumbnail_on_x_check.isChecked():
            return True
        return False

    def has_unsaved_form_changes(self):
        """フォームが選択中データから変更されているか判定"""
        if self.current_index == -1:
            return self.form_has_meaningful_input()

        try:
            current_form = self.collect_work_data_from_form()
        except Exception:
            return self.form_has_meaningful_input()

        existing = dict(self.works[self.current_index])
        return current_form != existing

    def ensure_form_saved_before_push(self):
        """push前に未保存フォームを処理"""
        if not self.has_unsaved_form_changes():
            return True

        reply = QMessageBox.question(
            self,
            "未保存の変更",
            "フォームに未保存の変更があります。保存してからGitHubへpushしますか?",
            QMessageBox.StandardButton.Save |
            QMessageBox.StandardButton.Discard |
            QMessageBox.StandardButton.Cancel,
            QMessageBox.StandardButton.Save
        )

        if reply == QMessageBox.StandardButton.Cancel:
            return False
        if reply == QMessageBox.StandardButton.Discard:
            return True

        try:
            return self.persist_current_form(show_success_message=False)
        except ValueError as e:
            QMessageBox.critical(self, "エラー", f"保存エラー:\n{e}")
            return False
        except Exception as e:
            QMessageBox.critical(self, "エラー", f"保存エラー:\n{e}")
            return False

    def save_work(self):
        """作品を保存"""
        try:
            self.persist_current_form(show_success_message=True)
            
        except ValueError as e:
            QMessageBox.critical(self, "エラー", f"入力エラー:\n{e}")
        except Exception as e:
            QMessageBox.critical(self, "エラー", f"保存エラー:\n{e}")

    def update_sensitive_x_option_state(self):
        """R15時のみXサムネイル設定を編集可能にする"""
        is_sensitive = self.sensitive_check.isChecked()
        self.hide_sensitive_thumbnail_on_x_check.setEnabled(is_sensitive)

        if not is_sensitive:
            self.hide_sensitive_thumbnail_on_x_check.setChecked(False)
    
    def save_to_file(self):
        """JSONファイルに保存"""
        # バックアップ
        backup_file = self.works_file.with_suffix('.json.backup')
        shutil.copy2(self.works_file, backup_file)
        
        # 保存
        with open(self.works_file, 'w', encoding='utf-8') as f:
            json.dump(self.works, f, ensure_ascii=False, indent=2)
    
    def delete_work(self):
        """作品を削除"""
        if self.current_index == -1:
            QMessageBox.warning(self, "警告", "作品が選択されていません")
            return
        
        work = self.works[self.current_index]
        reply = QMessageBox.question(
            self,
            "確認",
            f"本当に削除しますか?\n\n[{work['id']}] {work['title']}",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            del self.works[self.current_index]
            self.save_to_file()
            self.load_works()
            self.clear_form()
            self.current_index = -1
            QMessageBox.information(self, "成功", "作品を削除しました")
    
    def add_tag(self):
        """タグを追加"""
        tag = self.tag_combo.currentText().strip()
        if not tag:
            return
        
        # 重複チェック
        for i in range(self.tags_list.count()):
            if self.tags_list.item(i).text() == tag:
                QMessageBox.warning(self, "警告", "このタグは既に追加されています")
                return
        
        # リストに追加
        self.tags_list.addItem(tag)
        self.tag_combo.clearEditText()
    
    def remove_tag(self):
        """選択したタグを削除"""
        current_item = self.tags_list.currentItem()
        if current_item:
            self.tags_list.takeItem(self.tags_list.row(current_item))

    def add_request_tag(self):
        """イラストリクエストタグを追加"""
        tag = self.request_tag_combo.currentText().strip()
        if not tag:
            return

        for i in range(self.request_tags_list.count()):
            if self.request_tags_list.item(i).text() == tag:
                QMessageBox.warning(self, "警告", "このリクエストタグは既に追加されています")
                return

        self.request_tags_list.addItem(tag)
        self.request_tag_combo.clearEditText()

    def remove_request_tag(self):
        """選択したイラストリクエストタグを削除"""
        current_item = self.request_tags_list.currentItem()
        if current_item:
            self.request_tags_list.takeItem(self.request_tags_list.row(current_item))
    
    def move_up(self):
        """作品を上に移動"""
        if self.current_index <= 0:
            return
        
        self.works[self.current_index], self.works[self.current_index - 1] = \
            self.works[self.current_index - 1], self.works[self.current_index]
        
        self.save_to_file()
        self.current_index -= 1
        self.load_works()
        self.works_list.setCurrentRow(self.current_index)
    
    def move_down(self):
        """作品を下に移動"""
        if self.current_index == -1 or self.current_index >= len(self.works) - 1:
            return
        
        self.works[self.current_index], self.works[self.current_index + 1] = \
            self.works[self.current_index + 1], self.works[self.current_index]
        
        self.save_to_file()
        self.current_index += 1
        self.load_works()
        self.works_list.setCurrentRow(self.current_index)
    
    def generate_ai_description(self):
        """AIで説明文を生成"""
        # タイトルを取得
        title = self.title_input.text().strip()
        if not title:
            QMessageBox.warning(self, "警告", "タイトルを入力してください")
            return
        
        # 画像パスを取得
        image_path = self.image_path_input.text().strip()
        if not image_path:
            QMessageBox.warning(self, "警告", "画像パスを入力してください")
            return

        thumbnail_path = self.thumbnail_input.text().strip()
        
        # 画像の実際のパスを取得
        full_image_path = self.resolve_local_media_path(image_path)
        
        if not full_image_path or not full_image_path.exists():
            QMessageBox.warning(self, "警告", f"画像ファイルが見つかりません:\n{full_image_path}")
            return

        # AIへ渡す画像を決定（動画パスが指定されている場合はサムネイルを優先）
        mime_type, _ = mimetypes.guess_type(str(full_image_path))
        ai_image_path = full_image_path

        if not mime_type or not mime_type.startswith('image/'):
            if thumbnail_path:
                full_thumbnail_path, thumb_mime = self.resolve_existing_image_path(thumbnail_path)
                if full_thumbnail_path and full_thumbnail_path.exists() and thumb_mime and thumb_mime.startswith('image/'):
                    ai_image_path = full_thumbnail_path
                    mime_type = thumb_mime
                else:
                    QMessageBox.warning(
                        self,
                        "警告",
                        "image_path が画像ではないため、サムネイル画像が必要です。\n"
                        "有効な thumbnail を設定してください。\n"
                        f"入力値: {thumbnail_path}\n"
                        f"解決先: {full_thumbnail_path}"
                    )
                    return
            else:
                QMessageBox.warning(
                    self,
                    "警告",
                    "image_path が画像ではありません。\n"
                    "動画作品の場合は thumbnail に画像を設定してください。"
                )
                return
        
        # API設定ファイルを確認
        config_file = Path(__file__).parent / "ai_config.json"
        if not config_file.exists():
            reply = QMessageBox.question(
                self,
                "API設定が必要です",
                "OpenAI APIキーが設定されていません。\n設定ファイルを作成しますか？",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            if reply == QMessageBox.StandardButton.Yes:
                self.create_ai_config()
            return
        
        # 設定を読み込み
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                ai_config = json.load(f)
            model = ai_config.get('model', 'gpt-4o-mini').strip() or 'gpt-4o-mini'
            fallback_model = ai_config.get('fallback_model', 'gpt-4.1-mini').strip() or 'gpt-4.1-mini'
            max_tokens = int(ai_config.get('max_tokens', 220))
            image_max_bytes = int(ai_config.get('image_max_bytes', 1_500_000))
            retry_count = int(ai_config.get('retry_count', 2))

            # APIキーを別ファイルから読み込み
            api_keys_filename = ai_config.get('api_keys_file', 'api_keys.json')
            api_keys_file = Path(__file__).parent / api_keys_filename
            if not api_keys_file.exists():
                QMessageBox.warning(
                    self, "警告",
                    f"APIキーファイルが見つかりません:\n{api_keys_file}\n\n"
                    "api_keys.json を作成し、openai_api_key を設定してください。"
                )
                return
            with open(api_keys_file, 'r', encoding='utf-8') as f:
                api_keys = json.load(f)
            api_key = (api_keys.get('openai_api_key') or api_keys.get('api_key') or '').strip()

            if not api_key or api_key == 'your-api-key-here':
                QMessageBox.warning(self, "警告", f"{api_keys_filename} に openai_api_key を設定してください")
                return
        except Exception as e:
            QMessageBox.critical(self, "エラー", f"設定ファイル読み込みエラー:\n{e}")
            return
        
        # APIを呼び出して説明文を生成
        try:
            import base64
            import time
            import requests
            
            # 画像が大きすぎる場合はAPI制限対策としてテキストのみで生成
            use_image = True
            file_size = ai_image_path.stat().st_size
            if file_size > image_max_bytes:
                use_image = False

            base64_image = None
            if use_image:
                with open(ai_image_path, 'rb') as img_file:
                    base64_image = base64.b64encode(img_file.read()).decode('utf-8')
            
            # OpenAI API呼び出し
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            
            # タグも取得
            tags = [self.tags_list.item(i).text() for i in range(self.tags_list.count())]
            request_tags = [self.request_tags_list.item(i).text() for i in range(self.request_tags_list.count())]
            context = {
                "title": title,
                "tags": tags,
                "request_tags": request_tags,
                "category": self.category_combo.currentText()
            }
            prompt_text = self.build_description_prompt(context, self.collect_ai_directives_from_ui())

            def build_payload(target_model, include_image=True):
                if include_image and base64_image:
                    content = [
                        {"type": "text", "text": prompt_text},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{base64_image}"}
                        }
                    ]
                else:
                    content = prompt_text

                return {
                    "model": target_model,
                    "messages": [
                        {
                            "role": "user",
                            "content": content
                        }
                    ],
                    "max_tokens": max_tokens
                }
            
            # プログレスダイアログを表示
            from PyQt6.QtWidgets import QProgressDialog
            from PyQt6.QtCore import Qt
            
            progress = QProgressDialog("AIで説明文を生成しています...", None, 0, 0, self)
            progress.setWindowTitle("生成中")
            progress.setWindowModality(Qt.WindowModality.WindowModal)
            progress.setCancelButton(None)
            progress.setMinimumDuration(0)
            progress.setValue(0)
            progress.show()
            QApplication.processEvents()
            
            try:
                response = None
                models_to_try = [model]
                if fallback_model and fallback_model != model:
                    models_to_try.append(fallback_model)

                # 1) 画像ありで試行（必要に応じてリトライ）
                # 2) 429時はテキストのみへフォールバック
                for model_idx, target_model in enumerate(models_to_try):
                    for attempt in range(retry_count + 1):
                        payload = build_payload(target_model, include_image=use_image)
                        response = requests.post(
                            "https://api.openai.com/v1/chat/completions",
                            headers=headers,
                            json=payload,
                            timeout=60
                        )

                        if response.status_code == 200:
                            break

                        if response.status_code == 429 and attempt < retry_count:
                            time.sleep(1.5 * (attempt + 1))
                            continue

                        # 画像付きで429/413が出たら、同モデルでテキストのみ再試行
                        if use_image and response.status_code in (413, 429):
                            use_image = False
                            if attempt < retry_count:
                                time.sleep(1.0)
                                continue

                        break

                    if response is not None and response.status_code == 200:
                        break

                    # 429でモデル切替時に短く待機
                    if response is not None and response.status_code == 429 and model_idx < len(models_to_try) - 1:
                        time.sleep(1.0)
            finally:
                progress.close()
                QApplication.processEvents()
            
            if response.status_code == 200:
                result = response.json()
                message_content = result['choices'][0]['message']['content']
                if isinstance(message_content, str):
                    description = message_content.strip()
                else:
                    # モデル・APIバージョンによって配列形式になる場合がある
                    text_parts = []
                    for part in message_content:
                        if isinstance(part, dict) and part.get('type') in ('text', 'output_text'):
                            text_parts.append(part.get('text', ''))
                    description = ''.join(text_parts).strip()

                if not description:
                    raise ValueError("AIレスポンスに説明文が含まれていません")

                self.description_input.setPlainText(description)
                QMessageBox.information(self, "成功", "説明文を生成しました！")
            else:
                error_message = response.text
                try:
                    error_json = response.json()
                    error_message = error_json.get('error', {}).get('message', response.text)
                except Exception:
                    pass

                if response.status_code in (401, 403):
                    hint = (
                        "\n\n認証エラーです。以下を確認してください:\n"
                        "1) ai_config.json の openai_api_key が正しいか\n"
                        "2) APIキーが無効化されていないか\n"
                        "3) OpenAI側で請求(Billing)設定が有効か"
                    )
                elif response.status_code == 429:
                    hint = (
                        "\n\n利用制限エラーです。以下を確認してください:\n"
                        "1) OpenAI側のUsage/Billingで残高・上限を確認\n"
                        "2) しばらく待って再実行（短時間のレート制限の可能性）\n"
                        "3) ai_config.json で model を軽量モデルに変更（例: gpt-4o-mini）\n"
                        "4) image_max_bytes を小さくして画像送信を抑制"
                    )
                else:
                    hint = ""

                QMessageBox.critical(
                    self,
                    "エラー",
                    f"API呼び出しエラー:\nHTTP {response.status_code}\n{error_message}{hint}"
                )
        
        except ImportError:
            QMessageBox.critical(self, "エラー", "requestsライブラリがインストールされていません。\n\npip install requests")
        except Exception as e:
            QMessageBox.critical(self, "エラー", f"説明文生成エラー:\n{e}")
    
    def create_ai_config(self):
        """AI設定ファイルを作成"""
        config_file = Path(__file__).parent / "ai_config.json"
        api_keys_file = Path(__file__).parent / "api_keys.json"

        config_template = {
            "api_keys_file": "api_keys.json",
            "model": "gpt-4o-mini",
            "fallback_model": "gpt-4.1-mini",
            "max_tokens": 220,
            "image_max_bytes": 1500000,
            "retry_count": 2,
            "description_generation": dict(self.DEFAULT_DESCRIPTION_DIRECTIVES)
        }
        api_keys_template = {
            "openai_api_key": "your-api-key-here"
        }
        try:
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config_template, f, indent=2, ensure_ascii=False)
            if not api_keys_file.exists():
                with open(api_keys_file, 'w', encoding='utf-8') as f:
                    json.dump(api_keys_template, f, indent=2, ensure_ascii=False)
            QMessageBox.information(
                self,
                "設定ファイル作成完了",
                f"設定ファイルを作成しました。\n\n"
                f"① AI設定: {config_file}\n"
                f"② APIキー: {api_keys_file}\n\n"
                f"api_keys.json を開いてOpenAI APIキーを設定してください。\n"
                f"※ api_keys.json は .gitignore に含まれています。"
            )
        except Exception as e:
            QMessageBox.critical(self, "エラー", f"設定ファイル作成エラー:\n{e}")

    def run_git_command(self, args, cwd):
        """Gitコマンドを実行して結果を返す"""
        result = subprocess.run(
            args,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        return result

    def push_to_github(self):
        """変更をGitHubへpush"""
        repo_dir = Path(__file__).parent

        # Git管理下か確認
        if not (repo_dir / '.git').exists():
            QMessageBox.warning(self, "警告", f"Gitリポジトリではありません:\n{repo_dir}")
            return

        default_message = f"Update works via Works Manager {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        commit_message, ok = QInputDialog.getText(
            self,
            "GitHub Push",
            "コミットメッセージを入力してください:",
            text=default_message
        )
        if not ok:
            return
        commit_message = commit_message.strip()
        if not commit_message:
            QMessageBox.warning(self, "警告", "コミットメッセージが空です")
            return

        # プログレス表示
        from PyQt6.QtWidgets import QProgressDialog

        progress = QProgressDialog("GitHubへpushしています...", None, 0, 0, self)
        progress.setWindowTitle("処理中")
        progress.setWindowModality(Qt.WindowModality.WindowModal)
        progress.setCancelButton(None)
        progress.setMinimumDuration(0)
        progress.setValue(0)
        progress.show()
        QApplication.processEvents()

        try:
            if not self.ensure_form_saved_before_push():
                return

            # Gitコマンドが使えるか確認
            version_result = self.run_git_command(["git", "--version"], repo_dir)
            if version_result.returncode != 0:
                QMessageBox.critical(self, "エラー", "Gitコマンドが実行できません。Gitをインストールしてください。")
                return

            # サイトのビルドは push 後に GitHub Actions (deploy.yml) が自動実行する

            # 変更有無確認
            progress.setLabelText("変更を確認しています...")
            QApplication.processEvents()
            status_result = self.run_git_command(["git", "status", "--porcelain"], repo_dir)
            if status_result.returncode != 0:
                QMessageBox.critical(self, "エラー", f"git status 失敗:\n{status_result.stderr}")
                return

            has_changes = bool(status_result.stdout.strip())

            # add
            progress.setLabelText("git add を実行しています...")
            QApplication.processEvents()
            add_result = self.run_git_command(["git", "add", "-A"], repo_dir)
            if add_result.returncode != 0:
                QMessageBox.critical(self, "エラー", f"git add 失敗:\n{add_result.stderr}")
                return

            # commit（変更がある場合のみ）
            commit_output = ""
            if has_changes:
                progress.setLabelText("git commit を実行しています...")
                QApplication.processEvents()
                commit_result = self.run_git_command(["git", "commit", "-m", commit_message], repo_dir)
                commit_output = (commit_result.stdout or "") + (commit_result.stderr or "")
                if commit_result.returncode != 0 and "nothing to commit" not in commit_output.lower():
                    QMessageBox.critical(self, "エラー", f"git commit 失敗:\n{commit_output}")
                    return

            # push
            progress.setLabelText("git push を実行しています...")
            QApplication.processEvents()
            push_result = self.run_git_command(["git", "push"], repo_dir)
            push_output = (push_result.stdout or "") + (push_result.stderr or "")
            if push_result.returncode != 0:
                QMessageBox.critical(
                    self,
                    "エラー",
                    "git push に失敗しました。\n\n"
                    "考えられる原因:\n"
                    "- リモート未設定\n"
                    "- upstream未設定\n"
                    "- 認証エラー\n\n"
                    f"詳細:\n{push_output}"
                )
                return

            if has_changes:
                QMessageBox.information(self, "成功", f"コミットしてGitHubへpushしました。\n\n{push_output}")
            else:
                QMessageBox.information(self, "完了", f"変更はありませんでしたが、pushを実行しました。\n\n{push_output}")

        except FileNotFoundError:
            QMessageBox.critical(self, "エラー", "Gitが見つかりません。Gitをインストールしてください。")
        except Exception as e:
            QMessageBox.critical(self, "エラー", f"GitHub Pushエラー:\n{e}")
        finally:
            progress.close()
            QApplication.processEvents()


def main():
    app = QApplication(sys.argv)
    app.setStyle('Fusion')  # モダンなスタイル
    
    window = WorksManagerQt()
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
