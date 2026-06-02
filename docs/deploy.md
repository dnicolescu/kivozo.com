# Deploying kivozo.com to Cloudflare Pages

## One-time setup

1. **Push this repo to GitHub** (or GitLab).
2. Go to **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**.
3. Pick the repo. Use these settings:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** set env var `NODE_VERSION=20`
4. Click **Save and Deploy**. First build will produce a `<project>.pages.dev` URL.

## Point kivozo.com at Cloudflare Pages

You can either keep DNS at Squarespace and CNAME over, or move DNS to Cloudflare
(recommended — free, faster, gives you full control).

### Option A — Move DNS to Cloudflare (recommended)

1. In Cloudflare: **Add a site** → enter `kivozo.com` → free plan.
2. Cloudflare scans existing DNS. Review the imported records.
3. At Squarespace (registrar), change the domain's **nameservers** to the two
   Cloudflare nameservers shown.
4. Wait for propagation (minutes to a few hours). Cloudflare emails you when active.
5. Back in **Pages → your project → Custom domains**, add `kivozo.com` and
   `www.kivozo.com`. Cloudflare creates the records automatically.

### Option B — Keep DNS at Squarespace

1. In Pages → Custom domains, add `kivozo.com`. Cloudflare gives you a target
   like `<project>.pages.dev` and asks for a CNAME (apex usually via ALIAS/ANAME
   or a flat CNAME flattening — Squarespace DNS supports CNAME at apex via their
   own record types; if not, use Option A).
2. At Squarespace DNS: add CNAME `www` → `<project>.pages.dev`.
3. For the apex `kivozo.com`, set the A records Cloudflare provides, or move just
   the domain to Cloudflare Registrar later.

### Cancel Squarespace site plan (keep domain)

In Squarespace: **Settings → Billing & Account → Subscriptions** — cancel the
**website** subscription. Keep the **domain** subscription so the registration
doesn't lapse. (Or transfer the domain to Cloudflare Registrar for at-cost renewal.)

## Local development

```pwsh
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to ./dist
npm run preview  # serve ./dist locally
```

## Adding a new project

```
src/content/projects/<category>/<slug>/index.md
```

Frontmatter shape — see `src/content.config.ts` for the full schema:

```yaml
---
title: My Thing
description: One-line pitch.
category: tools        # games | tools | dictionaries | utilities | experiments | random
status: wip            # idea | wip | live | archived
featured: false
tags: [demo]
created: 2026-06-01
# Optional: link to a standalone page/app instead of rendering the markdown body
# href: /apps/my-thing/
---

Markdown body for the project page goes here.
```

If `href` is set, the homepage card links there directly and **no project page
is generated** from the markdown body. Standalone HTML/JS apps go under
`public/apps/<slug>/` and are served as-is.
