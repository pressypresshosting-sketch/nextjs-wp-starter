# Build a headless WordPress site with prompts

This is a guided workflow for building a Next.js front end for an existing WordPress site. It captures the reusable lessons in this repository without requiring another site to use the same content model, routes, design, cache policy, or host.

The prompts are designed to be run in order in the same coding-agent task. They deliberately separate discovery from decisions and implementation. That is the main source of determinism: the agent records facts before it is allowed to design around them.

## What this repository teaches

The current starter is one valid result of the workflow, not the universal result. It assumes:

- WordPress core REST API only, with posts and pages as the public content types.
- Categories behave as editorial sections and tags behave as topics.
- Posts use `/{year}/{month}/{slug}` and pages retain their WordPress hierarchy.
- The home page is a publication front, with sticky posts preferred as leads.
- Public content is mostly static, with a ten-minute fallback and webhook-driven cache invalidation.
- WordPress and the Node app are deployed on one SSH-accessible host, either on separate domains or with the app below a path prefix.
- A small must-use WordPress plugin redirects public WordPress routes and notifies Next.js when content changes.

Those are all choices. The portable ideas are:

1. Inspect the real WordPress API before choosing a content model or layout.
2. Put WordPress transport, raw types, normalization, and page queries behind separate boundaries.
3. Decide the public URL topology and permalink mapping explicitly.
4. Preserve admin, login, REST, media, cron, preview, and editor access before redirecting public traffic.
5. Render WordPress HTML and media defensively.
6. Give every cached query an invalidation rule and a time-based fallback.
7. Verify the deployed response is the Next.js app, not merely any HTTP 200 response.

## How to use the prompts

Before Prompt 1, give the agent a repository and these values:

```text
WORDPRESS_URL=
PUBLIC_SITE_URL=
DEPLOYMENT_TARGET=unknown
```

`WORDPRESS_URL` is the site Prompt 1 inspects. It may be omitted only when it already exists in a local untracked environment file. Never paste passwords or revalidation secrets into a prompt or a tracked document.

`PUBLIC_SITE_URL` is where this front end will be served. Include the path prefix if it will be proxied under one, because that single fact changes canonical URLs, sitemap and feed URLs, asset paths, form actions and the webhook URL. Prompt 4 treats it as the base-path contract to test against.

`DEPLOYMENT_TARGET` names the host and runtime for the Next.js app, for example `vercel`, `node-on-shared-ssh-host`, `docker`, or `static-export`. It is the one fact no amount of WordPress inspection can reveal, so it is supplied rather than discovered. Leave it as `unknown` to have Prompt 2 choose and record a reversible default; set it and Prompts 2 and 8 treat it as a given instead of re-deciding it.

Run one prompt at a time. Review the artifact named in its completion contract before continuing. If a later prompt uncovers a false assumption, update the decision record and rerun only the affected prompts.

These prompts assume Next.js App Router and TypeScript, but they do not assume this repository's visual design or route names.

## Prompt 1 — Inspect the repository and WordPress

```text
You are beginning a headless WordPress project. Work read-only except for the two documentation files requested below.

First, read the repository instructions and map the existing application. Then inspect the WordPress installation at WORDPRESS_URL through its public REST API. Do not infer the content model from WordPress conventions or from the existing UI.

Inspect and record:
- WordPress site identity, locale/timezone information, home URL, site URL, REST namespaces, and permalink evidence.
- Every REST-visible post type and taxonomy, including custom ones; whether each is publicly queryable; and representative response fields.
- Counts and representative samples for posts, pages, and each public custom post type.
- Page hierarchy, configured front-page behavior, menu availability, category/tag/custom-taxonomy usage, authors, sticky content, post formats, and custom templates.
- Featured-image coverage, original dimensions, generated image sizes, image hosts, MIME types, captions, credits, and missing alt text.
- Excerpt behavior and the HTML elements, block classes, embeds, shortcodes, forms, galleries, tables, code, and inline styles actually present in content.
- SEO-plugin fields, redirect-plugin evidence, authentication requirements, CORS behavior, and any REST fields added by plugins.
- Current public permalink examples for every content and archive type.
- Repository architecture, all routes, data-fetching entry points, environment variables, caching, WordPress-side code, deployment scripts, and existing checks.

Use multiple samples and pagination where needed. Redact secrets and personal data. Do not write credentials or private endpoint responses into the repository.

Write `docs/wp-discovery.md` containing:
1. Facts observed, with the endpoint or file that proves each fact.
2. A content inventory table.
3. A route/permalink inventory table.
4. A media and body-HTML compatibility table.
5. Hosting facts known versus still unknown.
6. Risks and unknowns, without proposing architecture yet.

Write `docs/current-repository-map.md` containing a concise responsibility map of the existing code and a list of constraints already encoded in it.

Stop after discovery. Do not scaffold, redesign, install packages, change production code, or choose routes. End by listing the decisions Prompt 2 must resolve.
```

