# Build a headless WordPress site with prompts

A guided workflow for building a Next.js front end against an existing
WordPress site. It captures the reusable lessons in this repository without
requiring another site to adopt the same content model, routes, design, cache
policy or host.

Four prompts, run in order in the same coding-agent task. They deliberately
separate discovery from decisions from implementation. That separation is the
main source of determinism: the agent records facts before it is allowed to
design around them.

Read [`WORKFLOW-RULES.md`](WORKFLOW-RULES.md) first. Every prompt references it,
and most of the ways this chain goes wrong are covered there rather than in the
prompts themselves.

## What this repository teaches

The current starter is one valid result of the workflow, not the universal
result. It assumes:

- WordPress core REST API only, with posts and pages as the public content types.
- Categories behave as editorial sections and tags behave as topics.
- Pages retain their WordPress hierarchy.
- The home page is a publication front, with sticky posts preferred as leads.
- Public content is mostly static, with a ten-minute fallback and webhook-driven
  cache invalidation.
- WordPress and the Node app are deployed on one SSH-accessible host, either on
  separate domains or with the app below a path prefix.
- A small must-use WordPress plugin redirects public WordPress routes and
  notifies Next.js when content changes.

Those are all choices. The portable ideas are:

1. Inspect the real WordPress API before choosing a content model or layout.
2. Put WordPress transport, raw types, normalization, and page queries behind
   separate boundaries.
3. Decide the public URL topology and permalink mapping explicitly.
4. Preserve admin, login, REST, media, cron, preview, and editor access before
   redirecting public traffic.
5. Render WordPress HTML and media defensively.
6. Give every cached query an invalidation rule and a time-based fallback.
7. Verify the deployed response is the Next.js app, not merely any HTTP 200.

## Before you start

Fill in `.env`. That is the whole setup — there is no second list of values to
paste into a prompt, and `.env.example` remains the only file you edit.

Its first two sections are the app's own values and its deploy settings, which
you fill in whether or not you use these prompts. A third section holds two
keys read only by this workflow. They never reach the server: `npm run deploy`
strips every `WORKFLOW_` and `PRESSY_` line before uploading, and `npm run
preflight` fails if one appears in a file that ships.

| Key | Why it cannot be discovered |
| --- | --- |
| `WORKFLOW_HOST_RATE_LIMIT` | You find out by being banned. A shared host running fail2ban drops SSH and HTTPS together, so a burst of probes costs you the deploy channel and the site check at once. Leave it empty and the agent assumes a strict limit. |
| `WORKFLOW_DEPLOYMENT_TARGET` | No amount of WordPress inspection reveals where the front end will run. Leave it empty and Prompt 1 picks the simplest target the topology supports, labels it an assumption, and Prompt 3 confirms or reverses it in writing. |

**Your WordPress admin access is deliberately not a setting.** It follows from
values you have already filled in: `PRESSY_SSH` together with `PRESSY_WP_DIR`
means the agent can reach the WordPress host and run wp-cli, so it repairs
CMS-side problems itself. With `PRESSY_SSH` empty, or WordPress living somewhere
you cannot reach by shell, it must stop and hand those problems back to you.

That distinction matters more than it looks. Discovery routinely finds a
WordPress whose `siteurl` and `home` point at the wrong host, which makes every
media URL and admin link wrong and quietly invalidates every live check that
follows. Whether the agent fixes that or reports it is the difference between
one command and a run's worth of misleading results — so fill the deploy
settings in before Prompt 1, even if you are not deploying yet.

Never paste passwords or revalidation secrets into a prompt or a tracked
document. They belong in `.env`, which is gitignored.

## How to use the prompts

There are three review points: *what is true*, *it is live*, and *it is
audited*. Prompt 2 is long by design — it holds one input (the plan) and one
definition of done (the build passes). Splitting it into five costs the chain
its ability to notice that a change in one phase invalidated a check written in
another, and buys nothing but extra hand-offs.

Run one prompt at a time. Review the artifact named in its completion contract
before continuing. If a later prompt uncovers a false assumption, update the
decision record and rerun only the affected phases.

These prompts assume Next.js App Router and TypeScript, but they do not assume
this repository's visual design or route names.

## Prompt 1 — Discover, then decide

