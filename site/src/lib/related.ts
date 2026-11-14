/**
 * 「似た雰囲気の作品」の選定（純粋ロジック）。
 * 共通タグが多いほど、また珍しいタグが一致するほど上位にする。
 */

export interface Relatable {
  slug: string;
  date: string;
  tags: string[];
}

/** ほぼ全作品に付いていて、似ている根拠にならないタグ */
export const GENERIC_TAGS: readonly string[] = ['オリジナル'];

export function relatedWorks<T extends Relatable>(
  target: T,
  all: readonly T[],
  limit = 6,
  ignore: readonly string[] = GENERIC_TAGS,
): T[] {
  const frequency = new Map<string, number>();
  for (const work of all) {
    for (const tag of work.tags) frequency.set(tag, (frequency.get(tag) ?? 0) + 1);
  }

  const targetTags = new Set(target.tags.filter((tag) => !ignore.includes(tag)));

  return all
    .filter((work) => work.slug !== target.slug)
    .map((work) => {
      let score = 0;
      for (const tag of new Set(work.tags)) {
        if (targetTags.has(tag)) score += 1 / Math.sqrt(frequency.get(tag) ?? 1);
      }
      return { work, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (a.work.date < b.work.date ? 1 : a.work.date > b.work.date ? -1 : 0))
    .slice(0, limit)
    .map(({ work }) => work);
}
