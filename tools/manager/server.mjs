#!/usr/bin/env node
/**
 * 管理ツールの起動スクリプト。ルートの manager.bat から呼ばれる。
 *
 *   node tools/manager/server.mjs [--port 4400] [--root <フォルダ>] [--no-open]
 *
 * --root は data/ と static/img/ があるフォルダ（省略時はこのリポジトリ）。
 * ブラウザで管理画面が開く。終了するにはこのウィンドウを閉じる（または Ctrl+C）。
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function parseArgs(argv) {
  const options = { root: REPO_ROOT, port: 4400, open: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--no-open') options.open = false;
    else if (arg === '--root') options.root = path.resolve(argv[++i] ?? '');
    else if (arg === '--port') options.port = Number(argv[++i]);
    else throw new Error(`不明なオプションです: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) throw new Error('--port の値が正しくありません');
  return options;
}

function openBrowser(url) {
  const command =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    spawn(command[0], command[1], { stdio: 'ignore', detached: true, windowsHide: true }).unref();
  } catch {
    /* 開けなくても、表示されたアドレスを手で開けば使える */
  }
}

/** すでに同じフォルダの管理ツールが動いていれば、そのアドレスを返す */
async function findRunning(port, root) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/bootstrap`, { signal: AbortSignal.timeout(800) });
    const info = await response.json();
    return info.manager === true && path.resolve(info.root ?? '') === path.resolve(root) ? `http://127.0.0.1:${port}/` : null;
  } catch {
    return null;
  }
}

async function main() {
  // サイトと同じスキーマ (TypeScript) をそのまま読み込むため、型を外して実行できる Node が必要
  if (!process.features?.typescript) {
    throw new Error(`Node.js 22.18 以上が必要です（現在 ${process.version}）。https://nodejs.org/ から新しい版を入れてください。`);
  }
  const options = parseArgs(process.argv.slice(2));

  const running = options.port ? await findRunning(options.port, options.root) : null;
  if (running) {
    console.log(`管理ツールはすでに起動しています: ${running}`);
    if (options.open) openBrowser(running);
    return;
  }

  const { startManagerServer } = await import('./lib/app.mjs');
  const server = await startManagerServer({ root: options.root, port: options.port });

  console.log('============================================================');
  console.log('  mopslipper 管理ツール');
  console.log(`  管理画面 : ${server.url}`);
  console.log(`  対象     : ${options.root}`);
  console.log('  終了するには、このウィンドウを閉じてください（Ctrl+C でも可）');
  console.log('============================================================');
  if (options.open) openBrowser(server.url);

  const stop = () => server.close().finally(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((error) => {
  console.error(`\n[エラー] ${error.message}`);
  process.exitCode = 1;
});