```text
You are beginning a headless WordPress project. Read WORKFLOW-RULES.md and the
repository instructions first, then read `.env`: it holds every value you need,
including the WORKFLOW_ keys this chain uses. Work read-only except for the
documentation files requested below. Confirm which directory is the deliverable
before your first write, and say which you chose.

PART A — DISCOVER

Map the existing application, then inspect the WordPress installation at
`WP_URL` from `.env` through its public REST API. Do not infer the content model
from WordPress conventions or from the existing UI. Respect
WORKFLOW_HOST_RATE_LIMIT.

Inspect and record:
- WordPress site identity, locale/timezone, home URL, site URL, REST
  namespaces, and permalink evidence.
- Every REST-visible post type and taxonomy, including custom ones; whether
  each is publicly queryable; and representative response fields.
- Counts and representative samples for posts, pages, and each public custom
  post type.
- Page hierarchy, configured front-page behavior, menu availability,
  category/tag/custom-taxonomy usage, authors, sticky content, post formats,
  and custom templates.
- Featured-image coverage, original dimensions, generated image sizes, image
  hosts, MIME types, captions, credits, and missing alt text.
- Excerpt behavior and the HTML elements, block classes, embeds, shortcodes,
  forms, galleries, tables, code, and inline styles actually present in content.
- SEO-plugin fields, redirect-plugin evidence, authentication requirements,
  CORS behavior, and any REST fields added by plugins.
- Current public permalink examples for every content and archive type.
- Repository architecture, all routes, data-fetching entry points, environment
  variables, caching, WordPress-side code, deployment scripts, existing checks,
  and which directories the type checker and linter exclude.

Use multiple samples and pagination where needed. Redact secrets and personal
data. Do not write credentials or private endpoint responses into the
repository.

Write `docs/wp-discovery.md` containing:
1. Facts observed, with the endpoint or file that proves each fact.
2. A content inventory table.
3. A route/permalink inventory table.
4. A media and body-HTML compatibility table.
5. Hosting facts known versus still unknown.
6. BLOCKERS: CMS-side or environment problems that make live verification
   meaningless until fixed. For each, give the exact command that fixes it and
   mark who must run it. PRESSY_SSH with PRESSY_WP_DIR means you can run wp-cli
   on the WordPress host and fix it yourself; without them, hand it back. At
   minimum check, and
   list if broken:
   - `siteurl`/`home` pointing at a host other than `WP_URL`, which makes
     every media URL and admin link wrong;
   - a missing or unfilled local environment file, which means nothing can be
     verified against the real site;
   - REST endpoints that require authentication when the plan assumes public
     access.
7. Risks and unknowns, without proposing architecture yet.

If any blocker is marked human-only, stop and report it before starting Part B.

PART B — DECIDE

Create an implementation decision record for this specific site. Do not code
yet.

For each decision below, choose one option using observed evidence. If the
evidence is insufficient and the choice materially changes the implementation,
ask one concise question. Otherwise choose the safest reversible default and
label it as an assumption.

Decide:
- Which WordPress post types become public content, which are ignored, and the
  normalized domain model for each.
- Whether WordPress pages, a posts index, or a custom composition owns the home
  page.
- Which taxonomies and authors get public archives.
- Whether navigation comes from WordPress menus, page hierarchy, explicit
  configuration, or a combination.
- The public permalink for each content and archive type, including pagination
  and search.
- The legacy WordPress URLs that need redirects and the canonical URL for every
  public route.
- Whether the CMS and app use separate hosts, the same host with a path prefix,
  or an external reverse proxy.
- Which WordPress paths must bypass the app: at minimum admin, login, REST,
  media, includes, cron, AJAX, previews, feeds as applicable, and editor escape
  hatches.
- Static, dynamic, or hybrid rendering per route.
- Cache lifetime, cache tags, webhook invalidation, draft/preview behavior, and
  failure behavior.
- WordPress HTML strategy: trusted pass-through, sanitized React rendering,
  block-aware rendering, or another justified approach.
- Image strategy, including remote hosts, generated sizes, no-upscaling
  behavior, and the no-image layout.
- Search source, SEO metadata source, sitemap/feed policy, structured data,
  locale, and timezone.
- Runtime, build location, environment handling, restart mechanism, rollback,
  and smoke tests for the deployment target. Treat a non-empty
  WORKFLOW_DEPLOYMENT_TARGET as a given and design around it; if it is empty,
  pick the simplest target the topology supports and label it an assumption.
- Scope for the first shippable version and explicitly deferred capabilities.

Write `docs/headless-plan.md` with:
1. Goals and non-goals.
2. A content-type mapping table: WordPress type -> domain type -> list query ->
   detail query -> public route -> cache tags.
3. A public route table: route -> source -> rendering mode -> canonical ->
   invalidation -> empty/error behavior.
4. A URL ownership table showing which system answers every WordPress-sensitive
   path.
5. Architecture boundaries and proposed file map.
6. CROSS-CUTTING CONTRACTS: every artifact that encodes the article URL shape,
   the base path, and the cache-tag vocabulary — including deploy scripts,
   CMS-side PHP, smoke tests and docs. Any later phase that changes one must
   update all of them.
7. Security and secret-handling rules.
8. An ordered implementation plan, dependency-checked: for each step, state what
   breaks if it runs before the step preceding it.
9. Acceptance criteria written as observable outcomes.
10. Assumptions, unknowns, and deferred work.
11. A corrections section, empty for now, for assumptions implementation
    disproves.

Do not silently preserve an existing starter decision. Every retained choice
must be supported by discovery or explicitly marked as a preference.

Stop here. Report the blockers and ask about any decision where the evidence
genuinely forks — at most three questions.
```

