/**
 * ギャラリーのフィルタ・検索・ページネーション（旧 gallery.js 互換仕様）
 * - カテゴリ単一選択 / R-18のみ / R-15のみ / タグ・タイトル検索(300ms debounce)
 * - 30件/ページ、ページ番号は最大5つ表示
 * - デフォルトでは NSFW(R-18) 作品は非表示
 */
const PER_PAGE = 30;

interface State {
  category: string;
  r18Only: boolean;
  r15Only: boolean;
  query: string;
  page: number;
}

export function initGallery(): void {
  const grid = document.getElementById('works-grid');
  if (!grid) return;

  const cards = [...grid.querySelectorAll<HTMLElement>('.work-card')];
  const paginations = [...document.querySelectorAll<HTMLElement>('[data-pagination]')];
  const resultCount = document.getElementById('result-count')!;
  const noResults = document.getElementById('no-results')!;
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const r18Check = document.getElementById('show-r18') as HTMLInputElement;
  const r15Check = document.getElementById('show-r15') as HTMLInputElement;

  const state: State = { category: '', r18Only: false, r15Only: false, query: '', page: 1 };

  function matches(card: HTMLElement): boolean {
    const { nsfw, sensitive, category, tags, title, description } = card.dataset;

    if (state.r18Only) {
      if (nsfw !== 'true') return false;
    } else if (state.r15Only) {
      if (sensitive !== 'true' || nsfw === 'true') return false;
    } else if (nsfw === 'true') {
      return false; // デフォルトはR-18非表示
    }

    if (state.category && category !== state.category) return false;

    if (state.query) {
      const haystack = `${title ?? ''} ${tags ?? ''} ${description ?? ''}`.toLowerCase();
      if (!haystack.includes(state.query.toLowerCase())) return false;
    }

    return true;
  }

  function render(): void {
    const visible = cards.filter(matches);
    const totalPages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
    state.page = Math.min(state.page, totalPages);

    const start = (state.page - 1) * PER_PAGE;
    const pageSet = new Set(visible.slice(start, start + PER_PAGE));

    for (const card of cards) {
      card.style.display = pageSet.has(card) ? '' : 'none';
    }

    resultCount.textContent = `${visible.length} 件の作品`;
    noResults.hidden = visible.length > 0;
    renderPagination(totalPages, visible.length);
  }

  function renderPagination(totalPages: number, count: number): void {
    for (const pagination of paginations) {
      pagination.innerHTML = '';
      if (count <= PER_PAGE) continue;

      const make = (label: string, page: number, opts: { disabled?: boolean; active?: boolean } = {}) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.disabled = !!opts.disabled;
        if (opts.active) btn.classList.add('active');
        btn.addEventListener('click', () => {
          state.page = page;
          render();
          document.getElementById('works-grid')?.scrollIntoView({ behavior: 'smooth' });
        });
        return btn;
      };

      pagination.appendChild(make('‹', state.page - 1, { disabled: state.page === 1 }));

      const windowStart = Math.max(1, Math.min(state.page - 2, totalPages - 4));
      const windowEnd = Math.min(totalPages, windowStart + 4);
      for (let p = windowStart; p <= windowEnd; p++) {
        pagination.appendChild(make(String(p), p, { active: p === state.page }));
      }

      pagination.appendChild(make('›', state.page + 1, { disabled: state.page === totalPages }));
    }
  }

  // ---- イベント ----
  document.querySelectorAll<HTMLButtonElement>('.cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.category = btn.dataset.category ?? '';
      state.page = 1;
      render();
    });
  });

  r18Check?.addEventListener('change', () => {
    state.r18Only = r18Check.checked;
    if (state.r18Only) {
      r15Check.checked = false;
      state.r15Only = false;
    }
    state.page = 1;
    render();
  });

  r15Check?.addEventListener('change', () => {
    state.r15Only = r15Check.checked;
    if (state.r15Only) {
      r18Check.checked = false;
      state.r18Only = false;
    }
    state.page = 1;
    render();
  });

  let debounceTimer: ReturnType<typeof setTimeout>;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.query = searchInput.value.trim();
      state.page = 1;
      render();
    }, 300);
  });

  document.querySelectorAll<HTMLButtonElement>('.tag-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag ?? '';
      const isActive = btn.classList.contains('active');
      document.querySelectorAll('.tag-btn').forEach((b) => b.classList.remove('active'));
      if (!isActive) btn.classList.add('active');
      state.query = isActive ? '' : tag;
      if (searchInput) searchInput.value = state.query;
      state.page = 1;
      render();
    });
  });

  render();
}
