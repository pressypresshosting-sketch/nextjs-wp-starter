/**
 * Inspect a WordPress REST API before writing (or trusting) any code.
 *
 *   npm run inspect                       # uses WP_URL from .env
 *   npm run inspect -- https://site.tld   # or pass one explicitly
 *
 * It prints what the API actually returns: how many posts, which categories
 * and tags have content, which image sizes WordPress generated, whether
 * excerpts are hand-written or copied from the body, and which HTML elements
 * appear in post bodies. Every number here is a decision the front end has to
 * make, so read this before styling anything.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function envValue(key) {
  for (const file of [".env.local", ".env", ".env.production"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1 || line.slice(0, eq).trim() !== key) continue;
      return line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return undefined;
}

const WP_URL = (process.argv[2] || process.env.WP_URL || envValue("WP_URL") || "").replace(/\/$/, "");
if (!WP_URL) {
  console.error("No WordPress URL. Set WP_URL in .env or pass one: npm run inspect -- https://example.com");
  process.exit(1);
}

const API = `${WP_URL}/wp-json`;
const headers = { Accept: "application/json", "User-Agent": "pressy-next/1.0" };

async function get(path) {
  const url = `${API}${path}`;
  const response = await fetch(url, { headers });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  if (!type.includes("json")) {
    throw new Error(
      `${url} returned ${type || "no content type"} instead of JSON.\n` +
        "WordPress is serving an HTML page here, which usually means permalinks are set to Plain.\n" +
        "Fix it in Settings > Permalinks (choose Post name) before going further.",
    );
  }
  return { data: await response.json(), headers: response.headers };
}

const pct = (n, total) => (total ? `${Math.round((n / total) * 100)}%` : "0%");
const line = (label, value) => console.log(`  ${String(label).padEnd(28)} ${value}`);
const heading = (text) => console.log(`\n${text}\n${"-".repeat(text.length)}`);

try {
  console.log(`Inspecting ${WP_URL}`);

  /* ---- Site ---- */
  const { data: site } = await get("/");
  heading("Site");
  line("Title", site.name || "(empty)");
  line("Tagline", site.description || "(empty - a fallback is used)");
  line("Timezone", site.timezone_string || `UTC${site.gmt_offset >= 0 ? "+" : ""}${site.gmt_offset ?? 0}`);
  const plugins = ["yoast", "rank_math", "acf", "wpseo"];
  line("Namespaces", (site.namespaces || []).join(", "));

  /* ---- Posts ---- */
  const { data: posts, headers: postHeaders } = await get("/wp/v2/posts?per_page=100&_embed");
  const total = Number(postHeaders.get("X-WP-Total") ?? posts.length);
  const { data: sticky } = await get("/wp/v2/posts?sticky=true&per_page=100");

  heading("Posts");
  line("Published", total);
  if (total > posts.length) line("Inspected", `${posts.length} (first page)`);
  line("Sticky", sticky.length ? `${sticky.length} - used as the lead story` : "0 - the lead falls back to newest");

  const withImage = posts.filter((p) => p._embedded?.["wp:featuredmedia"]?.[0]?.source_url);
  line("With a featured image", `${withImage.length} of ${posts.length} (${pct(withImage.length, posts.length)})`);
  if (withImage.length === 0) console.log("      -> the layout must work on typography alone");
  else if (withImage.length < posts.length) console.log("      -> every card needs a no-image variant");

  const dates = posts.map((p) => p.date).sort();
  line("Date range", posts.length ? `${dates[0]?.slice(0, 10)} to ${dates[dates.length - 1]?.slice(0, 10)}` : "-");
  const uniqueDates = new Set(posts.map((p) => p.date));
  if (posts.length > 3 && uniqueDates.size <= 2) {
    console.log("      -> most posts share a timestamp (generated content); ordering ties break by id");
  }
  const updated = posts.filter((p) => new Date(p.modified_gmt) - new Date(p.date_gmt) > 60000);
  line("Edited after publishing", `${updated.length} (an 'Updated' line shows only for these)`);

  const seoFields = plugins.filter((k) => posts.some((p) => Object.keys(p).some((key) => key.includes(k))));
  line("SEO plugin fields", seoFields.length ? seoFields.join(", ") : "none - metadata is derived from the excerpt");

  /* ---- Excerpts ---- */
  const strip = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();
  const autoExcerpts = posts.filter((p) => {
    const excerpt = strip(p.excerpt?.rendered ?? "");
    const body = strip(p.content?.rendered ?? "");
    return excerpt.length > 20 && body.toLowerCase().startsWith(excerpt.slice(0, 40).toLowerCase());
  });
  const emptyExcerpts = posts.filter((p) => !strip(p.excerpt?.rendered ?? ""));
  heading("Excerpts");
  line("Empty", emptyExcerpts.length);
  line("Copied from the body", `${autoExcerpts.length} of ${posts.length}`);
  if (autoExcerpts.length > posts.length / 2) {
    console.log("      -> WordPress is auto-generating these; the article page hides a dek that repeats the body");
  }
  if (posts.some((p) => (p.excerpt?.rendered ?? "").includes("more-link"))) {
    console.log('      -> excerpts carry a "Continue reading" link that must be stripped');
  }

  /* ---- Body HTML ---- */
  const tags = new Map();
  for (const post of posts) {
    for (const match of (post.content?.rendered ?? "").matchAll(/<([a-z][a-z0-9]*)/gi)) {
      const tag = match[1].toLowerCase();
      tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }
  }
  heading("Body HTML");
  line("Elements used", [...tags.keys()].sort().join(", ") || "(no markup at all)");
  const notable = ["img", "figure", "iframe", "blockquote", "table", "pre", "h2", "ul"];
  const missing = notable.filter((t) => !tags.has(t));
  if (missing.length) console.log(`      -> not present, so untested against real data: ${missing.join(", ")}`);
  const words = posts.map((p) => strip(p.content?.rendered ?? "").split(" ").length);
  line("Average length", `${Math.round(words.reduce((a, b) => a + b, 0) / (words.length || 1))} words`);

  /* ---- Images ---- */
  const sizes = new Map();
  let widest = 0;
  for (const post of withImage) {
    const media = post._embedded["wp:featuredmedia"][0];
    widest = Math.max(widest, media.media_details?.width ?? 0);
    for (const [name, size] of Object.entries(media.media_details?.sizes ?? {})) {
      sizes.set(name, `${size.width}x${size.height}`);
    }
  }
  if (withImage.length) {
    heading("Featured images");
    line("Largest original", `${widest}px wide`);
    for (const [name, dim] of [...sizes].sort()) line(name, dim);
    if (widest < 1200) console.log("      -> too small for a full-width hero; images render at natural size");
    const noAlt = withImage.filter((p) => !p._embedded["wp:featuredmedia"][0].alt_text);
    line("Missing alt text", `${noAlt.length} of ${withImage.length}`);
  }

  /* ---- Pages ---- */
  const { data: pages, headers: pageHeaders } = await get("/wp/v2/pages?per_page=100&_embed");
  const pageTotal = Number(pageHeaders.get("X-WP-Total") ?? pages.length);
  heading("Pages");
  if (pages.length === 0) {
    line("Published", "0 - nothing to route; the footer shows no Pages column");
  } else {
    const byId = new Map(pages.map((p) => [p.id, p]));
    const depthOf = (p) => {
      let d = 0;
      for (let cur = p; cur && cur.parent && byId.has(cur.parent) && d < 20; d += 1) cur = byId.get(cur.parent);
      return d;
    };
    const topLevel = pages.filter((p) => p.parent === 0);
    const maxDepth = Math.max(...pages.map(depthOf));
    const pagesWithImage = pages.filter((p) => p._embedded?.["wp:featuredmedia"]?.[0]?.source_url);
    const templates = [...new Set(pages.map((p) => p.template).filter(Boolean))];
    line("Published", pageTotal);
    line("Top level", `${topLevel.length}: ${topLevel.map((p) => p.slug).join(", ")}`);
    line("Deepest nesting", maxDepth === 0 ? "none, all top level" : `${maxDepth} level${maxDepth > 1 ? "s" : ""}`);
    line("With a featured image", `${pagesWithImage.length} of ${pages.length}`);
    line("Custom templates", templates.length ? `${templates.join(", ")} (ignored: the app has one page layout)` : "none");
    console.log("      -> each page is served at its own path, e.g. /" + (topLevel[0]?.slug ?? "about"));
    console.log("      -> top-level pages form the main nav and the footer list; set site.navPages to pick or reorder them");
    if (site.show_on_front === "page") {
      console.log("      -> WordPress shows a static page on its front; the app's front page stays the news front");
    }
  }

  /* ---- Taxonomies and authors ---- */
  const { data: categories } = await get("/wp/v2/categories?per_page=100&hide_empty=false");
  const { data: postTags } = await get("/wp/v2/tags?per_page=100&hide_empty=false");
  const { data: users } = await get("/wp/v2/users?per_page=100");

  const used = categories.filter((c) => c.count > 0);
  const empty = categories.filter((c) => c.count === 0);
  heading("Categories (front-end sections)");
  for (const c of used.sort((a, b) => b.count - a.count)) line(c.slug, `${c.count} ${c.count === 1 ? "post" : "posts"}`);
  if (empty.length) line("(empty, hidden)", empty.map((c) => c.slug).join(", "));
  const realSections = used.filter((c) => c.slug !== "uncategorized");
  if (realSections.length === 0) {
    console.log("      -> everything is in Uncategorized, so the nav shows it and kickers are suppressed");
    console.log("      -> create real categories in WordPress to get section blocks on the front page");
  } else {
    console.log(`      -> suggested lib/site.ts sectionOrder: [${realSections.slice(0, 6).map((c) => `"${c.slug}"`).join(", ")}]`);
  }

  heading("Tags (front-end topics)");
  const usedTags = postTags.filter((t) => t.count > 0);
  line("With posts", usedTags.length ? usedTags.map((t) => `${t.slug} (${t.count})`).join(", ") : "none");

  heading("Authors");
  for (const u of users) {
    line(u.slug, `${u.name}${u.description ? "" : "  (no bio - the bio block is omitted)"}`);
  }

  heading("Verdict");
  console.log("  Copy the numbers above into docs/api-notes.md before you design against them.");
  console.log("  Anything marked '->' is a decision the front end already handles; check it still fits.");
} catch (error) {
  console.error(`\nInspection failed: ${error.message}`);
  process.exit(1);
}
