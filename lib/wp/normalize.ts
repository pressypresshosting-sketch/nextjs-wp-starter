import { gmtToIso } from "@/lib/dates";
import {
  countWords,
  decodeEntities,
  excerptToText,
  firstParagraphText,
  readingMinutes,
  stripHtml,
  truncate,
} from "@/lib/text";
import { articlePath } from "@/lib/urls";
import type { WpCategory, WpEmbedError, WpMedia, WpPage, WpPost, WpTag, WpTerm, WpUser } from "./types";

/* ---------- Domain types ---------- */

export interface ImageSize {
  name: string;
  width: number;
  height: number;
  url: string;
}

export interface Image {
  id: number;
  /** URL of the original file. */
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  credit: string;
  /** Sizes WordPress generated, ascending by width, excluding the original. */
  sizes: ImageSize[];
}

export interface Section {
  id: number;
  slug: string;
  name: string;
  description: string;
  count: number;
}

export interface Topic {
  id: number;
  slug: string;
  name: string;
  count: number;
}

export interface Author {
  id: number;
  slug: string;
  name: string;
  bio: string;
  website: string;
  /** Gravatar URL at 96px; the image loader rewrites `s=` for other sizes. */
  avatar: string | null;
}

export interface Article {
  id: number;
  slug: string;
  title: string;
  dek: string;
  /** Raw WordPress body HTML; sanitised at render time. */
  html: string;
  publishedAt: string;
  updatedAt: string;
  /** True when WordPress reports a modified time later than publication. */
  wasUpdated: boolean;
  year: string;
  month: string;
  url: string;
  sticky: boolean;
  section: Section | null;
  sections: Section[];
  topics: Topic[];
  author: Author | null;
  image: Image | null;
  wordCount: number;
  readingMinutes: number;
}

export interface Page {
  id: number;
  slug: string;
  /** Slugs of the page and its ancestors joined with "/", e.g. "about/team". */
  path: string;
  url: string;
  title: string;
  dek: string;
  html: string;
  parent: number;
  order: number;
  image: Image | null;
  publishedAt: string;
  updatedAt: string;
  wasUpdated: boolean;
  wordCount: number;
  readingMinutes: number;
}

/* ---------- Helpers ---------- */

function isEmbedError(value: unknown): value is WpEmbedError {
  return typeof value === "object" && value !== null && "code" in value && !("slug" in value);
}

/**
 * The `src` to hand to next/image for a WordPress image. Encodes the
 * generated sizes so lib/image-loader.ts can pick one without any lookup.
 */
export function imageSrc(image: Image): string {
  if (!image.sizes.length) return image.src;
  const encoded = image.sizes.map((s) => `${s.width}x${s.height}`).join(",");
  return `${image.src}${image.src.includes("?") ? "&" : "?"}wps=${encoded}`;
}

/** The largest generated size whose width is at most `maxWidth`, else the original. */
export function imageSizeFor(image: Image, maxWidth: number): ImageSize {
  const fit = [...image.sizes].reverse().find((s) => s.width <= maxWidth);
  return fit ?? { name: "full", width: image.width, height: image.height, url: image.src };
}

/* ---------- Normalisers ---------- */

export function normalizeImage(media: WpMedia | WpEmbedError | undefined): Image | null {
  if (!media || isEmbedError(media) || !media.source_url) return null;
  const details = media.media_details ?? {};
  const width = details.width ?? 0;
  const height = details.height ?? 0;
  if (!width || !height) return null;

  const sizes: ImageSize[] = Object.entries(details.sizes ?? {})
    .filter(([name, size]) => name !== "full" && size.width > 0 && size.height > 0 && size.width < width)
    .map(([name, size]) => ({ name, width: size.width, height: size.height, url: size.source_url }))
    .sort((a, b) => a.width - b.width);

  const meta = details.image_meta ?? {};
  return {
    id: media.id,
    src: details.sizes?.full?.source_url ?? media.source_url,
    width,
    height,
    alt: decodeEntities(media.alt_text ?? "").trim(),
    caption: stripHtml(media.caption?.rendered ?? ""),
    credit: (meta.credit || meta.copyright || "").trim(),
    sizes,
  };
}

