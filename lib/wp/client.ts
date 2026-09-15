import { site } from "@/lib/site";

/**
 * One typed fetch wrapper around the WordPress core REST API.
 *
 * - Builds URLs against WP_URL/wp-json/wp/v2.
 * - Adds `_embed` when asked.
 * - Reads X-WP-Total / X-WP-TotalPages for pagination.
 * - Uses the Next.js data cache with tags and a revalidate fallback.
 * - Never throws into a page render: failures are logged and surface as
 *   `null` (single object) or an empty list.
 */

export const WP_URL = (process.env.WP_URL ?? "").replace(/\/$/, "");

if (!WP_URL) {
  throw new Error(
    "WP_URL is not set. Copy .env.example to .env and point WP_URL at your WordPress site, e.g. WP_URL=https://example.com",
  );
}
const API_BASE = `${WP_URL}/wp-json/wp/v2`;
/** WordPress shares the container with this app; a slow PHP worker must not hang page generation. */
const TIMEOUT_MS = 10_000;
const USER_AGENT = "pressy-next/1.0";

export type ParamValue = string | number | boolean | ReadonlyArray<string | number> | undefined;
export type Params = Record<string, ParamValue>;

export interface FetchOptions {
  /** Cache tags for on-demand revalidation. */
  tags: readonly string[];
  /** Seconds before the data cache revalidates on its own. */
  revalidate?: number;
  /** Include `_embed`. Pass a list to embed only some relations. */
  embed?: boolean | readonly string[];
  /** Bypass the data cache entirely (used by the revalidation webhook). */
  noStore?: boolean;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  totalPages: number;
}

function buildUrl(path: string, params: Params, embed: FetchOptions["embed"]): string {
  const url = new URL(`${API_BASE}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  if (embed === true) url.searchParams.set("_embed", "1");
  else if (Array.isArray(embed) && embed.length) url.searchParams.set("_embed", embed.join(","));
  return url.toString();
}

interface RawResponse {
  data: unknown;
  headers: Headers;
}

async function request(path: string, params: Params, options: FetchOptions): Promise<RawResponse | null> {
  const url = buildUrl(path, params, options.embed);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(options.noStore
        ? { cache: "no-store" as const }
        : {
            next: {
              tags: [...options.tags],
              revalidate: options.revalidate ?? site.revalidateSeconds,
            },
          }),
    });

    if (!response.ok) {
      // WordPress answers 400 `rest_post_invalid_page_number` for a page past
      // the end of a collection. That is an empty page, not an error.
      if (response.status === 400) {
        const body = (await response.json().catch(() => null)) as { code?: string } | null;
        if (body?.code === "rest_post_invalid_page_number") {
          return { data: [], headers: response.headers };
        }
      }
      console.error(`[wp] ${response.status} ${response.statusText} for ${url}`);
      return null;
    }

    return { data: await response.json(), headers: response.headers };
  } catch (error) {
    console.error(`[wp] request failed for ${url}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Fetch from the API root rather than the wp/v2 namespace, e.g. `/wp-json/`
 * itself, which carries the site title, tagline and timezone.
 */
export async function wpRootGet<T>(path: string, options: FetchOptions): Promise<T | null> {
  const url = `${WP_URL}/wp-json${path}`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { tags: [...options.tags], revalidate: options.revalidate ?? site.revalidateSeconds },
    });
    if (!response.ok) {
      console.error(`[wp] ${response.status} for ${url}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[wp] request failed for ${url}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/** Fetch a single resource (or a filtered collection you will unwrap). */
export async function wpGet<T>(path: string, params: Params, options: FetchOptions): Promise<T | null> {
  const result = await request(path, params, options);
  return result ? (result.data as T) : null;
}

/** Fetch a collection with pagination metadata. */
export async function wpList<T>(path: string, params: Params, options: FetchOptions): Promise<ListResult<T>> {
  const result = await request(path, params, options);
  if (!result || !Array.isArray(result.data)) {
    return { items: [], total: 0, totalPages: 0 };
  }
  const total = Number(result.headers.get("X-WP-Total") ?? result.data.length);
  const totalPages = Number(result.headers.get("X-WP-TotalPages") ?? (result.data.length ? 1 : 0));
  return {
    items: result.data as T[],
    total: Number.isFinite(total) ? total : result.data.length,
    totalPages: Number.isFinite(totalPages) ? totalPages : 1,
  };
}

/** Walk every page of a collection (used for slugs, sections and topics). */
export async function wpListAll<T>(path: string, params: Params, options: FetchOptions): Promise<T[]> {
  const perPage = 100;
  const first = await wpList<T>(path, { ...params, per_page: perPage, page: 1 }, options);
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await wpList<T>(path, { ...params, per_page: perPage, page }, options);
    items.push(...next.items);
  }
  return items;
}
