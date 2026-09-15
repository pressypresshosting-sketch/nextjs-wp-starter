import { site } from "@/lib/site";

export function articlePath(a: { year: string; month: string; slug: string }): string {
  return `/${a.year}/${a.month}/${a.slug}`;
}

function paged(base: string, page?: number): string {
  return page && page > 1 ? `${base}/page/${page}` : base;
}

export function sectionPath(slug: string, page?: number): string {
  return paged(`/section/${slug}`, page);
}

export function topicPath(slug: string, page?: number): string {
  return paged(`/topic/${slug}`, page);
}

export function authorPath(slug: string, page?: number): string {
  return paged(`/author/${slug}`, page);
}

/** A WordPress page lives at its own path, e.g. "/about" or "/about/team". */
export function pagePath(path: string): string {
  return `/${path.replace(/^\/+/, "")}`;
}

export function latestPath(page?: number): string {
  return paged("/latest", page);
}

export function searchPath(q: string): string {
  return `/search?q=${encodeURIComponent(q)}`;
}

/** Absolute public URL: NEXT_PUBLIC_SITE_URL (which already carries /news) plus the app path. */
export function absoluteUrl(path: string): string {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Prefix an app path with the basePath for places Next.js does not handle:
 * plain `<a href>`, `<form action>`, and hrefs injected into WordPress HTML.
 * Do not use with next/link or redirect(), which add the prefix themselves.
 */
export function withBasePath(path: string): string {
  return `${site.basePath}${path.startsWith("/") ? path : `/${path}`}`;
}
