/** サイト画面: トップの「ひとこと」、リクエストフォームの選択肢、有償依頼の受付状態 */
import { api } from './api.js';
import { h, setChildren, field, toast, toastError, setDirtyCheck, busy, snapshot } from './ui.js';

const newId = (prefix) => `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

export async function renderSite(root, _route, ctx) {
  const data = await api.get('/api/site');
  const dirtyChecks = [];

  /** 1つのカード（見出し・中身・保存ボタン）。read() が保存する値、save(value) が保存処理 */
  function section({ id, title, lead, body, read, save }) {
    let initial = snapshot(read());
    const button = h('button', { class: 'btn btn-primary', type: 'button', id: `${id}-save` }, '保存する');
    button.addEventListener('click', async () => {
      try {
        const value = read();
        await busy(button, '保存中…', () => save(value));
        initial = snapshot(read());
        ctx.refreshBadges();
        toast(`${title}を保存しました`);
      } catch (error) {
        toastError(error);
      }
    });
    dirtyChecks.push(() => snapshot(read()) !== initial);
    return h('section', { class: 'card form', id }, h('h2', null, title), lead ? h('p', { class: 'hint' }, lead) : null, body, h('div', { class: 'row end' }, button));
  }

  // ---- ひとこと -----------------------------------------------------------------

  const notes = data.notes.map((note) => ({ date: note.date, text: note.text, link: note.link ?? '' }));
  const notesEl = h('div', { class: 'rows', id: 'notes-rows' });

  function renderNotes() {
    setChildren(notesEl, 
      notes.length === 0
        ? h('p', { class: 'muted small' }, 'ひとことはまだありません。')
        : notes.map((note, index) =>
            h(
              'div',
              { class: 'row-card note-row' },
              h(
                'div',
                { class: 'row nowrap' },
                h('input', { type: 'date', value: note.date, 'aria-label': '日付', onchange: (event) => { note.date = event.target.value; } }),
                h('button', { class: 'btn btn-ghost btn-sm danger', type: 'button', onclick: () => { notes.splice(index, 1); renderNotes(); } }, '削除'),
              ),
              h('textarea', { rows: 2, value: note.text, 'aria-label': '本文', placeholder: '近況やお知らせを短く', oninput: (event) => { note.text = event.target.value; } }),
              h('input', {
                type: 'text', value: note.link, 'aria-label': 'リンク', placeholder: 'リンク（任意）例: /gallery.html?tag=ハロウィン',
                oninput: (event) => { note.link = event.target.value; },
              }),
            ),
          ),
    );
  }
  renderNotes();

  const notesSection = section({
    id: 'site-notes',
    title: 'ひとこと',
    lead: 'トップページに、新しいものから3件が表示されます。',
    body: h(
      'div',
      null,
      h(
        'button',
        {
          class: 'btn btn-ghost btn-sm',
          type: 'button',
          id: 'note-add',
          onclick: () => {
            notes.unshift({ date: data.today, text: '', link: '' });
            renderNotes();
            notesEl.querySelector('textarea')?.focus();
          },
        },
        '＋ ひとことを追加',
      ),
      notesEl,
    ),
    read: () => notes.map((note) => ({ date: note.date, text: note.text.trim(), link: note.link.trim() })),
    save: (value) => api.put('/api/site/notes', { notes: value }),
  });

  // ---- リクエストフォームの選択肢 -------------------------------------------------

  const groups = data.requestOptions.groups.map((group) => ({ id: group.id, label: group.label, options: [...group.options] }));
  const variants = data.requestOptions.variants.map((variant) => ({ ...variant }));
  const groupsEl = h('div', { class: 'rows', id: 'option-groups' });
  const variantsEl = h('div', { class: 'rows', id: 'option-variants' });

  function move(list, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
  }

  function renderGroups() {
    setChildren(groupsEl, 
      groups.map((group, index) => {
        const addInput = h('input', { type: 'text', placeholder: '選択肢を入力して Enter（「、」で区切るとまとめて追加）', 'aria-label': `${group.label} に選択肢を追加` });
        const add = () => {
          for (const option of addInput.value.split(/[,、]/).map((v) => v.trim()).filter(Boolean)) {
            if (!group.options.includes(option)) group.options.push(option);
          }
          renderGroups();
          groupsEl.children[index]?.querySelector('input[placeholder^="選択肢"]')?.focus();
        };
        addInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            add();
          }
        });
        return h(
          'div',
          { class: 'row-card option-group', dataset: { group: group.id } },
          h(
            'div',
            { class: 'row nowrap' },
            h('input', { type: 'text', class: 'group-label', value: group.label, 'aria-label': 'グループ名', oninput: (event) => { group.label = event.target.value; } }),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: index === 0, 'aria-label': '上へ', onclick: () => { move(groups, index, -1); renderGroups(); } }, '↑'),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: index === groups.length - 1, 'aria-label': '下へ', onclick: () => { move(groups, index, 1); renderGroups(); } }, '↓'),
            h('button', { class: 'btn btn-ghost btn-sm danger', type: 'button', onclick: () => { groups.splice(index, 1); renderGroups(); } }, '削除'),
          ),
          h(
            'div',
            { class: 'tag-chips' },
            group.options.map((option, optionIndex) =>
              h(
                'span',
                { class: 'tag' },
                option,
                h('button', { type: 'button', 'aria-label': `${option} を外す`, onclick: () => { group.options.splice(optionIndex, 1); renderGroups(); } }, '×'),
              ),
            ),
          ),
          h('div', { class: 'row nowrap' }, addInput, h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: add }, '追加')),
        );
      }),
    );
  }

  function renderVariants() {
    setChildren(variantsEl, 
      variants.map((variant, index) =>
        h(
          'div',
          { class: 'row nowrap' },
          h('input', { type: 'text', value: variant.label, 'aria-label': 'ボタンの文言', oninput: (event) => { variant.label = event.target.value; } }),
          h('button', { class: 'btn btn-ghost btn-sm danger', type: 'button', onclick: () => { variants.splice(index, 1); renderVariants(); } }, '削除'),
        ),
      ),
    );
  }
  renderGroups();
  renderVariants();

  const optionsSection = section({
    id: 'site-options',
    title: 'リクエストフォームの選択肢',
    lead: 'リクエストページの「えらぶだけでもOK」に並ぶ選択肢です。いちばん上のグループは「お題ガチャ」で必ず1つ選ばれます。',
    body: h(
      'div',
      null,
      groupsEl,
      h(
        'button',
        { class: 'btn btn-ghost btn-sm', type: 'button', id: 'group-add', onclick: () => { groups.push({ id: newId('g'), label: '新しいグループ', options: [] }); renderGroups(); } },
        '＋ グループを追加',
      ),
      h('h3', null, '作品ページの「この子の別バージョンをリクエスト」ボタン'),
      variantsEl,
      h(
        'button',
        { class: 'btn btn-ghost btn-sm', type: 'button', id: 'variant-add', onclick: () => { variants.push({ id: newId('v'), label: '' }); renderVariants(); variantsEl.lastElementChild?.querySelector('input')?.focus(); } },
        '＋ ボタンを追加',
      ),
    ),
    read: () => ({
      groups: groups.map((group) => ({ id: group.id, label: group.label.trim(), options: group.options })),
      variants: variants.map((variant) => ({ id: variant.id, label: variant.label.trim() })),
    }),
    save: (value) => api.put('/api/site/request-options', { requestOptions: value }),
  });

  // ---- 有償依頼 -----------------------------------------------------------------

  const DEFAULT_MESSAGE = { true: '受付中', false: '現在受付していません' };
  const openInput = h('input', { type: 'checkbox', id: 'commission-open', checked: data.commission.open });
  const messageInput = h('input', { type: 'text', id: 'commission-message', value: data.commission.message, maxLength: 40 });
  const nextInput = h('input', { type: 'text', id: 'commission-next', value: data.commission.next_update, placeholder: '例: 2027-01-01（空欄なら表示しません）' });
  // 受付を切り替えたとき、文言が既定のままなら合わせて切り替える
  openInput.addEventListener('change', () => {
    if (messageInput.value.trim() === DEFAULT_MESSAGE[String(!openInput.checked)]) messageInput.value = DEFAULT_MESSAGE[String(openInput.checked)];
  });

  const commissionSection = section({
    id: 'site-commission',
    title: '有償依頼の受付',
    lead: 'Commission ページとトップページに表示されます。料金メニューなどは data/commission.json を直接編集します。',
    body: h(
      'div',
      null,
      h('label', { class: 'check' }, openInput, h('span', null, '有償依頼を受け付ける')),
      h('div', { class: 'grid-2' }, field('表示する文言', messageInput), field('次回更新', nextInput, { optional: true })),
    ),
    read: () => ({ open: openInput.checked, message: messageInput.value.trim(), next_update: nextInput.value.trim() }),
    save: (value) => api.put('/api/site/commission', value),
  });

  setDirtyCheck(() => dirtyChecks.some((check) => check()));

  setChildren(root, 
    h('div', { class: 'page-head' }, h('h1', null, 'サイト'), h('p', { class: 'muted' }, 'サイトに出る文章と設定。保存した内容は「公開」するまでサイトには出ません。')),
    h('div', { class: 'stack' }, notesSection, optionsSection, commissionSection),
  );
  return {};
}
