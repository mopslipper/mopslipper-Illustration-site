/** 作品画面: 一覧、登録・編集フォーム、画像のドラッグ＆ドロップ、タグ、AI 説明文、リクエストとの紐付け */
import { api, uploadFile, previewUrl, mediaUrl } from './api.js';
import { h, setChildren, field, toast, toastError, confirmDialog, setDirtyCheck, formatDate, summarize, busy, snapshot } from './ui.js';

const VIDEO = /\.(mp4|mov|webm)$/i;
const IMAGE_ACCEPT = '.webp,.jpg,.jpeg,.png,.gif';
const MAIN_ACCEPT = `${IMAGE_ACCEPT},.mp4,.mov,.webm`;

export async function renderWorks(root, route, ctx) {
  let [data, requestData, ai] = await Promise.all([api.get('/api/works'), api.get('/api/requests'), api.get('/api/ai')]);
  let selected = route.arg;
  let params = route.params;
  const filters = { query: '', category: '', r15: false, hidden: false };
  let bust = 0;

  async function reload() {
    [data, requestData] = await Promise.all([api.get('/api/works'), api.get('/api/requests')]);
    ctx.refreshBadges();
  }

  const findRequest = (id) => requestData.requests.find((r) => r.id === id);
  const statusLabel = Object.fromEntries(requestData.statuses);

  // ---- 一覧 ---------------------------------------------------------------------

  const searchInput = h('input', { type: 'search', id: 'work-search', placeholder: 'タイトル・タグ・ID で検索', autocomplete: 'off' });
  const categorySelect = h(
    'select',
    { id: 'work-category-filter', 'aria-label': 'カテゴリで絞り込み' },
    h('option', { value: '' }, 'すべてのカテゴリ'),
    data.categories.map((category) => h('option', { value: category }, category)),
  );
  const r15Check = h('input', { type: 'checkbox', id: 'work-r15-filter' });
  const hiddenCheck = h('input', { type: 'checkbox', id: 'work-hidden-filter' });
  const countEl = h('p', { class: 'muted small', id: 'work-count' });
  const listEl = h('ul', { class: 'item-list work-list', id: 'work-list' });
  const detailEl = h('section', { class: 'detail', id: 'work-detail' });

  function renderList() {
    const query = filters.query.toLowerCase();
    const items = data.works.filter((work) => {
      if (filters.category && work.category !== filters.category) return false;
      if (filters.r15 && !work.sensitive) return false;
      if (filters.hidden && !work.hidden) return false;
      if (!query) return true;
      return `${work.id} ${work.slug} ${work.title} ${work.tags.join(' ')}`.toLowerCase().includes(query);
    });
    countEl.textContent = `${items.length} / ${data.works.length} 件`;
    setChildren(listEl, 
      items.length === 0
        ? h('li', { class: 'empty' }, '該当する作品がありません。')
        : items.map((work) =>
            h(
              'li',
              null,
              h(
                'a',
                { class: `item work-item${String(work.id) === selected ? ' active' : ''}`, href: `#works/${work.id}`, dataset: { id: work.id } },
                VIDEO.test(work.thumbnail) || !work.thumbnail
                  ? h('span', { class: 'thumb thumb-none' }, '▶')
                  : h('img', { class: 'thumb', src: previewUrl(work.thumbnail, 96), alt: '', loading: 'lazy', width: 48, height: 48 }),
                h(
                  'span',
                  { class: 'item-body' },
                  h('strong', { class: 'item-title' }, work.title),
                  h(
                    'span',
                    { class: 'item-top' },
                    h('span', { class: 'muted' }, `#${work.id} ・ ${formatDate(work.date)}`),
                    work.sensitive ? h('span', { class: 'mark' }, 'R-15') : null,
                    work.hidden ? h('span', { class: 'mark mark-off' }, '非表示') : null,
                    work.nsfw ? h('span', { class: 'mark mark-off' }, 'R-18') : null,
                    work.request_ids.length ? h('span', { class: 'mark mark-request' }, 'リクエスト') : null,
                  ),
                ),
              ),
            ),
          ),
    );
  }

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filters.query = searchInput.value.trim();
      renderList();
    }, 200);
  });
  categorySelect.addEventListener('change', () => {
    filters.category = categorySelect.value;
    renderList();
  });
  r15Check.addEventListener('change', () => {
    filters.r15 = r15Check.checked;
    renderList();
  });
  hiddenCheck.addEventListener('change', () => {
    filters.hidden = hiddenCheck.checked;
    renderList();
  });

  // ---- フォーム -----------------------------------------------------------------

  function renderDetail() {
    setDirtyCheck(null);
    if (!selected) {
      setChildren(detailEl, h('p', { class: 'placeholder' }, '左の一覧から作品を選ぶか、「新しい作品」で登録をはじめてください。'));
      return;
    }
    const isNew = selected === 'new';
    const original = isNew
      ? {
          id: data.nextId, slug: '', title: '', date: data.today, category: 'Original', image_path: '', thumbnail: '', x_thumbnail: '',
          additional_images: [], additional_images_per_row: 1, tags: [], description: '', sensitive: false, hidden: false, hide_sensitive_thumbnail_on_x: false,
          ai_directives: ai.defaults, nsfw: false, external_links: {},
          request_ids: params.get('request') && findRequest(params.get('request')) ? [params.get('request')] : [],
        }
      : data.works.find((work) => String(work.id) === selected);
    if (!original) {
      setChildren(detailEl, h('p', { class: 'placeholder' }, `作品 ${selected} は見つかりませんでした。`));
      return;
    }

    // 入力欄で直接は持てない値（ファイルの場所・タグ・紐付け）
    const state = {
      image_path: original.image_path,
      thumbnail: original.thumbnail,
      x_thumbnail: original.x_thumbnail,
      additional_images: [...original.additional_images],
      tags: [...original.tags],
      request_ids: [...original.request_ids],
    };

    const slugInput = h('input', { type: 'text', id: 'work-slug', value: original.slug, placeholder: `例: ${original.id}`, autocomplete: 'off' });
    const titleInput = h('input', { type: 'text', id: 'work-title', value: original.title, autocomplete: 'off' });
    const dateInput = h('input', { type: 'date', id: 'work-date', value: original.date });
    const categoryInput = h(
      'select',
      { id: 'work-category' },
      data.categories.map((category) => h('option', { value: category, selected: category === original.category }, category)),
    );
    const descriptionInput = h('textarea', { rows: 4, id: 'work-description', value: original.description });
    const sensitiveInput = h('input', { type: 'checkbox', id: 'work-sensitive', checked: original.sensitive });
    const hiddenInput = h('input', { type: 'checkbox', id: 'work-hidden', checked: original.hidden });
    const hideOnXInput = h('input', { type: 'checkbox', id: 'work-hide-x', checked: original.hide_sensitive_thumbnail_on_x });
    const perRowSelect = h(
      'select',
      { id: 'work-extra-per-row' },
      [[1, '1枚ずつ（ふつう）'], [2, '2枚ずつ並べる'], [3, '3枚ずつ並べる']].map(([value, label]) =>
        h('option', { value: String(value), selected: value === (original.additional_images_per_row ?? 1) }, label),
      ),
    );

    const imagePathInput = h('input', { type: 'text', id: 'work-image-path', value: state.image_path, autocomplete: 'off' });
    const thumbPathInput = h('input', { type: 'text', id: 'work-thumb-path', value: state.thumbnail, autocomplete: 'off' });
    const xThumbPathInput = h('input', { type: 'text', id: 'work-x-path', value: state.x_thumbnail, placeholder: '未設定なら通常のサムネイルを使います', autocomplete: 'off' });
    imagePathInput.addEventListener('change', () => { state.image_path = imagePathInput.value.trim(); renderMedia(); });
    thumbPathInput.addEventListener('change', () => { state.thumbnail = thumbPathInput.value.trim(); });
    xThumbPathInput.addEventListener('change', () => { state.x_thumbnail = xThumbPathInput.value.trim(); renderXThumb(); });

    // ---- AI への指示 ----
    const directives = { ...original.ai_directives, must_include: [...original.ai_directives.must_include] };
    const toneSelect = h('select', { id: 'ai-tone' }, ai.options.tones.map(([key, label]) => h('option', { value: key }, label)));
    const lengthSelect = h('select', { id: 'ai-length' }, ai.options.lengths.map(([key, label]) => h('option', { value: key }, label)));
    const presetSelect = h('select', { id: 'ai-preset' }, ai.options.presets.map(([key, label]) => h('option', { value: key }, label)));
    const mustChecks = ai.options.mustInclude.map(([key, label]) => ({ key, input: h('input', { type: 'checkbox', value: key }), label }));
    const customInput = h('textarea', { rows: 2, id: 'ai-custom', maxLength: 220, placeholder: '例: ポップで親しみやすく。技法に軽く触れてください。' });
    const applyDirectives = (d) => {
      toneSelect.value = d.tone_preset;
      lengthSelect.value = d.length_rule;
      presetSelect.value = d.instruction_preset;
      for (const { key, input } of mustChecks) input.checked = d.must_include.includes(key);
      customInput.value = d.custom_instruction;
    };
    const readDirectives = () => ({
      tone_preset: toneSelect.value,
      length_rule: lengthSelect.value,
      must_include: mustChecks.filter(({ input }) => input.checked).map(({ key }) => key),
      instruction_preset: presetSelect.value,
      custom_instruction: customInput.value.replace(/\s*\n\s*/g, ' ').trim(),
    });
    applyDirectives(directives);

    const read = () => ({
      id: original.id,
      slug: slugInput.value.trim(),
      title: titleInput.value.trim(),
      date: dateInput.value,
      category: categoryInput.value,
      image_path: state.image_path,
      thumbnail: state.thumbnail,
      x_thumbnail: state.x_thumbnail,
      additional_images: state.additional_images,
      additional_images_per_row: Number(perRowSelect.value),
      tags: state.tags,
      description: descriptionInput.value.trim(),
      sensitive: sensitiveInput.checked,
      hidden: hiddenInput.checked,
      hide_sensitive_thumbnail_on_x: sensitiveInput.checked && hideOnXInput.checked,
      ai_directives: readDirectives(),
    });
    const current = () => snapshot({ form: read(), requestIds: state.request_ids });
    const initial = current();
    setDirtyCheck(() => current() !== initial);

    const confirmOverwrite = (fileName) =>
      confirmDialog({ title: `${fileName} を置き換えます`, message: '同じ名前のファイルがすでにあります。新しいファイルで置き換えますか？', okLabel: '置き換える' });

    async function upload(kind, file) {
      const result = await uploadFile({ workId: original.id, kind, file, onExists: confirmOverwrite });
      if (result) bust++;
      return result;
    }

    // ---- 本体の画像・動画 ----
    const mediaBox = h('div', { class: 'dropzone-preview' });
    const mainFile = h('input', { type: 'file', id: 'work-main-file', accept: MAIN_ACCEPT, hidden: true });
    const dropzone = h(
      'div',
      { class: 'dropzone', id: 'work-dropzone', tabIndex: 0, role: 'button', 'aria-label': '画像・動画を登録' },
      mediaBox,
      h('p', { class: 'dropzone-hint' }, 'ここに画像・動画をドラッグ＆ドロップ、またはクリックして選ぶ'),
      mainFile,
    );

    function renderMedia() {
      imagePathInput.value = state.image_path;
      thumbPathInput.value = state.thumbnail;
      if (!state.image_path) setChildren(mediaBox);
      else if (VIDEO.test(state.image_path)) {
        setChildren(mediaBox, h('video', { src: `${mediaUrl(state.image_path)}?v=${bust}`, controls: true, muted: true, playsInline: true, preload: 'metadata' }));
      } else {
        setChildren(mediaBox, h('img', { src: `${previewUrl(state.image_path, 900, 'inside')}&v=${bust}`, alt: '登録中の画像' }));
      }
      dropzone.classList.toggle('has-media', !!state.image_path);
    }

    async function setMain(file) {
      dropzone.classList.add('busy');
      try {
        const result = await upload('main', file);
        if (!result) return;
        state.image_path = result.path;
        if (result.thumbnail) state.thumbnail = result.thumbnail;
        if (!slugInput.value.trim()) slugInput.value = String(original.id);
        renderMedia();
        if (result.isVideo) toast('動画を登録しました。サムネイル画像も登録してください', 'warn');
        else if (result.thumbnailNote) toast(result.thumbnailNote, 'warn');
        else toast(`${result.fileName} を登録し、サムネイルを作りました`);
      } catch (error) {
        toastError(error);
      } finally {
        dropzone.classList.remove('busy');
      }
    }

    dropzone.addEventListener('click', (event) => {
      if (event.target.closest('video')) return;
      mainFile.click();
    });
    dropzone.addEventListener('keydown', (event) => {
      if (event.target === dropzone && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        mainFile.click();
      }
    });
    mainFile.addEventListener('change', () => {
      if (mainFile.files[0]) setMain(mainFile.files[0]);
      mainFile.value = '';
    });
    for (const type of ['dragenter', 'dragover']) {
      dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        dropzone.classList.add('over');
      });
    }
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
    dropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropzone.classList.remove('over');
      const file = event.dataTransfer?.files?.[0];
      if (file) setMain(file);
    });

    /** 「ファイルを選ぶ」ボタン（サムネイル・X 用・追加画像で共通） */
    function pickButton(label, id, { multiple = false, onFiles }) {
      const input = h('input', { type: 'file', id: `${id}-file`, accept: IMAGE_ACCEPT, multiple, hidden: true });
      input.addEventListener('change', async () => {
        const files = [...input.files];
        input.value = '';
        try {
          await onFiles(files);
        } catch (error) {
          toastError(error);
        }
      });
      return [h('button', { class: 'btn btn-ghost btn-sm', type: 'button', id, onclick: () => input.click() }, label), input];
    }

    // ---- X 用サムネイル ----
    const xThumbBox = h('div', { class: 'mini-preview', id: 'work-x-preview' });
    function renderXThumb() {
      xThumbPathInput.value = state.x_thumbnail;
      setChildren(xThumbBox, 
        state.x_thumbnail ? h('img', { src: `${previewUrl(state.x_thumbnail, 240, 'inside')}&v=${bust}`, alt: 'X 用サムネイル' }) : h('span', { class: 'muted small' }, '未設定'),
      );
    }

    // ---- 追加画像 ----
    const extraList = h('div', { class: 'extra-list', id: 'work-extras' });
    function renderExtras() {
      setChildren(extraList, 
        state.additional_images.length === 0
          ? h('span', { class: 'muted small' }, 'ありません')
          : state.additional_images.map((imagePath, index) =>
              h(
                'div',
                { class: 'extra' },
                h('img', { src: `${previewUrl(imagePath, 160)}&v=${bust}`, alt: `追加画像 ${index + 1}`, loading: 'lazy' }),
                h(
                  'button',
                  {
                    class: 'remove',
                    type: 'button',
                    'aria-label': `追加画像 ${index + 1} を外す`,
                    onclick: () => {
                      state.additional_images.splice(index, 1);
                      renderExtras();
                    },
                  },
                  '×',
                ),
              ),
            ),
      );
    }

    // ---- タグ ----
    const tagChips = h('div', { class: 'tag-chips', id: 'work-tags' });
    const tagSuggest = h('div', { class: 'tag-suggest', id: 'work-tag-suggest' });
    const tagInput = h('input', { type: 'text', id: 'work-tag-input', placeholder: 'タグを入力して Enter', list: 'tag-options', autocomplete: 'off' });
    const tagOptions = h('datalist', { id: 'tag-options' }, data.tags.map((tag) => h('option', { value: tag })));

    function addTag(raw) {
      for (const tag of String(raw).split(/[,、]/).map((t) => t.trim()).filter(Boolean)) {
        if (!state.tags.includes(tag)) state.tags.push(tag);
      }
      renderTags();
    }
    function renderTags() {
      setChildren(tagChips, 
        state.tags.length === 0
          ? h('span', { class: 'muted small' }, 'タグはまだありません')
          : state.tags.map((tag, index) =>
              h(
                'span',
                { class: 'tag' },
                tag,
                h(
                  'button',
                  {
                    type: 'button',
                    'aria-label': `${tag} を外す`,
                    onclick: () => {
                      state.tags.splice(index, 1);
                      renderTags();
                    },
                  },
                  '×',
                ),
              ),
            ),
      );
      setChildren(tagSuggest, 
        data.tags
          .filter((tag) => !state.tags.includes(tag))
          .slice(0, 14)
          .map((tag) => h('button', { class: 'tag tag-add', type: 'button', onclick: () => addTag(tag) }, `+ ${tag}`)),
      );
    }
    tagInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addTag(tagInput.value);
        tagInput.value = '';
      }
    });
    tagInput.addEventListener('change', () => {
      addTag(tagInput.value);
      tagInput.value = '';
    });

    // ---- 元になったリクエスト ----
    const linkedList = h('div', { class: 'linked', id: 'work-requests' });
    const linkSelect = h('select', { id: 'work-request-add', 'aria-label': 'リクエストを紐付ける' });
    function renderLinks() {
      setChildren(linkedList, 
        state.request_ids.length === 0
          ? h('span', { class: 'muted small' }, '紐付いているリクエストはありません')
          : state.request_ids.map((id, index) => {
              const request = findRequest(id);
              return h(
                'div',
                { class: 'linked-item' },
                h('strong', null, id),
                h('span', { class: 'muted' }, summarize(request?.text, 60) || '（内容なし）'),
                h(
                  'button',
                  {
                    class: 'btn btn-ghost btn-sm',
                    type: 'button',
                    onclick: () => {
                      state.request_ids.splice(index, 1);
                      renderLinks();
                    },
                  },
                  '外す',
                ),
              );
            }),
      );
      const candidates = requestData.requests.filter((r) => !state.request_ids.includes(r.id) && (!r.work_slug || r.work_slug === original.slug));
      setChildren(linkSelect, 
        h('option', { value: '' }, candidates.length ? 'リクエストを選んで紐付ける…' : '紐付けられるリクエストはありません'),
        candidates.map((r) => h('option', { value: r.id }, `${r.id}（${statusLabel[r.status]}）${summarize(r.text, 30)}`)),
      );
      linkSelect.disabled = candidates.length === 0;
    }
    linkSelect.addEventListener('change', () => {
      if (linkSelect.value) state.request_ids.push(linkSelect.value);
      renderLinks();
    });

    // ---- AI 説明文 ----
    const aiButton = h('button', { class: 'btn btn-outline btn-sm', type: 'button', id: 'ai-generate', disabled: !ai.available }, 'AI で説明文を生成');
    aiButton.addEventListener('click', async () => {
      try {
        if (descriptionInput.value.trim()) {
          const ok = await confirmDialog({ title: '説明文を作り直します', message: 'いま入力されている説明文は、生成した文章で置き換わります。', okLabel: '置き換える' });
          if (!ok) return;
        }
        const form = read();
        const result = await busy(aiButton, '生成中…', () =>
          api.post('/api/ai/describe', {
            id: original.id, title: form.title, category: form.category, tags: form.tags,
            image_path: form.image_path, thumbnail: form.thumbnail, directives: form.ai_directives,
          }),
        );
        descriptionInput.value = result.description;
        toast(result.usedImage ? '説明文を生成しました' : '説明文を生成しました（画像は送れなかったため、文章の情報だけで作りました）', result.usedImage ? 'ok' : 'warn');
      } catch (error) {
        toastError(error);
      }
    });

    const saveDefaults = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', id: 'ai-save-defaults' }, '全体のデフォルトとして保存');
    saveDefaults.addEventListener('click', async () => {
      try {
        const result = await busy(saveDefaults, '保存中…', () => api.put('/api/ai/defaults', { directives: readDirectives() }));
        ai = { ...ai, defaults: result.defaults };
        toast('AI 説明の全体デフォルトを保存しました');
      } catch (error) {
        toastError(error);
      }
    });

    const aiPanel = h(
      'details',
      { class: 'sub', id: 'ai-panel' },
      h('summary', null, 'AI への指示'),
      ai.available
        ? null
        : h(
            'div',
            { class: 'note', id: 'ai-unavailable' },
            h('p', null, ai.reason),
            h('p', null, '旧フォルダの api_keys.json / ai_config.json をこのフォルダ直下にコピーするか、ひな形を作って API キーを書き込んでください。'),
            h(
              'button',
              {
                class: 'btn btn-ghost btn-sm',
                type: 'button',
                id: 'ai-setup',
                onclick: async () => {
                  try {
                    const result = await api.post('/api/ai/setup');
                    toast(result.created.length ? `${result.created.join(' と ')} を作りました。API キーを書き込んでから、この画面を開き直してください` : '設定ファイルはすでにあります。API キーを書き込んでください', 'warn');
                  } catch (error) {
                    toastError(error);
                  }
                },
              },
              '設定ファイルのひな形を作る',
            ),
          ),
      h('div', { class: 'grid-2' }, field('口調', toneSelect), field('文量', lengthSelect)),
      h(
        'div',
        { class: 'field' },
        h('span', { class: 'field-label' }, '必ず触れる要素'),
        h('div', { class: 'row' }, mustChecks.map(({ input, label }) => h('label', { class: 'check' }, input, h('span', null, label)))),
      ),
      field('口調のプリセット', presetSelect),
      field('追加の指示', customInput, { optional: true }),
      h(
        'div',
        { class: 'row' },
        saveDefaults,
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', id: 'ai-reset', onclick: () => applyDirectives(ai.defaults) }, 'デフォルトに戻す'),
      ),
      h('span', { class: 'hint' }, 'デフォルトと違う指示は、この作品の設定として保存されます。'),
    );

    // ---- 保存・削除 ----
    const saveButton = h('button', { class: 'btn btn-primary', type: 'submit', id: 'work-save' }, isNew ? '登録する' : '保存する');

    async function save() {
      const form = read();
      if (!isNew && form.slug !== original.slug) {
        const ok = await confirmDialog({
          title: 'ページの URL が変わります',
          message: `slug を「${original.slug}」から「${form.slug}」に変えると、X などに貼った古いリンクは開けなくなります。`,
          okLabel: '変更する',
          danger: true,
        });
        if (!ok) return;
      }
      const body = { form, requestIds: state.request_ids };
      const saved = await busy(saveButton, '保存中…', () => (isNew ? api.post('/api/works', body) : api.put(`/api/works/${original.id}`, body)));
      const newlyLinked = state.request_ids.filter((id) => !original.request_ids.includes(id) || isNew);
      setDirtyCheck(null);
      await reload();
      selected = String(saved.id);
      params = new URLSearchParams();
      ctx.replace(`#works/${saved.id}`);
      renderList();
      renderDetail();
      toast(
        `${isNew ? '登録しました' : '保存しました'}${newlyLinked.length ? `（${newlyLinked.join('・')} を「できました」にしました）` : ''}`,
      );
    }

    async function remove() {
      const ok = await confirmDialog({
        title: `「${original.title}」を削除します`,
        message: `作品データを削除します（画像ファイルは static/img/works に残ります）。${original.request_ids.length ? 'リクエストとの紐付けも外れます。' : ''}元に戻せません。`,
        okLabel: '削除する',
        danger: true,
      });
      if (!ok) return;
      await api.delete(`/api/works/${original.id}`);
      setDirtyCheck(null);
      await reload();
      selected = '';
      ctx.replace('#works');
      renderList();
      renderDetail();
      toast('作品を削除しました');
    }

    const links = Object.entries(original.external_links ?? {}).filter(([, url]) => url);
    const siteLink =
      !isNew && ctx.preview?.running && !original.hidden && !original.nsfw
        ? h('a', { class: 'btn btn-ghost btn-sm', href: `${ctx.preview.url}works/${encodeURIComponent(original.slug)}.html`, target: '_blank', rel: 'noopener' }, 'サイトで見る ↗')
        : null;

    const updateHideOnX = () => {
      hideOnXInput.disabled = !sensitiveInput.checked;
      if (!sensitiveInput.checked) hideOnXInput.checked = false;
    };
    sensitiveInput.addEventListener('change', updateHideOnX);
    updateHideOnX();

    const formEl = h(
      'form',
      { class: 'card form', id: 'work-form', novalidate: true },
      h(
        'div',
        { class: 'form-head' },
        h('h2', null, isNew ? `新しい作品（ID ${original.id}）` : `#${original.id} ${original.title}`),
        h(
          'div',
          { class: 'row' },
          siteLink,
          isNew ? null : h('button', { class: 'btn btn-ghost btn-sm danger', type: 'button', id: 'work-delete', onclick: () => remove().catch(toastError) }, '削除'),
        ),
      ),
      original.nsfw ? h('p', { class: 'note' }, 'この作品は R-18 として登録されているため、サイトには掲載されません。') : null,
      isNew && state.request_ids.length
        ? h('p', { class: 'note note-public', id: 'work-from-request' }, `${state.request_ids.join('・')} から登録します。保存すると、リクエストが「できました」になり、作品と相互にリンクされます。`)
        : null,

      dropzone,
      h(
        'div',
        { class: 'grid-2' },
        field('タイトル', titleInput),
        field('slug', slugInput, { hint: 'ページの URL になります（works/〇〇.html）。' }),
        h(
          'div',
          { class: 'field' },
          h('label', { class: 'field-label', for: 'work-date' }, '公開日'),
          h(
            'div',
            { class: 'row nowrap' },
            dateInput,
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { dateInput.value = data.today; } }, '今日'),
          ),
        ),
        field('カテゴリ', categoryInput),
      ),

      h(
        'div',
        { class: 'field' },
        h('label', { class: 'field-label', for: 'work-tag-input' }, 'タグ'),
        tagChips,
        tagInput,
        tagOptions,
        tagSuggest,
      ),

      h(
        'div',
        { class: 'field' },
        h('div', { class: 'row between' }, h('label', { class: 'field-label', for: 'work-description' }, '説明'), aiButton),
        descriptionInput,
        aiPanel,
      ),

      h(
        'fieldset',
        { class: 'group' },
        h('legend', null, '公開の設定'),
        h('label', { class: 'check' }, sensitiveInput, h('span', null, 'R-15（ちょっとセクシー）', h('small', null, 'サイトでは通常どおり表示し、小さな「R-15」の目印が付きます'))),
        h('label', { class: 'check' }, hiddenInput, h('span', null, '非表示', h('small', null, 'ギャラリーにも作品ページにも出しません'))),
      ),

      h(
        'fieldset',
        { class: 'group' },
        h('legend', null, '元になったリクエスト'),
        linkedList,
        linkSelect,
      ),

      h(
        'details',
        { class: 'sub', id: 'work-more', open: state.additional_images.length > 0 || !!state.x_thumbnail || VIDEO.test(state.image_path) },
        h('summary', null, '追加画像・サムネイル・X カード'),
        h(
          'div',
          { class: 'field' },
          h('span', { class: 'field-label' }, '追加画像（複数枚の作品）'),
          extraList,
          h(
            'div',
            { class: 'row' },
            pickButton('追加画像を選ぶ', 'work-extra-add', {
              multiple: true,
              onFiles: async (files) => {
                for (const file of files) {
                  const result = await upload('extra', file);
                  if (result) state.additional_images.push(result.path);
                }
                renderExtras();
              },
            }),
          ),
        ),
        field('追加画像の並べ方', perRowSelect, {
          hint: '縦長の画像（抱き枕カバー風など）向け。作品ページで、追加画像を横に並べて表示します。1枚目（本体の画像）は、これまで通り1枚で表示します。',
        }),
        h(
          'div',
          { class: 'field' },
          h('label', { class: 'field-label', for: 'work-thumb-path' }, 'サムネイル'),
          h(
            'div',
            { class: 'row nowrap' },
            thumbPathInput,
            pickButton('選ぶ', 'work-thumb-add', {
              onFiles: async ([file]) => {
                const result = file && (await upload('thumb', file));
                if (result) {
                  state.thumbnail = result.path;
                  thumbPathInput.value = result.path;
                  toast('サムネイルを登録しました');
                }
              },
            }),
          ),
          h('span', { class: 'hint' }, '画像の作品は自動で作られます。動画の作品は画像を登録してください。'),
        ),
        h(
          'div',
          { class: 'field' },
          h('label', { class: 'field-label', for: 'work-x-path' }, 'X 用サムネイル'),
          xThumbBox,
          h(
            'div',
            { class: 'row nowrap' },
            xThumbPathInput,
            pickButton('選ぶ', 'work-x-add', {
              onFiles: async ([file]) => {
                const result = file && (await upload('x', file));
                if (result) {
                  state.x_thumbnail = result.path;
                  renderXThumb();
                }
              },
            }),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', id: 'work-x-clear', onclick: () => { state.x_thumbnail = ''; renderXThumb(); } }, '外す'),
          ),
          h('span', { class: 'hint' }, 'X に URL を貼ったときに出る画像です。'),
        ),
        h('label', { class: 'check' }, hideOnXInput, h('span', null, 'X ではサムネイルを隠す', h('small', null, 'R-15 の作品だけ設定できます'))),
        field('画像・動画の場所', imagePathInput, { hint: '通常は自動で入ります。static/img/works に置いたファイル名を直接書くこともできます。' }),
      ),

      links.length
        ? h(
            'p',
            { class: 'hint', id: 'work-links' },
            '外部リンク（この画面では編集しません）: ',
            links.map(([name, url], index) => [index ? ' ・ ' : '', h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, name)]),
          )
        : null,

      h('div', { class: 'row end sticky-actions' }, saveButton),
    );
    formEl.addEventListener('submit', (event) => {
      event.preventDefault();
      save().catch(toastError);
    });

    renderMedia();
    renderXThumb();
    renderExtras();
    renderTags();
    renderLinks();
    setChildren(detailEl, formEl);
  }

  setChildren(root, 
    h(
      'div',
      { class: 'page-head' },
      h('h1', null, '作品'),
      h('p', { class: 'muted' }, '作品の登録と編集。保存した内容は「公開」するまでサイトには出ません。'),
    ),
    h(
      'div',
      { class: 'split' },
      h(
        'aside',
        { class: 'side' },
        h('a', { class: 'btn btn-primary block', id: 'work-new', href: '#works/new' }, '＋ 新しい作品'),
        searchInput,
        categorySelect,
        h(
          'div',
          { class: 'row' },
          h('label', { class: 'check' }, r15Check, h('span', null, 'R-15 のみ')),
          h('label', { class: 'check' }, hiddenCheck, h('span', null, '非表示のみ')),
        ),
        countEl,
        listEl,
      ),
      detailEl,
    ),
  );
  renderList();
  renderDetail();

  return {
    async select(arg, nextParams) {
      selected = arg;
      params = nextParams;
      renderList();
      renderDetail();
      if (arg) detailEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
  };
}
