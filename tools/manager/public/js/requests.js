/** リクエスト画面: メールの取り込み、進み具合・返信・作業メモの編集、作品との紐付け、X 投稿用の画像 */
import { api } from './api.js';
import { h, setChildren, field, toast, toastError, confirmDialog, setDirtyCheck, formatDate, summarize, busy, snapshot } from './ui.js';

const BLANK = { id: '', status: 'received', public: false, text: '', nickname: '', reply: '', work_slug: '', memo: '' };

export async function renderRequests(root, route, ctx) {
  let data = await api.get('/api/requests');
  let filter = 'all';
  let selected = route.arg;

  const statusLabel = Object.fromEntries(data.statuses);
  const find = (id) => data.requests.find((r) => r.id === id);

  async function reload() {
    data = await api.get('/api/requests');
    ctx.refreshBadges();
  }

  // ---- メールから取り込む -------------------------------------------------------

  const mailText = h('textarea', {
    id: 'mail-text',
    rows: 5,
    placeholder: '届いたメールの本文をここに貼り付けてください（【受付番号】から【以上】まで。メール全体でも大丈夫です）',
  });
  const intakeResult = h('div', { class: 'intake-result', id: 'intake-result', hidden: true });

  function clearIntake() {
    intakeResult.hidden = true;
    setChildren(intakeResult);
  }

  async function readMail(button) {
    if (!mailText.value.trim()) {
      toast('メールの本文を貼り付けてください', 'error');
      return;
    }
    const result = await busy(button, '読み取り中…', () => api.post('/api/requests/parse', { text: mailText.value }));
    if (!result.found) {
      clearIntake();
      toast('【受付番号】R-XXXX が見つかりませんでした。メールの本文（【受付番号】から【以上】まで）を貼り付けてください。', 'error');
      return;
    }

    const request = result.request;
    const add = h('button', { class: 'btn btn-primary', type: 'button', id: 'intake-add' }, 'リクエストのゆくえに追加');
    add.addEventListener('click', async () => {
      try {
        const saved = await busy(add, '追加中…', () => api.post('/api/requests', request));
        mailText.value = '';
        clearIntake();
        await reload();
        toast(`${saved.id} を追加しました`);
        ctx.navigate(`#requests/${saved.id}`);
      } catch (error) {
        toastError(error);
      }
    });

    setChildren(intakeResult, 
      h(
        'div',
        { class: 'intake-head' },
        h('strong', { class: 'receipt' }, request.id),
        h('span', { class: `consent ${result.publishOk ? 'consent-ok' : 'consent-no'}` }, result.publishOk ? 'サイト掲載OK' : '掲載しない'),
        request.nickname ? h('span', { class: 'muted' }, `${request.nickname} さん`) : null,
      ),
      h('p', { class: 'request-text' }, request.text || '（内容を読み取れませんでした）'),
      result.publishOk
        ? request.public
          ? null
          : h('p', { class: 'note' }, '内容を読み取れなかったため、受付番号と進み具合だけを載せます。')
        : h('p', { class: 'note' }, '「掲載しない」のリクエストです。内容はこの PC の中だけに保存し、サイトには受付番号と進み具合だけを載せます。'),
      result.duplicate
        ? h(
            'div',
            { class: 'row' },
            h('span', { class: 'note' }, 'この受付番号はすでに登録されています。'),
            h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => ctx.navigate(`#requests/${request.id}`) }, '開く'),
          )
        : h('div', { class: 'row' }, add, h('button', { class: 'btn btn-ghost', type: 'button', onclick: clearIntake }, 'やめる')),
    );
    intakeResult.hidden = false;
  }

  const readButton = h('button', { class: 'btn btn-primary', type: 'button', id: 'intake-read' }, '読み取る');
  readButton.addEventListener('click', () => readMail(readButton).catch(toastError));

  const intake = h(
    'section',
    { class: 'card intake' },
    h('h2', null, 'メールから取り込む'),
    mailText,
    h(
      'div',
      { class: 'row' },
      readButton,
      h('button', { class: 'btn btn-ghost', type: 'button', id: 'manual-add', onclick: () => ctx.navigate('#requests/new') }, '手入力で追加（X の DM など）'),
    ),
    intakeResult,
  );

  // ---- 一覧 ---------------------------------------------------------------------

  const filtersEl = h('div', { class: 'filters', id: 'request-filters' });
  const listEl = h('ul', { class: 'item-list', id: 'request-list' });
  const detailEl = h('section', { class: 'detail', id: 'request-detail' });

  function renderList() {
    const count = (status) => data.requests.filter((r) => r.status === status).length;
    const chip = (key, label, n) =>
      h(
        'button',
        {
          class: `chip${filter === key ? ' active' : ''}`,
          type: 'button',
          'aria-pressed': String(filter === key),
          onclick: () => {
            filter = key;
            renderList();
          },
        },
        `${label} ${n}`,
      );
    setChildren(filtersEl, 
      chip('all', 'すべて', data.requests.length),
      data.statuses.map(([status, label]) => chip(status, label, count(status))),
    );

    const items = data.requests
      .filter((r) => filter === 'all' || r.status === filter)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    setChildren(listEl, 
      items.length === 0
        ? h('li', { class: 'empty' }, data.requests.length === 0 ? 'まだリクエストはありません。' : 'この状態のリクエストはありません。')
        : items.map((r) =>
            h(
              'li',
              null,
              h(
                'a',
                { class: `item${r.id === selected ? ' active' : ''}`, href: `#requests/${r.id}`, dataset: { id: r.id } },
                h(
                  'span',
                  { class: 'item-top' },
                  h('span', { class: 'status-pill', dataset: { status: r.status } }, statusLabel[r.status]),
                  h('strong', null, r.id),
                  h('span', { class: 'muted' }, formatDate(r.date)),
                  r.public ? null : h('span', { class: 'lock', title: '内容はこの PC だけに保存' }, '非公開'),
                ),
                h('span', { class: 'item-text' }, summarize(r.text) || '（内容なし）'),
              ),
            ),
          ),
    );
  }

  // ---- 詳細 ---------------------------------------------------------------------

  function renderDetail() {
    setDirtyCheck(null);
    if (!selected) {
      setChildren(detailEl, h('p', { class: 'placeholder' }, '左の一覧からリクエストを選ぶか、上の欄にメールを貼り付けて取り込んでください。'));
      return;
    }
    const isNew = selected === 'new';
    const original = isNew ? { ...BLANK, date: data.today } : find(selected);
    if (!original) {
      setChildren(detailEl, h('p', { class: 'placeholder' }, `${selected} は見つかりませんでした。`));
      return;
    }

    const idInput = h('input', { type: 'text', value: original.id, placeholder: '空欄なら自動で付けます', maxLength: 10 });
    const dateInput = h('input', { type: 'date', value: original.date, required: true });
    const statusInputs = data.statuses.map(([status, label]) =>
      h(
        'label',
        { class: 'seg' },
        h('input', { type: 'radio', name: 'request-status', value: status, checked: original.status === status }),
        h('span', { class: 'status-pill', dataset: { status } }, label),
      ),
    );
    const textInput = h('textarea', { rows: 7, value: original.text, id: 'request-text' });
    const publicInput = h('input', { type: 'checkbox', checked: original.public, id: 'request-public' });
    const privacyNote = h('p', { class: 'note' });
    const nicknameInput = h('input', { type: 'text', value: original.nickname, maxLength: 40 });
    const replyInput = h('textarea', { rows: 2, value: original.reply, id: 'request-reply' });
    const memoInput = h('textarea', { rows: 3, value: original.memo, id: 'request-memo' });
    const workSelect = h(
      'select',
      { id: 'request-work' },
      h('option', { value: '' }, '（まだありません）'),
      data.works.map((w) => h('option', { value: w.slug, selected: w.slug === original.work_slug }, `#${w.id} ${w.title}${w.hidden ? '（非表示）' : ''}`)),
    );

    const currentStatus = () => statusInputs.map((label) => label.querySelector('input')).find((input) => input.checked)?.value ?? '';
    const read = () => ({
      id: isNew ? idInput.value.trim().toUpperCase() : original.id,
      date: dateInput.value,
      status: currentStatus(),
      public: publicInput.checked,
      text: textInput.value,
      nickname: nicknameInput.value,
      reply: replyInput.value,
      work_slug: workSelect.value,
      memo: memoInput.value,
    });
    const initial = snapshot(read());
    setDirtyCheck(() => snapshot(read()) !== initial);

    const updatePrivacy = () => {
      privacyNote.textContent = publicInput.checked
        ? '内容とニックネームが「リクエストのゆくえ」に表示されます。'
        : '内容とニックネームはこの PC の中だけに保存され、公開されません。サイトには受付番号と進み具合だけが載ります。';
      privacyNote.classList.toggle('note-public', publicInput.checked);
    };
    publicInput.addEventListener('change', updatePrivacy);
    updatePrivacy();

    // 作品を選んだら、進み具合も「できました」にそろえる
    workSelect.addEventListener('change', () => {
      const done = statusInputs.map((label) => label.querySelector('input')).find((input) => input.value === 'done');
      if (workSelect.value && done && !done.checked) {
        done.checked = true;
        toast('進み具合を「できました」にしました');
      }
    });

    const saveButton = h('button', { class: 'btn btn-primary', type: 'submit', id: 'request-save' }, isNew ? '追加する' : '保存する');

    async function save() {
      const value = read();
      if (value.public && !original.public) {
        const ok = await confirmDialog({
          title: '内容をサイトに載せます',
          message: '送り主から「サイト掲載OK」をもらっていますか？ 載せた内容は誰でも読めるようになります。',
          okLabel: '載せる',
        });
        if (!ok) return;
      }
      const saved = await busy(saveButton, '保存中…', () =>
        isNew ? api.post('/api/requests', value) : api.put(`/api/requests/${encodeURIComponent(original.id)}`, value),
      );
      setDirtyCheck(null);
      await reload();
      selected = saved.id;
      ctx.replace(`#requests/${saved.id}`);
      renderList();
      renderDetail();
      toast(isNew ? `${saved.id} を追加しました` : '保存しました');
    }

    async function remove() {
      const ok = await confirmDialog({
        title: `${original.id} を削除します`,
        message: '「リクエストのゆくえ」から消え、この PC に保存した内容・メモも削除されます。元に戻せません。',
        okLabel: '削除する',
        danger: true,
      });
      if (!ok) return;
      await api.delete(`/api/requests/${encodeURIComponent(original.id)}`);
      setDirtyCheck(null);
      await reload();
      selected = '';
      ctx.replace('#requests');
      renderList();
      renderDetail();
      toast(`${original.id} を削除しました`);
    }

    const formEl = h(
      'form',
      { class: 'card form', id: 'request-form', novalidate: true },
      h(
        'div',
        { class: 'form-head' },
        h('h2', null, isNew ? '手入力で追加' : original.id),
        isNew ? null : h('button', { class: 'btn btn-ghost btn-sm danger', type: 'button', id: 'request-delete', onclick: () => remove().catch(toastError) }, '削除'),
      ),
      h(
        'div',
        { class: 'grid-2' },
        isNew ? field('受付番号', idInput, { hint: '例: R-7K2M。メールに書かれた番号があれば入力します。' }) : null,
        field('受け取った日', dateInput),
      ),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, '進み具合'), h('div', { class: 'segs', id: 'request-status' }, statusInputs)),
      field('リクエスト内容', textInput),
      h('label', { class: 'check' }, publicInput, h('span', null, '内容をサイトに載せる', h('small', null, '（送り主が「サイト掲載OK」のときだけ）'))),
      privacyNote,
      field('ニックネーム', nicknameInput, { optional: true }),
      field('作者の返信', replyInput, { optional: true, hint: '「リクエストのゆくえ」に表示されます。' }),
      field('作業メモ', memoInput, { optional: true, hint: 'この PC の中だけに保存されます（公開されません）。' }),
      h(
        'div',
        { class: 'field' },
        h('span', { class: 'field-label' }, 'できあがった作品'),
        h(
          'div',
          { class: 'row' },
          workSelect,
          isNew
            ? null
            : original.work_slug
              ? h('a', { class: 'btn btn-ghost btn-sm', href: `#works/${data.works.find((w) => w.slug === original.work_slug)?.id ?? ''}` }, '作品を開く')
              : h('a', { class: 'btn btn-outline btn-sm', id: 'request-create-work', href: `#works/new?request=${encodeURIComponent(original.id)}` }, 'このリクエストから作品を登録'),
        ),
        h('span', { class: 'hint' }, '作品を選ぶと、サイトで作品とリクエストが相互にリンクされます。'),
      ),
      h('div', { class: 'row end' }, saveButton),
    );
    formEl.addEventListener('submit', (event) => {
      event.preventDefault();
      save().catch(toastError);
    });

    setChildren(detailEl, formEl, isNew ? null : buildImageTool(original, ctx));
  }

  setChildren(root, 
    h(
      'div',
      { class: 'page-head' },
      h('h1', null, 'リクエスト'),
      h('p', { class: 'muted' }, '届いたリクエストを取り込み、進み具合を「リクエストのゆくえ」に反映します。リクエストは自動では載りません。'),
    ),
    intake,
    h('div', { class: 'split' }, h('aside', { class: 'side' }, filtersEl, listEl), detailEl),
  );
  renderList();
  renderDetail();

  return {
    async select(arg) {
      selected = arg;
      renderList();
      renderDetail();
      if (arg) detailEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
  };
}

