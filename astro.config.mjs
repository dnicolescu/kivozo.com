import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://kivozo.com',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      // Exclude the generated OG image PNGs from sitemap.xml — they're assets, not pages.
      filter: (page) => !page.includes('/og/'),
      // Standalone HTML apps live in /public/apps/ so Astro can't auto-discover them.
      customPages: [
        'https://kivozo.com/apps/coin-flip/',
        'https://kivozo.com/apps/dictionary/',
      ],
    }),
  ],
});
