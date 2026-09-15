# Agent notes

Facts about this repository. Read before changing anything.

## What this is

Next.js 16, App Router, React Server Components, TypeScript strict. A front end for a headless WordPress site using only the core REST API. It builds to a standalone Node server and deploys as a pre-built folder over SSH.

No database, no CMS abstraction layer, no GraphQL. Do not add any.

## File map

| Path | Holds |
| --- | --- |
| `lib/site.ts` | Per-site preferences. The only file most users edit |
| `lib/wp/client.ts` | The only place that calls the WordPress REST API. Cache tags, pagination, timeout, error handling. The one other `fetch` in app code is in `opengraph-image.tsx`, which inlines an already-normalized image URL as bytes |
| `lib/wp/types.ts` | Raw WordPress response shapes |
| `lib/wp/normalize.ts` | Raw objects to `Article`, `Page`, `Section`, `Topic`, `Author`, `Image` |
| `lib/wp/queries.ts` | Every query a page can run. Pages never build API URLs |
| `lib/html/render.tsx` | WordPress body HTML to React through an allowlist. Also collects h2 and h3 headings and gives them ids |
| `lib/image-loader.ts` | Maps a requested width onto a size WordPress already generated |
| `lib/urls.ts` | Route builders and `withBasePath()` |
| `lib/brand-mark.tsx` | The favicon drawing, shared by `app/icon.tsx` and `app/apple-icon.tsx` |
| `lib/text.ts` | Entity decoding, excerpt cleanup, reading time, truncation |
| `components/` | Presentation only. No data fetching |
| `app/globals.css` | Design tokens and layout |
| `app/article-body.css` | Typography for WordPress body HTML only |
| `scripts/` | Inspection, preflight, bundle assembly, deploy |
| `wordpress/mu-plugins/` | The WordPress side. `npm run deploy` uploads it. `pressy-headless-config.php` is generated there from `.env` and is gitignored |
| `docs/going-live.md` | Setup order and the failures met on a first deploy. Update it when a deploy teaches something new, and add a check to `scripts/preflight.mjs` or the smoke test when a script can catch it |

## Rules that must hold

1. **Nothing about one site is hardcoded.** No category slug, site name or URL outside `lib/site.ts` and `.env`. Sections are fetched from WordPress. `site.sectionOrder` only pins an order for slugs that exist. `site.name` and `site.description` stay empty in this repository.
2. **Every layout works with no images.** Many WordPress sites have no featured images. Each `Story` variant has a no-image branch. Both paths must keep working.
3. **Images are never upscaled, and a card never loads the original.** `lib/image-loader.ts` maps widths onto sizes WordPress generated, so the Next.js image optimizer and `sharp` are never used. `WpImage` caps rendered width at the natural width.
4. **A failed WordPress request never crashes a render.** `client.ts` logs and returns `null` or an empty list. Pages must handle empty.
5. **No client-side data fetching for content.** Client components are for interaction only. There are two: `app/error.tsx` and `components/TableOfContents.tsx`.
6. **The revalidate secret is never logged, echoed, or written into a tracked file.** It lives in `.env`. The WordPress plugin reads it from `pressy-headless-config.php`, which `scripts/deploy.sh` writes and `.gitignore` excludes. `pressy-headless.php` ships with empty constants and is never edited for a site.
7. **Every date is a `<time datetime>`.** Every small link has a hit area of at least 24px, which is why kickers, bylines and footer links carry vertical padding.
8. **Changes go here, never into the starter.** `npm run starter` regenerates `../nextjs-wp-starter` from this repository and overwrites everything it tracks. Work done in the starter is lost on the next run.

## Non-obvious decisions

