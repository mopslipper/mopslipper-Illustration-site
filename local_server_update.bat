@echo off
rem ローカルプレビューサーバを最新の状態に更新するスクリプト
rem 1. site/ をビルドして dist/ を更新
rem 2. プレビューサーバ(port 4323)が起動していなければ起動
setlocal

cd /d "%~dp0site"

echo === Astro ビルド中... ===
call npm run build
if errorlevel 1 (
    echo.
    echo *** ビルドに失敗しました ***
    pause
    exit /b 1
)

rem ポート4323で待ち受け中か確認
netstat -ano | findstr ":4323" | findstr "LISTENING" >nul
if errorlevel 1 (
    echo === プレビューサーバを起動します (port 4323) ===
    start "astro preview" cmd /k npx astro preview --port 4323
) else (
    echo === プレビューサーバは起動済み。dist/ が更新されたのでリロードすれば反映されます ===
)

echo.
echo URL: http://localhost:4323/mopslipper-Illustration-site/
pause
