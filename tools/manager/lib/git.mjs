/**
 * 公開（git の commit / push）。旧ツールの「GitHub Push」と同じ流れ:
 *   add -A → commit → pull --rebase（リモートに同じブランチがあるとき）→ push
 * リモートが未設定の間は commit までで止める。
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** @returns {Promise<{ code: number, stdout: string, stderr: string }>} */
export function runGit(args, cwd) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn('git', ['-c', 'core.quotepath=false', ...args], {
        cwd,
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
    } catch (error) {
      resolve({ code: -1, stdout: '', stderr: error.message });
      return;
    }
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf-8').on('data', (chunk) => (stdout += chunk));
    child.stderr.setEncoding('utf-8').on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) =>
      resolve({ code: -1, stdout, stderr: error.code === 'ENOENT' ? 'Git が見つかりません。Git をインストールしてください。' : error.message }),
    );
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

const GROUPS = [
  ['作品データ', (p) => p === 'data/works.json'],
  ['画像・動画', (p) => p.startsWith('static/img/')],
  ['リクエスト', (p) => p === 'data/requests.json'],
  ['サイトの設定・文章', (p) => /^data\/(notes|request_options|commission|config)\.json$/.test(p)],
  ['閲覧数・いいね', (p) => p === 'data/counts.json'],
];

/** 変更されたファイルを、作者に分かる区分に分ける */
export function classifyPath(filePath) {
  return GROUPS.find(([, test]) => test(filePath))?.[0] ?? 'プログラム・その他';
}

/** `git status --porcelain=v1 -z` の出力 → [{ path, state, group }] */
export function parseStatus(output) {
  const changes = [];
  const entries = output.split('\0');
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.length < 4) continue;
    const code = entry.slice(0, 2);
    const filePath = entry.slice(3);
    // 名前変更・コピーは、次の項目に元の名前が入っている
    if (/[RC]/.test(code)) i++;
    const state = code === '??' || code.includes('A') ? '追加' : code.includes('D') ? '削除' : code.includes('R') ? '名前変更' : '変更';
    changes.push({ path: filePath, state, group: classifyPath(filePath) });
  }
  return changes;
}

/** 変更を区分ごとにまとめる（区分の並びは GROUPS の順） */
export function groupChanges(changes) {
  const order = [...GROUPS.map(([name]) => name), 'プログラム・その他'];
  return order
    .map((name) => ({ name, files: changes.filter((change) => change.group === name) }))
    .filter((group) => group.files.length > 0);
}

export async function getGitStatus(root) {
  if (!existsSync(path.join(root, '.git'))) {
    return { isRepo: false, branch: '', hasRemote: false, hasCommits: false, unpushed: false, changes: [], groups: [] };
  }
  const [branch, head, remotes, status] = await Promise.all([
    runGit(['symbolic-ref', '--short', 'HEAD'], root),
    runGit(['rev-parse', '--verify', '--quiet', 'HEAD'], root),
    runGit(['remote'], root),
    runGit(['status', '--porcelain=v1', '-uall', '-z'], root),
  ]);
  if (status.code !== 0) throw new Error(`git status に失敗しました: ${status.stderr.trim()}`);

  const hasRemote = remotes.stdout.split('\n').some((name) => name.trim() === 'origin');
  const hasCommits = head.code === 0;
  let unpushed = false;
  if (hasRemote && hasCommits) {
    const ahead = await runGit(['rev-list', '--count', '@{upstream}..HEAD'], root);
    // upstream が未設定（まだ一度も push していない）なら、送っていないコミットがあるとみなす
    unpushed = ahead.code !== 0 || Number(ahead.stdout.trim()) > 0;
  }
  const changes = parseStatus(status.stdout);
  return { isRepo: true, branch: branch.stdout.trim(), hasRemote, hasCommits, unpushed, changes, groups: groupChanges(changes) };
}

/**
 * commit して、リモートがあれば push まで行う。
 * @returns {Promise<{ ok: boolean, committed: boolean, pushed: boolean, steps: { name: string, ok: boolean, output: string }[], error?: string }>}
 */
export async function publish(root, message) {
  const steps = [];
  const result = { ok: false, committed: false, pushed: false, steps };
  const step = async (name, args, { allowFail = false } = {}) => {
    const run = await runGit(args, root);
    const output = `${run.stdout}${run.stderr}`.trim();
    steps.push({ name, ok: run.code === 0 || allowFail, output });
    return run;
  };
  const fail = (error) => ({ ...result, error });

  const status = await getGitStatus(root);
  if (!status.isRepo) return fail('このフォルダは Git リポジトリではありません。');

  if ((await step('変更をまとめる (git add)', ['add', '-A'])).code !== 0) return fail('git add に失敗しました。');

  const staged = await runGit(['diff', '--cached', '--quiet'], root);
  if (staged.code === 1) {
    const commit = await step('記録する (git commit)', ['commit', '-m', message]);
    if (commit.code !== 0) {
      const needsIdentity = /Please tell me who you are|user\.(name|email)/.test(commit.stderr);
      return fail(needsIdentity ? 'Git の名前とメールアドレスが未設定です（git config user.name / user.email）。' : 'git commit に失敗しました。');
    }
    result.committed = true;
  }

  if (!status.hasRemote) {
    result.ok = true;
    return result;
  }

  const branch = status.branch;
  if (!branch) return fail('現在のブランチが分かりません。');

  // push 前にリモートの変更（閲覧数の日次更新など）を取り込む
  const remoteBranch = await runGit(['ls-remote', '--exit-code', '--heads', 'origin', branch], root);
  if (remoteBranch.code === 0) {
    const pull = await step('リモートの変更を取り込む (git pull --rebase)', ['pull', '--rebase', 'origin', branch]);
    if (pull.code !== 0) {
      await step('取り込みを中断して元に戻す (git rebase --abort)', ['rebase', '--abort'], { allowFail: true });
      return fail('リモートの変更の取り込みに失敗しました。同じ箇所が両方で変更されている可能性があります。');
    }
  } else if (remoteBranch.code !== 2) {
    steps.push({ name: 'リモートを確認する (git ls-remote)', ok: false, output: remoteBranch.stderr.trim() });
    return fail('リモートに接続できませんでした。ネットワークと認証を確認してください。');
  }

  const push = await step('公開する (git push)', ['push', '-u', 'origin', branch]);
  if (push.code !== 0) return fail('git push に失敗しました。認証やリモートの設定を確認してください。');
  result.pushed = true;
  result.ok = true;
  return result;
}
