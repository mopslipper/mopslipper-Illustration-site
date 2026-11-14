/**
 * ギャラリーの絞り込み・検索・ページ送り。
 * - カテゴリ / タグ / 検索(300ms debounce) / R-15のみ を URL と同期（共有・ブックマーク可能）
 * - 30件/ページ、ページ番号は最大5つ表示
 * - R-15 作品は絞り込まなくても通常どおり表示する
 */
import {
  parseGalleryParams,
  serializeGalleryParams,
  matchesFilter,
  isFiltered,
  type GalleryFilter,
  type GalleryItem,
} from '../lib/gallery-params';

const PER_PAGE = 30;

export function initGallery(): void {
  const grid = document.getElementById('works-grid');
  if (!grid) return;

  const cards = [...grid.querySelectorAll<HTMLElement>('.work-card')];
  const items = new Map<HTMLElement, GalleryItem>(
    cards.map((card) => [
      card,
      {
        category: card.dataset.category ?? '',
        tags: (card.dataset.tags ?? '').split(',').filter(Boolean),
        title: card.dataset.title ?? '',
        description: card.dataset.description ?? '',
        sensitive: card.dataset.sensitive === 'true',
      },
    ]),
  );

  const categoryBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-category-btn]')];
  const tagBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-tag-btn]')];
  const paginations = [...document.querySelectorAll<HTMLElement>('[data-pagination]')];
  const resultCount = document.getElementById('result-count')!;
  const activeFilters = document.getElementById('active-filters')!;
  const noResults = document.getElementById('no-results')!;
  const noResultsLink = document.getElementById('no-results-request') as HTMLAnchorElement | null;
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const r15Check = document.getElementById('show-r15') as HTMLInputElement | null;
  const clearBtn = document.getElementById('clear-filters') as HTMLButtonElement;
  const drawer = document.getElementById('filter-drawer') as HTMLDetailsElement | null;

  const categories = categoryBtns.map((btn) => btn.dataset.categoryBtn ?? '').filter(Boolean);
  const state: GalleryFilter = parseGalleryParams(location.search, categories);

  function syncControls(): void {
    categoryBtns.forEach((btn) => {
      const active = (btn.dataset.categoryBtn ?? '') === state.category;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    tagBtns.forEach((btn) => {
      const active = btn.dataset.tagBtn === state.tag;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    if (searchInput.value.trim() !== state.query) searchInput.value = state.query;
    if (r15Check) r15Check.checked = state.r15Only;
  }

  function describeFilters(): string {
    const parts: string[] = [];
    if (state.category) parts.push(state.category);
    if (state.tag) parts.push(`#${state.tag}`);
    if (state.query) parts.push(`「${state.query}」`);
    if (state.r15Only) parts.push('R-15のみ');
    return parts.join(' / ');
  }

  function render(): void {
    const visible = cards.filter((card) => matchesFilter(items.get(card)!, state));
    const totalPages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
    state.page = Math.min(state.page, totalPages);

    const start = (state.page - 1) * PER_PAGE;
    const pageSet = new Set(visible.slice(start, start + PER_PAGE));
    for (const card of cards) card.hidden = !pageSet.has(card);

    const filtered = isFiltered(state);
    resultCount.textContent = `${visible.length} 件`;
    activeFilters.textContent = filtered ? describeFilters() : 'すべての作品';
    clearBtn.hidden = !filtered;
    noResults.hidden = visible.length > 0;
    if (noResultsLink) {
      // 探していたものを、そのままリクエストの自由記入欄に引き継ぐ
      const wanted = [state.tag, state.query].filter(Boolean).join(' ');
      const base = noResultsLink.dataset.base ?? noResultsLink.href;
      noResultsLink.href = wanted ? `${base}?text=${encodeURIComponent(wanted)}` : base;
    }

    renderPagination(totalPages, visible.length);
    syncControls();
    history.replaceState(null, '', `${location.pathname}${serializeGalleryParams(state)}`);
  }

  function renderPagination(totalPages: number, count: number): void {
    for (const pagination of paginations) {
      pagination.replaceChildren();
      if (count <= PER_PAGE) continue;

      const make = (label: string, page: number, opts: { disabled?: boolean; active?: boolean; name?: string } = {}) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.disabled = !!opts.disabled;
        if (opts.name) btn.setAttribute('aria-label', opts.name);
        if (opts.active) {
          btn.classList.add('active');
          btn.setAttribute('aria-current', 'page');
        }
        btn.addEventListener('click', () => {
          state.page = page;
          render();
          document.getElementById('gallery-main')?.scrollIntoView({ behavior: 'smooth' });
        });
        return btn;
      };

      pagination.appendChild(make('‹', state.page - 1, { disabled: state.page === 1, name: '前のページ' }));

      const windowStart = Math.max(1, Math.min(state.page - 2, totalPages - 4));
      const windowEnd = Math.min(totalPages, windowStart + 4);
      for (let p = windowStart; p <= windowEnd; p++) {
        pagination.appendChild(make(String(p), p, { active: p === state.page, name: `${p}ページ目` }));
      }

      pagination.appendChild(make('›', state.page + 1, { disabled: state.page === totalPages, name: '次のページ' }));
    }
  }

  function update(patch: Partial<GalleryFilter>): void {
    Object.assign(state, patch, { page: 1 });
    render();
  }

  // ---- イベント ----
  categoryBtns.forEach((btn) => {
    btn.addEventListener('click', () => update({ category: btn.dataset.categoryBtn ?? '' }));
  });

  tagBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tagBtn ?? '';
      update({ tag: state.tag === tag ? '' : tag });
    });
  });

  // カード内のタグは、ページ遷移せずその場で絞り込む
  grid.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest<HTMLElement>('[data-tag-link]');
    if (!link) return;
    e.preventDefault();
    update({ tag: link.dataset.tagLink ?? '' });
    document.getElementById('gallery-main')?.scrollIntoView({ behavior: 'smooth' });
  });

  r15Check?.addEventListener('change', () => update({ r15Only: r15Check.checked }));

  let debounceTimer: ReturnType<typeof setTimeout>;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => update({ query: searchInput.value.trim() }), 300);
  });

  clearBtn.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    update({ category: '', tag: '', query: '', r15Only: false });
  });

  // 絞り込みパネル: 広い画面では常に開き、狭い画面では折りたたむ
  if (drawer) {
    const wide = matchMedia('(min-width: 801px)');
    const syncDrawer = () => {
      drawer.open = wide.matches;
    };
    syncDrawer();
    wide.addEventListener('change', syncDrawer);
  }

  render();
}
