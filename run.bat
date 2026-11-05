@echo off
chcp 65001 > nul
rem ローカル開発サーバ (astro dev) を起動するスクリプト
rem 開発者向けページ /dev/requests は dev サーバでのみ利用可能
setlocal

cd /d "%~dp0site"

if not exist node_modules (
    echo === 依存パッケージをインストール中... ===
    call npm install
    if errorlevel 1 (
        echo.
        echo *** npm install に失敗しました ***
        pause
        exit /b 1
    )
)

set "BASE_URL=http://localhost:4321/mopslipper-Illustration-site"

netstat -ano | findstr ":4321" | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo === ポート4321 は使用中です。既に起動しているサーバを開きます ===
    start "" "%BASE_URL%/"
    exit /b 0
)

echo ============================================================
echo   mopslipper 開発サーバ
echo   サイト        : %BASE_URL%/
echo   リクエストメモ: %BASE_URL%/dev/requests
echo   終了するには Ctrl+C
echo ============================================================
echo.

rem --open: 起動後にブラウザでサイトを開く
call npx astro dev --port 4321 --open
pause
