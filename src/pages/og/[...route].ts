// Static OpenGraph image generator.
// Builds a 1200x630 PNG for every page so links shared on social / Slack / Discord
// preview nicely. Powered by astro-og-canvas (no browser, no external service).

import { OGImageRoute } from 'astro-og-canvas';
import { getCollection } from 'astro:content';
import { CATEGORIES, CATEGORY_KEYS, type CategoryKey } from '../../lib/categories.ts';

interface PageMeta {
  title: string;
  description: string;
}

async function buildPages(): Promise<Record<string, PageMeta>> {
  const pages: Record<string, PageMeta> = {};

  // Top-level pages
  pages['home'] = {
    title: 'kivozo.com',
    description: 'Games, fun tools, dictionaries, utilities, experiments, and random projects.',
  };
  pages['about'] = {
    title: 'About kivozo.com',
    description: 'Why this site exists and what to expect.',
  };
  pages['projects'] = {
    title: 'All projects',
    description: 'Everything on kivozo.com, grouped by category.',
  };

  // One per category index
  for (const key of CATEGORY_KEYS) {
    const c = CATEGORIES[key as CategoryKey];
    pages[`projects/${key}`] = {
      title: `${c.emoji} ${c.label}`,
      description: c.blurb,
    };
  }

  // One per project (including external/standalone ones that have `href`)
  const projects = await getCollection('projects');
  for (const p of projects) {
    const slug = p.id.replace(/\/index$/, '');
    const c = CATEGORIES[p.data.category as CategoryKey];
    pages[`projects/${slug}`] = {
      title: p.data.title,
      description: `${c.emoji} ${c.label} · ${p.data.description}`,
    };
  }

  return pages;
}

const pages = await buildPages();

export const { getStaticPaths, GET } = await OGImageRoute({
  pages,
  param: 'route',
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description,
    logo: {
      path: './public/favicon.svg',
      size: [64],
    },
    bgGradient: [
      [15, 17, 21],   // --bg
      [23, 26, 33],   // --card
    ],
    border: { color: [124, 196, 255], width: 6, side: 'inline-start' },
    padding: 80,
    font: {
      title: {
        size: 72,
        lineHeight: 1.15,
        weight: 'ExtraBold',
        color: [231, 233, 238], // --fg
      },
      description: {
        size: 32,
        lineHeight: 1.4,
        color: [154, 163, 178], // --muted
      },
    },
  }),
});
