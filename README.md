# kivozo.com

A home for small, fun, and useful things on the web.

## Charter

kivozo.com is meant for:

- 🎮 **Games** — small browser games and toys
- 🛠️ **Fun tools** — utilities that are interesting or playful
- 📚 **Dictionaries** — word lists, glossaries, lookup tools
- 🔧 **Utilities** — practical helpers and converters
- 🧪 **Experiments** — prototypes, demos, things to learn from
- 🎲 **Random projects** — whatever else seems worth building

The site is intentionally broad: a personal sandbox for shipping ideas.

## Stack

- **[Astro](https://astro.build)** static site — zero JS by default, can opt
  into any framework per project.
- **[Cloudflare Pages](https://pages.cloudflare.com)** for hosting + CDN.
- Monorepo: every project lives in one repo, one build, one deploy.

## Repository structure

```
/
├── astro.config.mjs
├── package.json
├── public/
│   ├── favicon.svg
│   ├── _headers, _redirects      # Cloudflare Pages config
│   └── apps/<slug>/              # standalone static HTML/JS projects
├── src/
│   ├── content.config.ts         # project schema
│   ├── content/projects/<category>/<slug>/index.md   # one folder per project
│   ├── components/ProjectCard.astro
│   ├── layouts/BaseLayout.astro
│   ├── lib/categories.ts         # category metadata
│   └── pages/
│       ├── index.astro           # homepage — auto-indexes all projects
│       ├── about.astro
│       └── projects/
│           ├── index.astro       # all projects
│           ├── [category].astro  # /projects/games, /projects/tools, ...
│           └── [category]/[...slug].astro   # individual project pages
└── docs/
    └── deploy.md                 # Cloudflare Pages + DNS instructions
```

URL shape: `kivozo.com/projects/<category>/<slug>` (subpaths, not subdomains).
Standalone apps can live at `kivozo.com/apps/<slug>/` (any HTML/JS, no Astro
build step required) — just set `href: /apps/<slug>/` in the project's
frontmatter.

## Quick start

```pwsh
npm install
npm run dev      # http://localhost:4321
npm run build
npm run preview
```

## Add a project

Create `src/content/projects/<category>/<slug>/index.md`:

```yaml
---
title: My Thing
description: One-line pitch.
category: tools        # games | tools | dictionaries | utilities | experiments | random
status: wip            # idea | wip | live | archived
featured: false
tags: [demo]
created: 2026-06-01
# href: /apps/my-thing/   # optional — link to standalone app under public/apps/
---
Markdown body for the project page.
```

The homepage and the category page auto-index it on the next build.

## Deploying

See [docs/deploy.md](docs/deploy.md) for Cloudflare Pages setup and how to
move the `kivozo.com` domain off Squarespace.

## Status

🚧 Just scaffolded. First sample projects live under
`src/content/projects/experiments/hello-kivozo/` and
`src/content/projects/tools/coin-flip/`.

## License

TBD
