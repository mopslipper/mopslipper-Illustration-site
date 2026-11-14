@echo off
chcp 65001 > nul
rem ローカル開発サーバ (astro dev) を起動するスクリプト
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

echo ============================================================
echo   mopslipper 開発サーバ
echo   起動するとブラウザでサイトが開きます
echo   終了するには Ctrl+C
echo ============================================================
echo.

rem --open: 起動後にブラウザでサイトを開く（base_path は data/config.json から自動で付く）
call npx astro dev --port 4321 --open
pause
