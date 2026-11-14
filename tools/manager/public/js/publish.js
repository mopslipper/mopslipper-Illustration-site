/** 公開画面: 変更の一覧、公開前チェック、commit / push */
import { api } from './api.js';
import { h, setChildren, field, toast, toastError, setDirtyCheck, busy } from './ui.js';

const SHOW_FILES = 12;

export async function renderPublish(root, _route, ctx) {
  setDirtyCheck(null);
  const body = h('div', { class: 'stack', id: 'publish-body' });
  setChildren(root, 
    h('div', { class: 'page-head' }, h('h1', null, '公開'), h('p', { class: 'muted' }, '保存した変更をまとめて記録し、サイトに反映します。')),
    body,
  );

  async function render(lastResult) {
    const status = await api.get('/api/publish');
    ctx.refreshBadges();

    if (!status.isRepo) {
      setChildren(body, 
        h('section', { class: 'card' }, h('h2', null, '公開できません'), h('p', null, 'このフォルダは Git リポジトリではありません。変更はファイルに保存されていますが、ここからは公開できません。')),
      );
      return;
    }

    const hasChanges = status.changes.length > 0;
    const canPush = status.hasRemote && (hasChanges || status.unpushed);
    const actionable = hasChanges || canPush;

    // ---- 変更の一覧 ----
    const changes = h(
      'section',
      { class: 'card', id: 'publish-changes' },
      h('h2', null, hasChanges ? `まだ公開していない変更（${status.changes.length} 件）` : 'まだ公開していない変更はありません'),
      hasChanges
        ? status.groups.map((group) =>
            h(
              'details',
              { class: 'sub change-group', open: group.files.length <= SHOW_FILES },
              h('summary', null, `${group.name}（${group.files.length}）`),
              h(
                'ul',
                { class: 'file-list' },
                group.files.slice(0, 200).map((file) => h('li', null, h('span', { class: 'mark' }, file.state), ' ', file.path)),
                group.files.length > 200 ? h('li', { class: 'muted' }, `ほか ${group.files.length - 200} 件`) : null,
              ),
            ),
          )
        : status.unpushed
          ? h('p', { class: 'note' }, '記録済みで、まだリモートに送っていない変更があります。')
          : null,
    );

    // ---- 公開前チェック ----
    const checkResult = h('div', { id: 'publish-check-result' });
    const checkButton = h('button', { class: 'btn btn-ghost', type: 'button', id: 'publish-check' }, '公開前チェックを実行');
    const showCheck = (check) => {
      setChildren(checkResult, 
        check.ok
          ? h('p', { class: 'note note-public' }, '✓ 問題は見つかりませんでした。')
          : h(
              'div',
              { class: 'note note-error' },
              h('p', null, `${check.problems.length} 件の問題があります。直してから公開してください。`),
              h('ul', null, check.problems.slice(0, 30).map((problem) => h('li', null, `${problem.file}: ${problem.message}`))),
            ),
      );
    };
    checkButton.addEventListener('click', async () => {
      try {
        showCheck(await busy(checkButton, '確認中…', () => api.post('/api/publish/check')));
      } catch (error) {
        toastError(error);
      }
    });

    // ---- 公開 ----
    const messageInput = h('input', { type: 'text', id: 'publish-message', value: status.defaultMessage, maxLength: 200 });
    const publishButton = h(
      'button',
      { class: 'btn btn-primary', type: 'button', id: 'publish-run', disabled: !actionable },
      status.hasRemote ? '公開する' : '変更を記録する',
    );
    const resultEl = h('div', { id: 'publish-result' });

    const showResult = (result) => {
      if (!result) return;
      setChildren(resultEl, 
        h(
          'div',
          { class: `note ${result.ok ? 'note-public' : 'note-error'}` },
          h(
            'p',
            null,
            result.ok
              ? result.pushed
                ? '✓ 公開しました。数分後にサイトへ反映されます。'
                : result.committed
                  ? '✓ 変更を記録しました（リモートが未設定のため、公開はしていません）。'
                  : '記録する変更はありませんでした。'
              : `✕ ${result.error}`,
          ),
          result.steps?.length
            ? h(
                'details',
                { class: 'sub', open: !result.ok },
                h('summary', null, '実行した内容'),
                h(
                  'ul',
                  { class: 'file-list' },
                  result.steps.map((step) => h('li', null, h('span', { class: `mark${step.ok ? '' : ' mark-off'}` }, step.ok ? 'OK' : '失敗'), ' ', step.name, step.output ? h('pre', null, step.output.slice(0, 1500)) : null)),
                ),
              )
            : null,
        ),
      );
    };

    publishButton.addEventListener('click', async () => {
      try {
        const result = await busy(publishButton, status.hasRemote ? '公開中…（しばらくかかることがあります）' : '記録中…', () =>
          api.post('/api/publish', { message: messageInput.value }),
        );
        if (result.ok) toast(result.pushed ? '公開しました' : '変更を記録しました');
        await render(result);
      } catch (error) {
        if (error.data?.check) showCheck(error.data.check);
        toastError(error);
      }
    });

    const action = h(
      'section',
      { class: 'card form', id: 'publish-action' },
      h('h2', null, status.hasRemote ? '公開する' : '変更を記録する'),
      status.hasRemote
        ? h('p', { class: 'hint' }, `ブランチ ${status.branch} を GitHub に送ります。公開の前に、自動でチェックを行います。`)
        : h(
            'p',
            { class: 'note', id: 'publish-no-remote' },
            '公開先（リモート）がまだ設定されていません。いまは変更を記録（commit）するところまで行います。公開先を決めたら、git remote add origin <URL> を設定すると、ここから公開できます。',
          ),
      h('div', { class: 'row' }, checkButton),
      checkResult,
      field('変更の説明（コミットメッセージ）', messageInput),
      h('div', { class: 'row end' }, publishButton),
      resultEl,
    );

    // ---- 確認用のサイト ----
    const preview = ctx.preview;
    const previewCard = h(
      'section',
      { class: 'card', id: 'publish-preview' },
      h('h2', null, '公開前にサイトを確認する'),
      preview?.running
        ? h('p', null, h('a', { class: 'btn btn-outline', href: preview.url, target: '_blank', rel: 'noopener' }, '確認用のサイトを開く ↗'))
        : h('p', { class: 'hint' }, 'run.bat をダブルクリックすると確認用のサイトが開き、保存した内容をすぐに確かめられます。'),
    );

    setChildren(body, changes, action, previewCard);
    showResult(lastResult);
  }

  await render();
  return {};
}