Completion contract: the two files exist, observed facts are separated from unknowns, and no production file has changed.

## Prompt 2 — Turn facts into a decision record

```text
Read the repository instructions, `docs/wp-discovery.md`, and `docs/current-repository-map.md`. Create an implementation decision record for this specific site. Do not code yet.

For each decision below, choose one option using observed evidence. If the evidence is insufficient and the choice materially changes the implementation, ask one concise question. Otherwise choose the safest reversible default and label it as an assumption.

Decide:
- Which WordPress post types become public content, which are ignored, and the normalized domain model for each.
- Whether WordPress pages, a posts index, or a custom composition owns the home page.
- Which taxonomies and authors get public archives.
- Whether navigation comes from WordPress menus, page hierarchy, explicit configuration, or a combination.
- The public permalink for each content and archive type, including pagination and search.
- The legacy WordPress URLs that need redirects and the canonical URL for every public route.
- Whether the CMS and app use separate hosts, the same host with a path prefix, or an external reverse proxy.
- Which WordPress paths must bypass the app: at minimum admin, login, REST, media, includes, cron, AJAX, previews, feeds as applicable, and editor escape hatches.
- Static, dynamic, or hybrid rendering per route.
- Cache lifetime, cache tags, webhook invalidation, draft/preview behavior, and failure behavior.
- WordPress HTML strategy: trusted pass-through, sanitized React rendering, block-aware rendering, or another justified approach.
- Image strategy, including remote hosts, generated sizes, no-upscaling behavior, and the no-image layout.
- Search source, SEO metadata source, sitemap/feed policy, structured data, locale, and timezone.
- Deployment target, runtime, build location, environment handling, restart mechanism, rollback, and smoke tests. When `DEPLOYMENT_TARGET` was supplied as anything other than `unknown`, record it as a given and design around it rather than reopening the choice; when it is `unknown`, choose the simplest target the observed topology supports, label it an assumption, and state what would change if it were wrong.
- Scope for the first shippable version and explicitly deferred capabilities.

Write `docs/headless-plan.md` with:
1. Goals and non-goals.
2. A content-type mapping table: WordPress type -> domain type -> list query -> detail query -> public route -> cache tags.
3. A public route table: route -> source -> rendering mode -> canonical -> invalidation -> empty/error behavior.
4. A URL ownership table showing which system answers every WordPress-sensitive path.
5. Architecture boundaries and proposed file map.
6. Security and secret-handling rules.
7. An ordered implementation plan.
8. Acceptance criteria written as observable outcomes.
9. Assumptions, unknowns, and deferred work.

Do not silently preserve an existing starter decision. Every retained choice must be supported by discovery or explicitly marked as a preference.
```

Completion contract: every public content type, route, query, cache entry, and sensitive WordPress path has an owner and an acceptance criterion.

## Prompt 3 — Build the WordPress data boundary

