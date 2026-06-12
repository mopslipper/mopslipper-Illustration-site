"""works_manager GUI のオフスクリーン・スモークテスト（CI/検証用）。

QT_QPA_PLATFORM=offscreen で起動し、ダイアログをすべて print に差し替えて
works.json の読込・一覧構築までを確認する。
"""
import os
import sys
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PyQt6.QtWidgets import QApplication, QMessageBox

# モーダルダイアログを無効化（offscreen では永久ブロックするため）
for name in ("information", "warning", "critical", "question"):
    setattr(
        QMessageBox,
        name,
        staticmethod(lambda *a, _n=name, **k: print(f"[dialog:{_n}]", a[1:3]) or QMessageBox.StandardButton.Ok),
    )

import works_manager_qt as m

app = QApplication([])
w = m.WorksManagerQt()
print("works loaded:", len(w.works))
print("list items:", w.works_list.count())
print("works_file:", w.works_file)
print("SMOKE OK")