Completion contract: both documents exist, observed facts are separated from
unknowns, blockers name their fix and their owner, every public content type,
route, query, cache entry and sensitive WordPress path has an owner and an
acceptance criterion, and no production file has changed.

## Prompt 2 — Resolve blockers, then build

```text
Read WORKFLOW-RULES.md, the repository instructions, `docs/wp-discovery.md` and
`docs/headless-plan.md`.

PHASE 0 — BLOCKERS. Resolve the blockers recorded in discovery that
your WordPress access permits you to fix. Verify each by re-running the
discovery check that found it. Do not proceed while a blocker stands: report it
and stop instead. Live verification against a CMS with a wrong siteurl is worse
than no verification, because it looks like it worked.

Then implement the plan in its dependency order, as the phases below. After
every phase run typecheck, lint, tests AND a production build. A phase is not
done until all four pass. If a directory is excluded from the type checker and
linter, add a syntax gate for it before you edit anything in it.

PHASE A — DATA BOUNDARY
- Use the WordPress core REST API unless the decision record explicitly requires
  an observed plugin endpoint.
- Create one low-level WordPress request layer owning base-URL construction,
  query serialization, timeout, pagination headers, user agent, cache options,
  error reporting and response validation. Pages and components must not
  construct REST URLs.
- Define raw response types only for fields the app reads.
- Normalize raw WordPress objects into stable domain objects. Keep WordPress
  naming and nullable/plugin-specific shapes out of presentation components.
- Put page-facing queries in a separate module. Each declares cache tags and has
  deterministic empty/failure behavior.
- Support pagination beyond WordPress's per-page limit where enumeration is
  required.
- A failed public WordPress request must not crash a render unless the plan says
  the route cannot degrade.
- No client-side content fetching.
- Add tests for URL construction, pagination metadata, normalization, missing
  embeds, missing images, entity decoding and API failures. Use fixtures taken
  from real CMS responses, not idealised ones.
- Keep modules importable by the test runner: a renderer that can only be
  imported through the framework's own resolver cannot be tested.

PHASE B — ROUTES AND URL PARITY
- Centralize route builders. Do not hand-build the same route in pages,
  components, metadata, feeds, redirects or the CMS bridge.
- Preserve page hierarchy where required, with cycle and missing-parent
  protection.
- Resolve route collisions explicitly: posts, pages, date segments, reserved
  routes, custom post types and pagination segments.
- Generate or dynamically resolve paths per the route table; do not enumerate
  unbounded archives without a reason.
- Correct non-canonical but recognizable URLs with permanent redirects.
- Return a real not-found result for unknown resources and impossible page
  numbers.
- Give every route its planned empty state and CMS-failure state.
- Derive the base path from `NEXT_PUBLIC_SITE_URL` in one place. Test a domain-root
  value and one carrying a path prefix: the prefix must appear exactly once in
  every emitted absolute URL, and never in a framework link that already adds
  it. Cover framework links, plain anchors, form actions, redirects, canonical
  URLs, sitemap URLs, feed URLs, assets and webhook URLs.
- Do not assume WordPress's permalink structure matches the public structure.
  Maintain an explicit mapping.
- If this phase changes the URL shape, update every artifact listed under
  cross-cutting contracts in the same phase — deploy smoke tests and CMS-side
  PHP included.

PHASE C — CONTENT AND MEDIA
- Treat WordPress body HTML as content input, not application code.
- Allow only the chosen elements, attributes, URL schemes, classes, iframe hosts
  and script sources. Drop unsafe wrappers without losing safe text where
  practical.
- Remove event handlers and unapproved inline styles. Add `noopener noreferrer`
  to new-window links.
- Rewrite internal WordPress links through the centralized route mapping.
- Give headings stable unique IDs if the site needs anchors or a contents list.
- Preserve semantic HTML and accessibility.
- Render images with known dimensions when available, never upscale, never
  require a featured image for layout, and do not load a full original for a
  small card when a suitable generated size exists.
- Handle unknown dimensions honestly; define behavior for non-image media and
  unexpected MIME types.
- Implement only embed providers observed in discovery or approved in the plan.
- Add fixtures for every observed body element and for malformed/unsafe input.
- Inspect representative output at phone, tablet and desktop widths.

PHASE D — PAGES AND PRESENTATION
- Do not copy this starter's newspaper layout unless the plan chose a
  publication front.
- Derive navigation and labels from the configured source.
- Implement the chosen home-page composition and only the archives the content
  model needs.
- Keep presentation components free of data fetching.
- Prefer variants of shared components over duplicates.
- Make every variant work with missing images, excerpts, authors, taxonomies,
  descriptions and empty result sets.
- Avoid repeating auto-generated excerpts at the start of detail bodies.
- Render dates with semantic `<time datetime>` using the chosen locale and
  timezone policy.
- Keep interaction components small; content must be present without client-side
  JavaScript.
- Meet keyboard, focus, heading-order, reduced-motion, target-size, responsive
  and contrast requirements.
- Keep site-specific copy, labels, ordering and branding in one configuration
  boundary or in WordPress.
- Check against real content, not only ideal fixtures.

PHASE E — CACHING AND REVALIDATION
- Inventory every cached query and assign the minimum tags that invalidate all
  its consumers.
- Give every cache a time-based fallback so a broken webhook cannot make content
  stale forever.
- Create an authenticated revalidation endpoint. Accept only planned methods and
  payloads; validate input; never log, echo, commit or expose the secret.
- When a change can remove an item from an old taxonomy, author, menu or parent
  relationship, invalidate both previous and current relationships; if the CMS
  cannot supply previous values, invalidate a broader collection tag.
- Support publish, update, unpublish, trash, restore and deletion for every
  public post type.
- Keep the CMS notification non-blocking.
- Make the CMS bridge inert until both destination and secret are valid.
- The secret lives in the generated, gitignored config file — never
  hand-written into the tracked template that reads it.
- Provide a secret-free status endpoint if operations need one.
- Test rejection without a secret, rejection with a wrong secret, successful
  invalidation, and fallback freshness.
- Record the query-to-tag and event-to-tag matrices in `docs/headless-plan.md`.

PHASE F — SEO, FEEDS AND DISCOVERY
- Produce correct title, description, canonical, Open Graph and social-card data
  for each public route.
- Decide whether social-card images are generated per item, taken from the
  featured image, or a single static fallback. If generated, define behavior for
  no image, a failing remote image, and an overflowing title. Check the
  framework permits the route shape you chose.
- Use absolute public URLs that include any path prefix exactly once.
- Use SEO-plugin fields only when discovery proved they are available and
  stable; define fallbacks.
- Add structured data for the actual content types rather than labeling
  everything an article.
- Generate a sitemap of canonical indexable URLs only, with defensible
  modification dates.
- Generate feeds only for content types that need them, using the configured
  locale and correct media MIME types.
- Keep search and utility endpoints out of the index, and state the
  indexability and canonical of paginated archive pages.
- Preserve intentional legacy URLs with tested permanent redirects.
- Decide which system owns root `robots.txt` when the app is mounted below a
  path.

End with a matrix of implemented queries and their cache tags, and confirmation
that typecheck, lint, tests and build all pass. Update `docs/headless-plan.md`
when implementation disproves an assumption, and record it in the corrections
section.
```