export function normalizeAuthor(user: WpUser | WpEmbedError | undefined): Author | null {
  if (!user || isEmbedError(user) || !user.slug) return null;
  // Drop WordPress's fixed `s=` size so the image loader always sets its own;
  // an unchanged URL would make next/image think the loader ignores width.
  let avatar: string | null = user.avatar_urls?.["96"] ?? user.avatar_urls?.["48"] ?? null;
  if (avatar) {
    try {
      const url = new URL(avatar);
      url.searchParams.delete("s");
      avatar = url.toString();
    } catch {
      avatar = null;
    }
  }
  return {
    id: user.id,
    slug: user.slug,
    name: decodeEntities(user.name ?? "").trim() || user.slug,
    bio: stripHtml(user.description ?? ""),
    website: user.url ?? "",
    avatar,
  };
}

export function normalizeSection(term: WpCategory | WpTerm): Section {
  return {
    id: term.id,
    slug: term.slug,
    name: decodeEntities(term.name),
    description: "description" in term ? stripHtml(term.description ?? "") : "",
    count: "count" in term ? term.count : 0,
  };
}

export function normalizeTopic(term: WpTag | WpTerm): Topic {
  return {
    id: term.id,
    slug: term.slug,
    name: decodeEntities(term.name),
    count: "count" in term ? term.count : 0,
  };
}

/** `path` is computed by the caller, which has the whole page list and can walk parents. */
export function normalizePage(page: WpPage, path: string): Page {
  const html = page.content?.rendered ?? "";
  const bodyText = stripHtml(html);
  const excerpt = excerptToText(page.excerpt?.rendered ?? "");
  const publishedAt = gmtToIso(page.date_gmt);
  const updatedAt = gmtToIso(page.modified_gmt || page.date_gmt);
  const wordCount = countWords(bodyText);
  return {
    id: page.id,
    slug: page.slug,
    path,
    url: `/${path}`,
    title: decodeEntities(page.title?.rendered ?? "").trim() || page.slug,
    dek: excerpt || (bodyText ? truncate(firstParagraphText(html), 200) : ""),
    html,
    parent: page.parent,
    order: page.menu_order,
    image: normalizeImage(page._embedded?.["wp:featuredmedia"]?.[0]),
    publishedAt,
    updatedAt,
    wasUpdated: new Date(updatedAt).getTime() - new Date(publishedAt).getTime() > 60_000,
    wordCount,
    readingMinutes: readingMinutes(wordCount),
  };
}

export function normalizeArticle(post: WpPost): Article {
  const embedded = post._embedded ?? {};
  const termGroups = embedded["wp:term"] ?? [];
  const categories = termGroups.flat().filter((t) => t.taxonomy === "category");
  const tags = termGroups.flat().filter((t) => t.taxonomy === "post_tag");

  const html = post.content?.rendered ?? "";
  const bodyText = stripHtml(html);
  const excerpt = excerptToText(post.excerpt?.rendered ?? "");
  const dek = excerpt || (bodyText ? truncate(firstParagraphText(html), 200) : "");

  const publishedAt = gmtToIso(post.date_gmt);
  const updatedAt = gmtToIso(post.modified_gmt || post.date_gmt);
  const year = post.date.slice(0, 4);
  const month = post.date.slice(5, 7);
  const wordCount = countWords(bodyText);

  return {
    id: post.id,
    slug: post.slug,
    title: decodeEntities(post.title?.rendered ?? "").trim() || post.slug,
    dek,
    html,
    publishedAt,
    updatedAt,
    wasUpdated: new Date(updatedAt).getTime() - new Date(publishedAt).getTime() > 60_000,
    year,
    month,
    url: articlePath({ year, month, slug: post.slug }),
    sticky: Boolean(post.sticky),
    section: categories[0] ? normalizeSection(categories[0]) : null,
    sections: categories.map(normalizeSection),
    topics: tags.map(normalizeTopic),
    author: normalizeAuthor(embedded.author?.[0]),
    image: normalizeImage(embedded["wp:featuredmedia"]?.[0]),
    wordCount,
    readingMinutes: readingMinutes(wordCount),
  };
}
