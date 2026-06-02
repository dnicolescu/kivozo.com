import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/index.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['games', 'tools', 'dictionaries', 'utilities', 'experiments', 'random']),
    status: z.enum(['idea', 'wip', 'live', 'archived']).default('wip'),
    tags: z.array(z.string()).default([]),
    created: z.coerce.date(),
    updated: z.coerce.date().optional(),
    // Optional: link to a standalone page/app instead of rendering the markdown
    href: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { projects };
