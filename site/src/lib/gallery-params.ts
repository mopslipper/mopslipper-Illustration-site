/**
 * ギャラリーの絞り込み条件と URL パラメータの相互変換（純粋ロジック）。
 * gallery.html?tag=ネコミミ&category=Original&q=猫&r15=1&page=2
 */

export interface GalleryFilter {
  category: string;
  tag: string;
  query: string;
  r15Only: boolean;
  page: number;
}

export const EMPTY_FILTER: GalleryFilter = { category: '', tag: '', query: '', r15Only: false, page: 1 };

export function parseGalleryParams(search: string, categories: readonly string[]): GalleryFilter {
  const params = new URLSearchParams(search);
  const category = params.get('category') ?? '';
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    category: categories.includes(category) ? category : '',
    tag: (params.get('tag') ?? '').trim(),
    query: (params.get('q') ?? '').trim(),
    r15Only: params.get('r15') === '1',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** 既定値は URL に出さない。何も絞っていなければ空文字 */
export function serializeGalleryParams(filter: GalleryFilter): string {
  const params = new URLSearchParams();
  if (filter.category) params.set('category', filter.category);
  if (filter.tag) params.set('tag', filter.tag);
  if (filter.query) params.set('q', filter.query);
  if (filter.r15Only) params.set('r15', '1');
  if (filter.page > 1) params.set('page', String(filter.page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export interface GalleryItem {
  category: string;
  tags: string[];
  title: string;
  description: string;
  sensitive: boolean;
}

export function matchesFilter(item: GalleryItem, filter: GalleryFilter): boolean {
  if (filter.r15Only && !item.sensitive) return false;
  if (filter.category && item.category !== filter.category) return false;
  if (filter.tag && !item.tags.includes(filter.tag)) return false;
  if (filter.query) {
    const haystack = `${item.title} ${item.tags.join(' ')} ${item.description}`.toLowerCase();
    if (!haystack.includes(filter.query.toLowerCase())) return false;
  }
  return true;
}

export function isFiltered(filter: GalleryFilter): boolean {
  return !!(filter.category || filter.tag || filter.query || filter.r15Only);
}
