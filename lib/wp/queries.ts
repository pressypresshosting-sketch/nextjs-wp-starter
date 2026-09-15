import { site } from "@/lib/site";
import { decodeEntities, stripHtml } from "@/lib/text";
import { wpGet, wpList, wpListAll, wpRootGet } from "./client";
import {
  normalizeArticle,
  normalizeAuthor,
  normalizePage,
  normalizeSection,
  normalizeTopic,
  type Article,
  type Author,
  type Page,
  type Section,
  type Topic,
} from "./normalize";
import type { WpCategory, WpPage, WpPost, WpPostStub, WpTag, WpUser } from "./types";

export interface Paged<T> {
  items: T[];
  page: number;
  total: number;
  totalPages: number;
}

/** Relations to embed on list requests. Keeps payloads smaller than a bare `_embed`. */
const EMBED = ["author", "wp:featuredmedia", "wp:term"] as const;

const TAG_POSTS = "posts";
const TAG_SITE = "site";
const TAG_PAGES = "pages";
export const tagFor = {
  post: (slug: string) => `post:${slug}`,
  page: (slug: string) => `page:${slug}`,
  section: (slug: string) => `category:${slug}`,
  author: (slug: string) => `author:${slug}`,
  topic: (slug: string) => `tag:${slug}`,
};

/* ---------- Site identity ---------- */

export interface SiteInfo {
  name: string;
  description: string;
}

/**
 * Site title and tagline, taken from WordPress itself so that pointing this
 * app at another install brands it correctly with no code change. Values in
 * lib/site.ts override the CMS when set; if WordPress is unreachable or its
 * tagline is empty, a plain fallback is used.
 */
export async function getSiteInfo(): Promise<SiteInfo> {
  const root = await wpRootGet<{ name?: string; description?: string }>("/", { tags: [TAG_SITE] });
  const name = site.name || decodeEntities(root?.name ?? "").trim() || "The Daily";
  const description = site.description || stripHtml(root?.description ?? "") || `Latest stories from ${name}.`;
  return { name, description };
}

function toPaged(result: { items: WpPost[]; total: number; totalPages: number }, page: number): Paged<Article> {
  return {
    items: result.items.map(normalizeArticle),
    page,
    total: result.total,
    totalPages: result.totalPages,
  };
}

const emptyPage = (page: number): Paged<Article> => ({ items: [], page, total: 0, totalPages: 0 });

/* ---------- Articles ---------- */

/** Sticky posts, newest first. Empty when WordPress has none pinned. */
export async function getLeadStories(): Promise<Article[]> {
  const result = await wpList<WpPost>(
    "posts",
    { sticky: true, per_page: 4, status: "publish" },
    { tags: [TAG_POSTS], embed: EMBED },
  );
  return result.items.map(normalizeArticle);
}

export async function getLatest(page = 1, perPage: number = site.perPage): Promise<Paged<Article>> {
  const result = await wpList<WpPost>(
    "posts",
    { page, per_page: perPage, status: "publish" },
    { tags: [TAG_POSTS], embed: EMBED },
  );
  return toPaged(result, page);
}

export async function getBySection(slug: string, page = 1, perPage: number = site.perPage): Promise<Paged<Article>> {
  const section = await getSection(slug);
  if (!section) return emptyPage(page);
  return getBySectionId(section, page, perPage);
}

export async function getBySectionId(
  section: Pick<Section, "id" | "slug">,
  page = 1,
  perPage: number = site.perPage,
  exclude: number[] = [],
): Promise<Paged<Article>> {
  const result = await wpList<WpPost>(
    "posts",
    { categories: section.id, page, per_page: perPage, exclude: exclude.length ? exclude : undefined },
    { tags: [TAG_POSTS, tagFor.section(section.slug)], embed: EMBED },
  );
  return toPaged(result, page);
}