```text
Implement only the data foundation described in `docs/headless-plan.md`. Read the repository instructions first and preserve unrelated work.

Requirements:
- Use the WordPress core REST API unless the decision record explicitly requires an observed plugin endpoint.
- Create one low-level WordPress request layer. It owns base-URL construction, query serialization, timeout, pagination headers, user agent, cache options, error reporting, and response validation. Pages and components must not construct REST URLs.
- Define raw response types only for fields the app reads.
- Normalize raw WordPress objects into stable domain objects. Keep WordPress naming and nullable/plugin-specific shapes out of presentation components.
- Put page-facing queries in a separate module. Each query declares cache tags and has deterministic empty/failure behavior from the decision record.
- Support pagination beyond WordPress's per-page limit where enumeration is required.
- Do not let a failed public WordPress request crash a render unless the plan explicitly says the route cannot degrade.
- Do not add client-side content fetching.
- Add focused tests or executable fixtures for URL construction, pagination metadata, normalization, missing embeds, missing images, entity decoding, and API failures.

Do not build visual pages yet. Update `docs/headless-plan.md` only if implementation reveals a false assumption; explain the change in its assumptions section.

Run the relevant type, lint, and test checks. End with a matrix of implemented queries and their cache tags.
```

Completion contract: a page can consume domain objects without knowing a REST path or raw WordPress response shape.

## Prompt 4 — Implement routing and URL parity

```text
Implement the public routes in `docs/headless-plan.md` using the data boundary already built. Focus on routing and behavior, not final visual design.

Requirements:
- Centralize route builders. Do not hand-build the same route in pages, components, metadata, feeds, redirects, or the WordPress bridge.
- Preserve page hierarchy where the plan requires it, with cycle and missing-parent protection.
- Resolve route collisions explicitly. Test collisions between posts, pages, date segments, reserved routes, custom post types, and pagination segments.
- Generate or dynamically resolve paths according to the route table; do not enumerate unbounded archives without a reason.
- Correct non-canonical but recognizable URLs with permanent redirects.
- Return a real not-found result for unknown resources and impossible page numbers.
- Give every route the planned empty state and CMS-failure state.
- Derive the base path from `PUBLIC_SITE_URL` in one place and ensure base-path behavior is correct for framework links, plain anchors, form actions, redirects, canonical URLs, sitemap URLs, feed URLs, assets, and webhook URLs. Test both a domain-root `PUBLIC_SITE_URL` and one carrying a path prefix; a prefix must appear exactly once in every emitted absolute URL, and never in a framework link that already adds it.
- Do not assume WordPress's permalink structure matches the public Next.js structure. Maintain an explicit mapping.

Add route-focused tests or a route-matrix check covering every row of the decision record. Run type, lint, and tests.
```

Completion contract: every route in the plan resolves, redirects, fails, and canonicalizes exactly as documented in both root-domain and configured path-prefix modes.

## Prompt 5 — Render WordPress content and media safely

```text
Implement the body-content and media strategy from `docs/headless-plan.md`. Use the actual elements and media patterns recorded in `docs/wp-discovery.md` as the minimum compatibility set.

Requirements:
- Treat WordPress body HTML as content input, not application code.
- Allow only the chosen elements, attributes, URL schemes, classes, iframe hosts, and script sources. Drop unsafe wrappers without losing safe text where practical.
- Remove event handlers and unapproved inline styles. Add `noopener noreferrer` to new-window links.
- Rewrite internal WordPress links through the centralized route mapping, including posts, nested pages, taxonomies, authors, and any selected custom types.
- Give headings stable unique IDs if the site needs anchor links or a table of contents.
- Preserve semantic HTML and accessibility.
- Render images with known dimensions when available, never upscale them, never require a featured image for layout, and do not load a full original for a small card when WordPress generated a suitable size.
- Handle unknown dimensions honestly and define behavior for non-image media and unexpected MIME types.
- Implement only embed providers observed in discovery or explicitly approved in the plan.
- Add representative fixtures for every observed body element and for malformed/unsafe input.

Render or inspect representative outputs at phone, tablet, and desktop widths. Run type, lint, tests, and any visual checks available.
```

Completion contract: every observed content pattern has a fixture and an intentional rendered or rejected result; layouts remain usable with zero images.

## Prompt 6 — Build the site experience from the chosen content model