Completion contract: no blocker stands; a page consumes domain objects without
knowing a REST path; every route resolves, redirects, fails and canonicalizes as
documented in both root-domain and path-prefix modes; every observed content
pattern has a fixture and an intentional result; the selected content model is
navigable with rich, sparse and unavailable CMS data; every WordPress content
event has a proven invalidation path; and the production build passes.

## Prompt 3 — Ship

```text
Read WORKFLOW-RULES.md and `docs/headless-plan.md`. Implement the URL ownership
and deployment design. Treat continued WordPress access as a release blocker.

Use the deployment target recorded in the plan as decided. Reopen it only if
this prompt's own checks prove it unworkable, and record that reversal in the
plan's corrections section. Determine the remaining topology from evidence:
never assume this starter's SSH host, panel, port, process manager, path
stripping or same-server setup.

Requirements:
- Ensure the canonical CMS address continues to serve `/wp-admin/`,
  `/wp-login.php`, `/wp-json/`, `/wp-content/`, `/wp-includes/`, AJAX, cron,
  previews, feeds and editor workflows as required.
- If the public app host receives WordPress-sensitive paths, forward or redirect
  them to the CMS without loops, preserving path and query string.
- Redirect only public WordPress theme routes represented in the route mapping.
  Unknown content types must not silently redirect to the home page.
- Provide an authenticated editor escape hatch to the WordPress-rendered view if
  the plan calls for one.
- Detect same-host and path-prefix loops.
- Build and deploy using the target's native approach. Separate build-time
  public configuration, runtime application configuration, and local deployment
  credentials.
- Prevent local environment files and deployment credentials from entering the
  artifact.
- Provide restart, health check, smoke test and rollback procedures.
- If a reverse proxy strips a path prefix, handle it once at the proxy or entry
  boundary and test both stripped and preserved behavior.
- Destructive synchronisation — a mirror that deletes — must be impossible
  against an unresolved, root, home, or CMS directory. Prefer disabling the
  destructive behaviour for those targets over refusing the target: a shared
  directory is a legitimate deployment location, and refusing it removes a
  capability the human may depend on. Refuse only targets that cannot be
  reasoned about at all.
- Every executable in the repository must be syntax-checked by an automated
  gate, including files excluded from the type checker and linter. If no such
  gate exists, add one before relying on those scripts.
- Smoke-test that the deployed response is the application, not merely any HTTP
  200: a CMS front page also returns 200.
- Verify every check this prompt writes against the shapes the system actually
  produces now, not the shapes an earlier phase planned.

Respect WORKFLOW_HOST_RATE_LIMIT throughout. Deployment involves repeated SSH and HTTPS
requests, which is exactly the pattern that triggers an IP ban — and a ban takes
out the deploy channel and the site check together.

Write or update `docs/going-live.md` for this topology. Automate every
deployment failure that can be detected safely.
```

