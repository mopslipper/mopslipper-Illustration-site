/** 管理画面の入口: タブの切り替えと、画面ごとの表示 */
import { api } from './api.js';
import { h, setChildren, canLeave, setDirtyCheck } from './ui.js';
import { renderRequests } from './requests.js';
import { renderWorks } from './works.js';
import { renderSite } from './site.js';
import { renderPublish } from './publish.js';

const VIEWS = { requests: renderRequests, works: renderWorks, site: renderSite, publish: renderPublish };
const view = document.getElementById('view');

let mounted = { tab: '', controller: null };
let currentHash = location.hash;
let restoring = false;

/** "#works/145?request=R-7K2M" → { tab: 'works', arg: '145', params } */
function parseHash(hash) {
  const [pathPart, query = ''] = hash.replace(/^#/, '').split('?');
  const [tab, ...rest] = pathPart.split('/');
  let arg = '';
  try {
    arg = decodeURIComponent(rest.join('/'));
  } catch {
    arg = '';
  }
  return { tab: Object.hasOwn(VIEWS, tab) ? tab : 'requests', arg, params: new URLSearchParams(query) };
}

const ctx = {
  boot: null,
  /** 画面を移動する（未保存の変更があれば確認が出る） */
  navigate(hash) {
    if (location.hash === hash) show();
    else location.hash = hash;
  },
  /** 確認なしでアドレスだけ書き換える（保存直後など） */
  replace(hash) {
    currentHash = hash;
    history.replaceState(null, '', hash);
  },
  refreshBadges,
};

function setBadge(id, count) {
  const badge = document.getElementById(id);
  badge.hidden = !count;
  badge.textContent = typeof count === 'number' && count > 99 ? '99+' : count ? String(count) : '';
}

/** タブの数字: まだ手を付けていないリクエスト / 公開していない変更 */
async function refreshBadges() {
  try {
    const [requests, publish] = await Promise.all([api.get('/api/requests'), api.get('/api/publish')]);
    setBadge('tab-count-requests', requests.requests.filter((r) => r.status === 'received').length);
    setBadge('tab-count-publish', publish.changes.length || (publish.unpushed ? '!' : 0));
  } catch {
    /* 数字が出せなくても操作はできる */
  }
}

async function refreshPreviewLink() {
  const link = document.getElementById('preview-link');
  try {
    const preview = await api.get('/api/preview');
    link.hidden = !preview.running;
    link.href = preview.url;
    ctx.preview = preview;
  } catch {
    link.hidden = true;
  }
}

async function show() {
  const route = parseHash(location.hash);
  for (const tab of document.querySelectorAll('.tabs a')) {
    const active = tab.dataset.tab === route.tab;
    tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }

  // 同じ画面の中の移動（一覧から別の項目を選ぶなど）は、画面を作り直さない
  if (mounted.tab === route.tab && mounted.controller?.select) {
    await mounted.controller.select(route.arg, route.params);
    return;
  }

  setDirtyCheck(null);
  mounted = { tab: '', controller: null };
  setChildren(view, h('p', { class: 'loading' }, '読み込み中…'));
  try {
    const controller = await VIEWS[route.tab](view, route, ctx);
    mounted = { tab: route.tab, controller };
  } catch (error) {
    setChildren(view, 
      h(
        'div',
        { class: 'card error-card' },
        h('h2', null, '読み込めませんでした'),
        h('p', null, error?.message ?? String(error)),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: show }, 'もう一度読み込む'),
      ),
    );
  }
}

window.addEventListener('hashchange', async () => {
  if (restoring) {
    restoring = false;
    return;
  }
  if (location.hash === currentHash) return;
  if (!(await canLeave())) {
    restoring = true;
    location.hash = currentHash;
    return;
  }
  currentHash = location.hash;
  await show();
  refreshPreviewLink();
});

async function start() {
  try {
    ctx.boot = await api.get('/api/bootstrap');
    document.getElementById('site-name').textContent = ctx.boot.siteName;
    document.title = `${ctx.boot.siteName} 管理ツール`;
  } catch (error) {
    setChildren(view, h('div', { class: 'card error-card' }, h('h2', null, '管理ツールを開始できませんでした'), h('p', null, error.message)));
    return;
  }
  if (!location.hash) ctx.replace('#requests');
  await show();
  refreshBadges();
  refreshPreviewLink();
}

start();