```text
Build the server-rendered pages and presentation components described in `docs/headless-plan.md`. Do not copy the current starter's newspaper layout unless the plan chose a publication front.

Requirements:
- Derive navigation and labels from the configured source in the decision record.
- Implement the chosen home-page composition and only the archives relevant to the selected content model.
- Keep presentation components free of data fetching.
- Prefer variants of shared components over duplicate components.
- Make all variants work with missing images, excerpts, authors, taxonomies, descriptions, and empty result sets.
- Avoid repeating auto-generated excerpts at the start of detail bodies.
- Render dates with semantic `<time datetime>` values using the chosen locale and WordPress-aware timezone policy.
- Keep interaction components small; content must remain present without client-side JavaScript.
- Meet keyboard, focus, heading-order, reduced-motion, target-size, responsive-layout, and color-contrast requirements.
- Keep site-specific copy, route labels, ordering, and branding in one configuration boundary or in WordPress, as decided in the plan.

Check representative real content, not only ideal fixtures. Run type, lint, tests, and responsive visual checks.
```

Completion contract: the selected content model is fully navigable and readable with rich, sparse, missing, and unavailable CMS data.

## Prompt 7 — Add caching and WordPress-driven revalidation

```text
Implement the cache and freshness design in `docs/headless-plan.md`.

Requirements:
- Inventory every cached query and assign the minimum tags needed to invalidate all of its consumers.
- Give every cache a time-based fallback so a broken or missing webhook cannot make content stale forever.
- Create an authenticated revalidation endpoint. Accept only the planned methods and payloads; validate input; never log, echo, commit, or expose the secret.
- When a content change can remove an item from an old taxonomy, author, menu, or parent relationship, invalidate both the previous and current relationships. If WordPress cannot supply previous values, deliberately invalidate a broader collection tag.
- Support publish, update, unpublish, trash, restore, and deletion for every selected public post type.
- Keep the WordPress notification non-blocking so publishing is not delayed when the app is down.
- Make the WordPress bridge inert until both destination and secret are valid.
- Provide a secret-free status endpoint or another safe health check if operations need one.
- Keep all secret-bearing generated files untracked and prove that deployment excludes local credentials.
- Test rejection without a secret, rejection with a wrong secret, successful invalidation, and fallback freshness.

Document the final query-to-tag and event-to-tag matrices in `docs/headless-plan.md`.
```

Completion contract: for each WordPress content event, the document proves which Next.js views become fresh and what happens if notification fails.

## Prompt 8 — Preserve WordPress access and implement deployment

```text
Implement the URL ownership and deployment design in `docs/headless-plan.md`. Treat continued WordPress access as a release blocker.

Use the deployment target recorded in `docs/headless-plan.md` as the decided one. Reopen it only if this prompt's own checks prove it unworkable, and record that reversal in the plan's assumptions section. Determine the remaining topology from evidence: never assume the current starter's SSH host, panel, port, process manager, path stripping, or same-server setup.

Requirements:
- Ensure the canonical CMS address continues to serve `/wp-admin/`, `/wp-login.php`, `/wp-json/`, `/wp-content/`, `/wp-includes/`, AJAX, cron, previews, feeds, and editor workflows as required.
- If the public app host receives WordPress-sensitive paths, forward or redirect them to the CMS without loops and while preserving path and query string.
- Redirect only public WordPress theme routes represented in the route mapping. Unknown content types must not silently redirect to the home page.
- Provide an authenticated editor escape hatch to the WordPress-rendered view if the plan calls for one.
- Detect same-host and path-prefix loops.
- Build and deploy using the chosen platform's native approach. Separate build-time public configuration, runtime application configuration, and local deployment credentials.
- Prevent local environment files and deployment credentials from entering the artifact.
- Provide restart, health check, smoke test, and rollback procedures.
- If a reverse proxy strips a path prefix, handle it once at the proxy or entry boundary and test both stripped and preserved behavior.
- Make destructive synchronization impossible against an unresolved, root, home, or WordPress directory.

Write or update `docs/going-live.md` for this topology. Automate every deployment failure that can be detected safely.
```

Completion contract: an operator can prove that the app, CMS admin, REST API, media, webhook, and rollback path work before changing DNS or routing live traffic.

## Prompt 9 — Add SEO, feeds, discovery, and redirects

