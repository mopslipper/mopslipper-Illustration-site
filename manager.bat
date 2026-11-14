@echo off
chcp 65001 > nul
rem 管理ツール（リクエスト・作品・サイトの設定・公開）を起動する。ブラウザで管理画面が開く。
rem 終了するには、このウィンドウを閉じる。
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo *** Node.js が見つかりません。https://nodejs.org/ からインストールしてください ***
    pause
    exit /b 1
)

if not exist site\node_modules (
    echo === 依存パッケージをインストール中... ===
    pushd site
    call npm install
    if errorlevel 1 (
        popd
        echo.
        echo *** npm install に失敗しました ***
        pause
        exit /b 1
    )
    popd
)

node tools\manager\server.mjs %*
if errorlevel 1 pause