Completion contract: an operator can prove that the app, CMS admin, REST API,
media, webhook and rollback path all work before changing DNS or routing live
traffic.

## Prompt 4 — Audit against reality

```text
Perform a release audit of the finished headless WordPress site. Diagnose and
fix in-scope failures; do not merely list them. Ideally run this with fresh
context: an auditor that also wrote the code is a weak auditor.

Re-read WORKFLOW-RULES.md, the repository instructions, `docs/wp-discovery.md`
and `docs/headless-plan.md`. Then:
- Re-run WordPress discovery and report any drift from the original inventory.
- Re-read every check written by earlier prompts and confirm it still matches
  the shapes the system actually produces. A smoke test grepping for an
  abandoned URL shape is worse than no smoke test.
- Search for hardcoded site names, hosts, slugs, route labels, locale values,
  content-type assumptions, secrets and deployment-provider assumptions outside
  their approved boundaries.
- Verify all content-fetching goes through the data boundary and that
  presentation components do not fetch.
- Test empty WordPress, unreachable WordPress, partial API failures, no images,
  mixed image hosts, missing embeds, malformed HTML, deleted authors, renamed
  slugs, moved pages, empty taxonomies and out-of-range pagination.
- Test every public and protected route from the route and URL-ownership tables.
- Test cache invalidation for create, update, move, rename, unpublish, trash,
  restore and deletion.
- Run type checking, lint with zero warnings, automated tests, a production
  build, and artifact inspection. Confirm the test suite is non-empty and that
  its checks fail when the behavior they cover breaks.
- Run the built app and smoke-test HTML identity, assets, representative detail
  and archive routes, redirects, metadata, feed, sitemap, images, not-found
  behavior, webhook authentication, CMS admin, REST, media and preview access.
- Check responsive behavior and accessibility on representative real content.
- Verify the deployment artifact contains no local environment file, deployment
  password, private key or secret except the intended runtime configuration.

Respect WORKFLOW_HOST_RATE_LIMIT: this prompt is the most request-heavy of the chain.
Batch live checks and keep any sweep small.

Update `docs/going-live.md` with any newly discovered operational failure, its
symptom, cause, fix, and an automated check when possible.

End with a release report containing: passed checks, fixed failures, remaining
blockers, accepted risks, and exact rollback steps. Do not declare success while
a release-blocking check is unverified.
```