- **`display: "optional"` on the two display fonts** in `app/layout.tsx`. With `swap`, the large headline rewraps when the font arrives. Measured CLS 0.31 and 15 Lighthouse points. Do not change to `swap`.
- **`app/[...year]/page.tsx` serves WordPress pages and the legacy `/{slug}` redirect.** Next.js allows one parameter name per path position, and `/[year]/[month]/[slug]` owns that position, so the catch-all reuses the name `year` even though it holds a path. A mismatch builds fine and throws at runtime.
- **Pages are one list.** `getPages()` fetches every published page and resolves each path from the parent chain. A three-segment page path always matches the article route, which falls back to a page lookup, so nesting two deep still works.
- **The masthead lists pages first and sections second.** Top-level pages are the main navigation (`site.navPages` narrows or reorders them); categories are a pill row underneath. Both rows scroll sideways on small screens rather than wrapping.
- **Kickers are hidden when the site has one section** (`showKicker` in `app/page.tsx`). A label identical on every story carries no information.
- **The article dek is hidden when it repeats the body** (`dekRepeatsBody` in `lib/text.ts`). WordPress generates excerpts by copying the opening of the post.
- **Heading ids are the one thing that survives the HTML allowlist.** `renderWpHtml` returns `{ nodes, headings }` and is called once in the article page, not twice.
- **`.article-layout` is `display: block` below 1024px.** A sticky element only travels within its containing block, so the mobile contents bar needs a tall block parent.
- **`basePath` is derived from the pathname of `NEXT_PUBLIC_SITE_URL`.** Empty for a domain root.
- **`scripts/standalone-entry.cjs`** re-adds a path prefix that a host proxy strips. Idempotent, and a no-op when there is no `basePath`.
- **`next.config.ts` forwards WordPress paths to the CMS** (`/wp-admin`, `/wp-login.php`, `/wp-json/*`, `/wp-content/*`) when the app owns a domain root. Skipped when both share a host, where it would loop.
- **`app/[year]/[month]/[slug]/opengraph-image.tsx`, `app/icon.tsx` and `app/apple-icon.tsx` read a font from `assets/fonts/`**, which is why `next.config.ts` sets `outputFileTracingIncludes` for each. Removing an entry breaks that image in production only.
- **The favicon is generated from the site name**, not stored as a file, so a different WordPress gets its own initial. `lib/brand-mark.tsx` mirrors the colour tokens because an `ImageResponse` cannot read CSS variables.
- **Pagination uses `/page/2` path segments**, not query strings, so archive pages stay static.
- **One env file.** `.env` holds the app's three values and the `PRESSY_*` deploy settings. `scripts/deploy.sh` writes the bundle's `.env.production` from the non-`PRESSY_` lines, using the same override rule as `next build`: a hand-written `.env.production` wins when one exists.
- **The plugin does nothing until configured.** An unconfigured copy in `mu-plugins/` must not redirect a WordPress front end to a placeholder address.

## Caching

Every fetch carries tags and a 600 second fallback:

- `posts`: every list, and every taxonomy or user lookup
- `post:{slug}`: one article
- `category:{slug}`, `tag:{slug}`, `author:{slug}`: archives and the lookups feeding them
- `site`: title and tagline from `/wp-json/`
- `pages`: the page list, which feeds the footer, the nav, the sitemap and every page route

`POST /api/revalidate` with an `x-revalidate-secret` header revalidates the affected tags. A new query means deciding which tag invalidates it.

## Scripts

- `scripts/inspect-wp.mjs`: reports what the configured WordPress contains. No dependencies. Run it before assuming anything about images, categories, excerpts or authors.
- `scripts/preflight.mjs`: checks the env file, WordPress's own address, the plugin's status and whether the app's domain is answered by the app. Each check is a failure that happened once. `deploy.sh` runs it first with `--pre-deploy`.
- `scripts/prepare-standalone.mjs`: runs after `next build`. Copies `public/`, `.next/static/` and `entry.js` into `.next/standalone/`, which Next.js leaves out.
- `scripts/standalone-entry.cjs`: the app's entry point on the server. Copied into the bundle as `entry.js`.
- `scripts/deploy.mjs`: loads `PRESSY_*` from `.env` and runs `deploy.sh` through Git Bash on Windows.
- `scripts/deploy.sh`: preflight, build, assemble, upload, plugin, restart, smoke test. It writes the bundle's `.env.production` and strips every other env file, because `next build` copies `.env` into the standalone output. It leaves out `rsync --delete` when `PRESSY_DIR` is the SSH home, where it would remove WordPress. It matches processes with `[n]ode` so `pkill` cannot kill its own SSH session. The smoke test checks that the front page contains `/_next/`, because a WordPress front page is also a 200.
- `scripts/ssh-askpass.sh`: supplies `PRESSY_PASSWORD` to ssh so a password is not prompted for.
- `scripts/make-starter.mjs`: regenerates the public starter. Preserves the starter's local state, refuses to publish a secret, a real hostname from this repository's `.env`, or a plugin file with a filled-in constant.

## Working here

```bash
npm run inspect
npm run dev
npm run typecheck && npm run lint    # both must be clean, lint runs with --max-warnings 0
npm run build
npm run preflight                    # before and after a deploy
```

- Delete `.next/cache` before building if WordPress content changed. Next.js keeps API responses between builds and will otherwise embed stale content.
- Stop any running preview before rebuilding on Windows. It locks `.next/standalone`.
- Measure Lighthouse against the built app, not the dev server.
- Never `source .env` in a shell. The scripts read it themselves.

## Style

- Comments say why, not what.
- UI text is sentence case, and says what happened and what to do next.
- No raw hex values or font stacks in components. Use the tokens in `app/globals.css`.
- Prefer a variant of an existing component over a new component.