```text
Implement the discovery and SEO behavior selected in `docs/headless-plan.md`.

Requirements:
- Produce correct title, description, canonical, Open Graph, and social-card data for each public route.
- Decide whether social-card images are generated per item, taken from the featured image, or a single static fallback. If generated, define the behavior when the item has no image, when the remote image fails to load, and when a title is long enough to overflow the card.
- Use absolute public URLs that include any configured path prefix exactly once.
- Use the selected SEO-plugin fields only when discovery proved they are available and stable; define fallbacks.
- Add appropriate structured data for the actual content types rather than labeling everything as an article.
- Generate a sitemap containing only canonical indexable URLs, with defensible modification dates.
- Generate feeds only for content types that need them. Use the configured locale/language and correct media MIME types.
- Keep search and utility endpoints out of the index as planned, and state the indexability and canonical of paginated archive pages rather than leaving page 2 onward to chance.
- Preserve intentional legacy URLs with tested permanent redirects.
- Decide which system owns root `robots.txt` when the app is mounted below a path; do not assume crawlers use a nested robots file.

Add checks for root-domain and path-prefix modes. Run type, lint, tests, and inspect generated metadata/feed/sitemap output.
```

Completion contract: a route sample table shows its canonical, indexability, structured-data type, sitemap membership, and legacy redirects.

## Prompt 10 — Audit the finished system against reality

```text
Perform a release audit of the finished headless WordPress site. Diagnose and fix in-scope failures; do not merely list them.

Re-read the repository instructions, `docs/wp-discovery.md`, and `docs/headless-plan.md`. Then:
- Re-run WordPress discovery and report any drift from the original inventory.
- Search for hardcoded site names, hosts, slugs, route labels, locale values, content-type assumptions, secrets, and deployment-provider assumptions outside their approved boundaries.
- Verify that all content-fetching goes through the data boundary and that presentation components do not fetch.
- Test empty WordPress, unreachable WordPress, partial API failures, no images, mixed image hosts, missing embeds, malformed HTML, deleted authors, renamed slugs, moved pages, empty taxonomies, and out-of-range pagination.
- Test every public and protected route from the route and URL-ownership tables.
- Test cache invalidation for create, update, move, rename, unpublish, trash, restore, and deletion.
- Run type checking, lint with zero warnings, automated tests, production build, and artifact inspection.
- Run the built app and smoke-test HTML identity, assets, representative detail and archive routes, redirects, metadata, feed, sitemap, images, not-found behavior, webhook authentication, CMS admin, REST, media, and preview access.
- Check responsive behavior and accessibility on representative real content.
- Verify the deployment artifact contains no local environment file, deployment password, private key, or secret except the intended runtime configuration.

Update `docs/going-live.md` with any newly discovered operational failure, its symptom, cause, fix, and an automated check when possible.

End with a release report containing: passed checks, fixed failures, remaining blockers, accepted risks, and exact rollback steps. Do not declare success while a release-blocking check is unverified.
```

Completion contract: the release report is evidence-based, all automated checks pass, and any unverified external operation is named as a blocker rather than assumed successful.

## Optional prompt — Adapt an existing implementation after discovery changes

Use this when a site adds a custom post type, changes permalinks, moves hosts, adopts an SEO plugin, or otherwise invalidates the original plan.

```text
The WordPress or hosting setup has changed. Do not patch the visible symptom first.

Re-run only the relevant parts of discovery and compare them with `docs/wp-discovery.md`. Update the facts there. Then update every affected row in `docs/headless-plan.md`, including content mapping, routes, URL ownership, cache tags, webhook events, redirects, SEO, deployment, and acceptance criteria.

Produce an impact list before editing production code. Implement the smallest coherent change across all affected layers. Add a regression check that would have detected this drift. Run the full verification appropriate to the changed layers and update `docs/going-live.md` if the change exposed an operational failure.
```

## Why this is a better video structure

The teaching arc becomes “how to reason about a headless WordPress build,” not “how to reproduce one repository.” The present starter can still appear as the worked example after Prompt 2: posts become articles, categories become sections, pages retain their hierarchy, and a same-server standalone Node deployment is selected. A viewer with WooCommerce products, portfolios, custom taxonomies, a static home page, WordPress menus, Vercel, or a separate CMS host takes the same path but records different decisions.

The deterministic part is the process and its contracts. The variable part is the site.