export async function getByTopic(slug: string, page = 1): Promise<Paged<Article>> {
  const topic = await getTopic(slug);
  if (!topic) return emptyPage(page);
  const result = await wpList<WpPost>(
    "posts",
    { tags: topic.id, page, per_page: site.perPage },
    { tags: [TAG_POSTS, tagFor.topic(slug)], embed: EMBED },
  );
  return toPaged(result, page);
}

export async function getByAuthor(slug: string, page = 1): Promise<Paged<Article>> {
  const author = await getAuthor(slug);
  if (!author) return emptyPage(page);
  const result = await wpList<WpPost>(
    "posts",
    { author: author.id, page, per_page: site.perPage },
    { tags: [TAG_POSTS, tagFor.author(slug)], embed: EMBED },
  );
  return toPaged(result, page);
}

export async function getArticle(slug: string): Promise<Article | null> {
  const posts = await wpGet<WpPost[]>(
    "posts",
    { slug, per_page: 1 },
    { tags: [TAG_POSTS, tagFor.post(slug)], embed: true },
  );
  const post = posts?.[0];
  return post ? normalizeArticle(post) : null;
}

/** Newest articles from the article's primary section, excluding itself. */
export async function getMoreFromSection(article: Article, limit = 4): Promise<Article[]> {
  if (!article.section) return [];
  const result = await getBySectionId(article.section, 1, limit, [article.id]);
  return result.items;
}

/**
 * Related articles: those sharing a topic first, then topped up from the
 * same section. Never includes the article itself.
 */
export async function getRelated(article: Article, limit = 4): Promise<Article[]> {
  const related: Article[] = [];
  const seen = new Set<number>([article.id]);

  if (article.topics.length) {
    const byTopic = await wpList<WpPost>(
      "posts",
      { tags: article.topics.map((t) => t.id), exclude: [article.id], per_page: limit },
      { tags: [TAG_POSTS, ...article.topics.map((t) => tagFor.topic(t.slug))], embed: EMBED },
    );
    for (const post of byTopic.items.map(normalizeArticle)) {
      if (!seen.has(post.id)) {
        related.push(post);
        seen.add(post.id);
      }
    }
  }

  if (related.length < limit && article.section) {
    const bySection = await getBySectionId(article.section, 1, limit + related.length, [...seen]);
    for (const post of bySection.items) {
      if (related.length >= limit) break;
      if (!seen.has(post.id)) {
        related.push(post);
        seen.add(post.id);
      }
    }
  }

  return related.slice(0, limit);
}

export async function search(q: string, page = 1): Promise<Paged<Article>> {
  const query = q.trim();
  if (!query) return emptyPage(page);
  const result = await wpList<WpPost>(
    "posts",
    { search: query, page, per_page: site.perPage },
    { tags: [TAG_POSTS], embed: EMBED, revalidate: 120 },
  );
  return toPaged(result, page);
}

/* ---------- Pages ---------- */

/**
 * Every published page, with its full path resolved from the parent chain.
 * Pages are fetched as one list rather than one at a time: a site rarely has
 * more than a few dozen, the hierarchy needs the whole set to compute paths,
 * and one tagged fetch is cheaper to invalidate than many.
 */