/** X 投稿用の画像（マシュマロ風 PNG）を作る折りたたみ */
function buildImageTool(request, ctx) {
  const textInput = h('textarea', { rows: 4, value: request.text, id: 'image-text' });
  const canvas = h('canvas', { class: 'image-canvas', id: 'image-canvas', width: 1200, height: 630 });
  const status = h('p', { class: 'hint', id: 'image-status' });
  const download = h('button', { class: 'btn btn-outline', type: 'button', id: 'image-download' }, 'PNG を保存');
  let marshmallow;
  let timer;

  async function draw() {
    marshmallow ??= await import('./marshmallow.js');
    const text = textInput.value.trim();
    const fit = await marshmallow.renderMarshmallow(canvas, text || '（リクエスト内容を入力してください）', { siteName: ctx.boot.siteName });
    status.textContent = fit.truncated ? '文章が長いため、途中で省略されています。' : `文字の大きさ ${fit.fontSize}px・${fit.lines.length} 行`;
    download.disabled = !text;
  }

  textInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => draw().catch(toastError), 250);
  });

  download.addEventListener('click', async () => {
    try {
      await draw();
      const blob = await marshmallow.canvasToPngBlob(canvas);
      const link = h('a', { href: URL.createObjectURL(blob), download: `request-${request.id}.png` });
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) {
      toastError(error);
    }
  });

  const details = h(
    'details',
    { class: 'card tool', id: 'image-tool' },
    h('summary', null, 'X 投稿用の画像を作る'),
    h('p', { class: 'hint' }, 'リクエスト文を 1200×630 の画像にします。文章はここで書き換えられます（保存したリクエストは変わりません）。'),
    request.public ? null : h('p', { class: 'note' }, 'このリクエストは「掲載しない」です。画像にして投稿してよいか、送り主に確認してください。'),
    textInput,
    canvas,
    status,
    h('div', { class: 'row end' }, download),
  );
  details.addEventListener('toggle', () => {
    if (details.open) draw().catch(toastError);
  });
  return details;
}
