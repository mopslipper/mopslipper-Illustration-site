import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { siteConfig, works, url } from '../lib/data';

const MAX_ITEMS = 30;

export function GET(context: APIContext) {
  return rss({
    title: siteConfig.site_title,
    description: siteConfig.site_description,
    site: new URL(url('/'), context.site).href,
    items: works.slice(0, MAX_ITEMS).map((work) => ({
      title: work.title,
      link: new URL(url(`/works/${work.slug}.html`), context.site).href,
      pubDate: new Date(`${work.date}T00:00:00+09:00`),
      description: work.description || work.tags.join(' / '),
      categories: work.tags,
    })),
    customData: '<language>ja</language>',
  });
}