export async function getPages(): Promise<Page[]> {
  const raw = await wpListAll<WpPage>(
    "pages",
    { status: "publish", orderby: "menu_order", order: "asc" },
    { tags: [TAG_PAGES], embed: EMBED },
  );
  const byId = new Map(raw.map((p) => [p.id, p]));
  const pathOf = (page: WpPage): string => {
    const parts: string[] = [];
    let current: WpPage | undefined = page;
    for (let guard = 0; current && guard < 20; guard += 1) {
      parts.unshift(current.slug);
      current = current.parent ? byId.get(current.parent) : undefined;
    }
    return parts.join("/");
  };
  return raw
    .map((p) => normalizePage(p, pathOf(p)))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** The page at a path such as ["about", "team"], or null. */
export async function getPageByPath(segments: readonly string[]): Promise<Page | null> {
  const path = segments.join("/");
  if (!path) return null;
  const pages = await getPages();
  return pages.find((p) => p.path === path) ?? null;
}

/** Pages with no parent, in menu order: what the footer lists. */
export async function getTopLevelPages(): Promise<Page[]> {
  return (await getPages()).filter((p) => p.parent === 0);
}

/* ---------- Taxonomies and people ---------- */

/**
 * Sections that actually have stories, in the running order.
 *
 * Everything here is derived from WordPress: categories are never hardcoded.
 * `site.sectionOrder` only pins a few slugs to the front; anything it does
 * not name follows by story count. Empty categories are dropped, so a
 * section that has been emptied disappears from the navigation on the next
 * revalidation instead of leaving a dead link. `site.hiddenSections` is
 * ignored when applying it would leave nothing at all, which is what happens
 * on a site whose posts are all still in "Uncategorized".
 */
export async function getSections(): Promise<Section[]> {
  const categories = await wpListAll<WpCategory>(
    "categories",
    { hide_empty: true, orderby: "count", order: "desc" },
    { tags: [TAG_POSTS] },
  );
  const withStories = categories.filter((c) => c.count > 0).map(normalizeSection);

  const hidden = new Set<string>(site.hiddenSections);
  const visible = withStories.filter((c) => !hidden.has(c.slug));
  const sections = visible.length > 0 ? visible : withStories;

  const order = new Map<string, number>(site.sectionOrder.map((slug, index) => [slug, index]));
  return sections.sort((a, b) => {
    const ai = order.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
    const bi = order.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
    return ai === bi ? b.count - a.count : ai - bi;
  });
}

export async function getSection(slug: string): Promise<Section | null> {
  const categories = await wpGet<WpCategory[]>(
    "categories",
    { slug, per_page: 1 },
    { tags: [TAG_POSTS, tagFor.section(slug)] },
  );
  const category = categories?.[0];
  return category ? normalizeSection(category) : null;
}

export async function getTopics(): Promise<Topic[]> {
  const tags = await wpListAll<WpTag>(
    "tags",
    { hide_empty: true, orderby: "count", order: "desc" },
    { tags: [TAG_POSTS] },
  );
  return tags.filter((t) => t.count > 0).map(normalizeTopic);
}

export async function getTopic(slug: string): Promise<Topic | null> {
  const tags = await wpGet<WpTag[]>("tags", { slug, per_page: 1 }, { tags: [TAG_POSTS, tagFor.topic(slug)] });
  const tag = tags?.[0];
  return tag ? normalizeTopic(tag) : null;
}

export async function getAuthors(): Promise<Author[]> {
  const users = await wpListAll<WpUser>("users", {}, { tags: [TAG_POSTS] });
  return users.map((u) => normalizeAuthor(u)).filter((a): a is Author => a !== null);
}

export async function getAuthor(slug: string): Promise<Author | null> {
  const users = await wpGet<WpUser[]>("users", { slug, per_page: 1 }, { tags: [TAG_POSTS, tagFor.author(slug)] });
  return normalizeAuthor(users?.[0]);
}

/* ---------- Enumeration for static params and sitemap ---------- */

export interface ArticleStub {
  slug: string;
  year: string;
  month: string;
  publishedAt: string;
  updatedAt: string;
}

export async function getAllSlugs(): Promise<ArticleStub[]> {
  const stubs = await wpListAll<WpPostStub>(
    "posts",
    { _fields: "id,slug,date,date_gmt,modified_gmt", status: "publish" },
    { tags: [TAG_POSTS] },
  );
  return stubs.map((s) => {
    const raw = s as WpPostStub & { date_gmt?: string; modified_gmt?: string };
    return {
      slug: s.slug,
      year: s.date.slice(0, 4),
      month: s.date.slice(5, 7),
      publishedAt: `${raw.date_gmt ?? s.date}Z`,
      updatedAt: `${raw.modified_gmt ?? raw.date_gmt ?? s.date}Z`,
    };
  });
}
