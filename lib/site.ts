/**
 * Everything that is specific to one publication lives here or in .env.
 * Nothing else in the codebase hardcodes a site name, a section list or a
 * URL, so pointing this front end at a different WordPress means editing
 * WP_URL in .env and, optionally, the preferences below.
 */
export const site = {
  /**
   * Leave empty to use WordPress's own Site Title (Settings > General).
   * Set a string here only to override what the CMS says.
   */
  name: "",
  /** Leave empty to use WordPress's tagline. Used in metadata and the feed. */
  description: "",

  /** Public base URL, including any path prefix the host proxies (e.g. /news). */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /**
   * Path prefix the app is served under, derived from NEXT_PUBLIC_SITE_URL.
   * Empty for a site at a domain root. next/link, next/image and route
   * handlers add it automatically; plain href/action attributes and URLs we
   * build by hand go through `withBasePath()` in lib/urls.ts.
   */
  basePath: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").pathname.replace(/\/$/, ""),

  /** Language tag for date formatting and the html lang attribute. */
  locale: "en-GB",
  /** IANA zone used to print dates. WordPress stores UTC in date_gmt. */
  timeZone: "UTC",

  /**
   * Optional running order for sections in the navigation and on the front
   * page, by category slug. Slugs listed here come first, in this order;
   * every other section follows, most stories first. Sections with no
   * published stories never appear. Unknown slugs are ignored, so this list
   * can name sections that do not exist yet.
   */
  sectionOrder: [] as readonly string[],
  /**
   * Sections to keep out of the navigation and the front page. The archive
   * URL keeps working. WordPress's catch-all "uncategorized" is listed by
   * default, but it is shown anyway when nothing else has stories, so a
   * brand-new site is not left with an empty navigation.
   */
  hiddenSections: ["uncategorized"] as readonly string[],

  /**
   * WordPress pages to show in the main navigation, by slug, in this order.
   * Empty by default, which shows every published top-level page in the order
   * set in WordPress (Page Attributes > Order). List slugs here to show only
   * some pages, or to fix their order. Top-level pages are always listed in
   * the footer, and a page is always reachable at its own path.
   */
  navPages: [] as readonly string[],

  /** Articles per page on archive routes. */
  perPage: 12,
  /** Articles in each front-page section block, including its lead. */
  perSectionBlock: 4,
  /** Skip a front-page section block with fewer than this many unused stories. */
  minSectionBlock: 2,
  /** Stories in the front-page "Latest" list. */
  latestOnFront: 8,
  /** Fallback ISR window in seconds when no revalidation webhook arrives. */
  revalidateSeconds: 600,
} as const;
