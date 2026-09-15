# Headless WordPress front end

A Next.js front end for any WordPress site. It reads the WordPress REST API, serves static pages, and updates within seconds of publishing without a rebuild.

Nothing about a specific site is hardcoded. The main navigation comes from your pages, sections from your categories, and the title, tagline and favicon from the site name in WordPress. Point it at a different site and it rebrands itself.

## Requirements

- Node.js 20 or newer.
- A WordPress site with permalinks set to anything other than Plain.
- For deployment, hosting that can run a Node app, with SSH access.

## Quick start

```bash
npm ci
cp .env.example .env      # the only file to fill in
npm run inspect           # reports what your WordPress contains
npm run dev               # http://localhost:3000
```

If `npm run inspect` prints HTML instead of JSON, change permalinks in WordPress under Settings, Permalinks, Post name.

## Configuration

`.env` holds everything. The first three values are the app's and ship to the server; the `PRESSY_*` values are for deploying and never leave your machine.

| Variable | Value |
| --- | --- |
| `WP_URL` | WordPress base URL, no trailing slash |
| `NEXT_PUBLIC_SITE_URL` | Public URL of this app. A domain root, or include the path prefix if it is proxied under one. Inlined at build time |
| `REVALIDATE_SECRET` | Shared secret for the refresh webhook. Generate with `openssl rand -hex 32` |
| `PRESSY_SSH`, `PRESSY_PASSWORD`, `PRESSY_PORT` | SSH login for `npm run deploy` |
| `PRESSY_DIR` | Remote folder for the app, relative to the SSH home |
| `PRESSY_WP_DIR` | Remote folder holding `wp-config.php`. The deploy installs the WordPress plugin there |

`lib/site.ts` holds the preferences, and is the only code file most people touch:

- `name` and `description`: leave empty to use WordPress's title and tagline.
- `sectionOrder`: pins the order of sections by category slug. Slugs not listed follow by post count. Unknown or empty categories are ignored.
- `hiddenSections`: kept out of the nav. `uncategorized` by default, but shown anyway if hiding it would leave nothing.
- `navPages`: WordPress pages to show in the main nav, by slug. Empty shows every top-level page in WordPress menu order. Top-level pages always appear in the footer.
- `perPage`, `perSectionBlock`, `latestOnFront`, `revalidateSeconds`, `locale`, `timeZone`.

## Commands

| Command | Does |
| --- | --- |
| `npm run inspect` | Reports posts, pages, images, categories, tags, authors and excerpt style from your WordPress |
| `npm run dev` | Development server |
| `npm run build` | Production build, then assembles `.next/standalone/` |
| `npm start` | Runs the built app |
| `npm run typecheck` | Type check |
| `npm run lint` | ESLint, fails on any warning |
| `npm run preflight` | Checks the env file, WordPress, the plugin and the live app, and says how to fix each problem |
| `npm run deploy` | Preflight, build, upload, install the WordPress plugin, restart, smoke test |
| `npm run deploy:plugin` | Only the WordPress plugin |

Delete `.next/cache` before building if WordPress content changed. Next.js keeps API responses between builds.

## Routes

| Route | |
| --- | --- |
| `/` | Lead story, secondaries, latest list, one block per section |
| `/latest`, `/latest/page/2` | Chronological archive |
| `/section/[slug]` | Category archive |
| `/topic/[slug]` | Tag archive |
| `/author/[slug]` | Author page |
| `/[year]/[month]/[slug]` | Article |
| `/[path]` | A WordPress page, at its own path. Nested pages keep their hierarchy, e.g. `/about/team` |
| `/[slug]` | An old post permalink redirects to the dated article URL |
| `/search?q=` | Server-rendered search |
| `/feed.xml`, `/sitemap.xml`, `/robots.txt`, `/icon` | Generated from live content |
| `POST /api/revalidate` | Refresh webhook |

## WordPress side

`wordpress/mu-plugins/pressy-headless.php` refreshes the app when a post or page changes, and redirects WordPress front-end URLs to the matching app route. `npm run deploy` installs it, together with a generated settings file that carries the app URL and the secret from `.env`. The plugin file itself is never edited, and the settings file is never committed. Without the plugin, pages still refresh on their own within 10 minutes.

`docs/deploy.md` covers installing it without SSH.

## Deploying

`npm run build` produces `.next/standalone/`, a self-contained app including its dependencies. `npm run deploy` uploads that folder over SSH, installs the plugin, restarts the app and smoke tests it. Nothing is built or installed on the server.

`docs/going-live.md` is the checklist for the first deploy: the setup order, and what each failure means. `docs/deploy.md` is the reference: host settings, the two URL modes, restart and rollback.

## Working with an AI agent

`AGENTS.md` lists the architecture, the rules that must hold, and the non-obvious decisions. Point your agent at it.

To build a site from first principles instead of reproducing this starter's exact content model, routes, design and hosting, use the staged prompts in [`docs/prompt-workflow.md`](docs/prompt-workflow.md). They begin by inspecting the real WordPress installation, record the decisions for that site, and finish with deployment and release verification.

## Licence

MIT. See `LICENSE`.