Completion contract: the release report is evidence-based, all automated checks
pass, and any unverified external operation is named as a blocker rather than
assumed successful.

## Appendix A — Single-prompt variant

Use this when the site is small, the topology is known, and you are willing to
review at the end. You gain continuity: no hand-offs, and the agent can notice
cross-cutting breakage because it holds the whole shape at once. You lose review
points — a wrong decision at the checkpoint propagates through everything before
anyone sees it — and some context, since a long run compresses its own early
history.

```text
Build a headless WordPress front end from this repository. Read `.env` first:
it names the WordPress install (WP_URL), the public site URL
(NEXT_PUBLIC_SITE_URL), the deployment target (WORKFLOW_DEPLOYMENT_TARGET) and
the limits the host imposes (WORKFLOW_HOST_RATE_LIMIT).

Work in three phases and do not skip the checkpoint between the first and
second.

1. DISCOVER AND DECIDE. Inspect the repository and the WordPress install
   through its public REST API. Do not infer the content model from convention.
   Write docs/wp-discovery.md (facts, with the endpoint or file that proves
   each) and docs/headless-plan.md (decisions, each traced to a fact or
   labelled an assumption). List CMS-side blockers separately, with the command
   that fixes each and who must run it.

   CHECKPOINT: stop. Report the blockers, and ask about any decision where the
   evidence genuinely forks — at most three questions. Do not write code yet.

2. BUILD. Resolve the blockers you can. Then implement the plan in dependency
   order: data boundary, routes and URL parity, content and media rendering,
   pages, caching and revalidation, SEO and feeds. After every phase run
   typecheck, lint, tests and a production build; a phase is not done until all
   four pass. Add tests as you go for anything a future change could silently
   break, using fixtures taken from real CMS responses rather than idealised
   ones.

3. SHIP AND AUDIT. Implement URL ownership and deployment. Continued CMS access
   is a release blocker: prove admin, login, REST, uploads, cron and feeds all
   still work. Write docs/going-live.md. Then audit the finished system against
   the live site, including re-checking every check the earlier phases wrote.

Follow WORKFLOW-RULES.md throughout. Update docs/headless-plan.md whenever
implementation proves an assumption wrong, and say so in its corrections
section.
```

## Appendix B — Adapting after discovery changes

Use this when a site adds a custom post type, changes permalinks, moves hosts,
adopts an SEO plugin, or otherwise invalidates the original plan.

```text
The WordPress or hosting setup has changed. Do not patch the visible symptom
first.

Re-run only the relevant parts of discovery and compare them with
`docs/wp-discovery.md`. Update the facts there. Then update every affected row
in `docs/headless-plan.md`, including content mapping, routes, URL ownership,
cache tags, webhook events, redirects, SEO, deployment and acceptance criteria.
Consult the cross-cutting contracts section before editing: a change to the URL
shape or cache-tag vocabulary touches deploy scripts and CMS-side PHP too.

Produce an impact list before editing production code. Implement the smallest
coherent change across all affected layers. Add a regression check that would
have detected this drift. Run the full verification appropriate to the changed
layers and update `docs/going-live.md` if the change exposed an operational
failure.
```

## What does not get shorter

The two artifacts. `wp-discovery.md` and `headless-plan.md` earn their length:
when something goes wrong, the answer is usually in one of them, and the
corrections section of the plan tends to become the most useful part of the
whole exercise. Compressing the prompts is free; compressing the record is not.
