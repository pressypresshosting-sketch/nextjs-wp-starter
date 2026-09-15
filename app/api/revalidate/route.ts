import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { wpGet } from "@/lib/wp/client";
import { tagFor } from "@/lib/wp/queries";
import type { WpPage, WpPost } from "@/lib/wp/types";

/**
 * POST {NEXT_PUBLIC_SITE_URL}/api/revalidate
 * (public URL: https://your-site.example/news/api/revalidate)
 *
 * Header:  x-revalidate-secret: <REVALIDATE_SECRET>
 * Body:    JSON or application/x-www-form-urlencoded with
 *            type        "post" (default) or "page"
 *            slug        the post slug (preferred)
 *            id          WordPress post id, used when slug is absent
 *            categories  category slugs, comma-separated or an array
 *            tags        tag slugs, comma-separated or an array
 *            author      author user_nicename
 *            all         "1"/true to revalidate every list without a lookup
 *
 * Revalidates `posts` (every list), `post:{slug}`, `category:{slug}` for the
 * post's current categories, `tag:{slug}` for its tags and `author:{slug}`.
 * Categories/tags/author from the body are added too, so a post that moved
 * between sections refreshes the section it left. The secret is never
 * logged or echoed.
 */

type Payload = Record<string, unknown>;

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

async function readPayload(request: Request): Promise<Payload> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body: unknown = await request.json();
      return body && typeof body === "object" ? (body as Payload) : {};
    }
    // Form bodies (curl -d 'type=post&slug=...', WordPress wp_remote_post defaults).
    const params = new URLSearchParams(await request.text());
    const payload: Payload = {};
    for (const [key, value] of params) {
      const existing = payload[key];
      payload[key] = existing === undefined ? value : [...list(existing), value];
    }
    return payload;
  } catch {
    return {};
  }
}

async function lookupPage(slug: string, id: string): Promise<WpPage | null> {
  const options = { tags: [], noStore: true };
  if (slug) {
    const pages = await wpGet<WpPage[]>("pages", { slug, per_page: 1 }, options);
    return pages?.[0] ?? null;
  }
  if (/^\d+$/.test(id)) return wpGet<WpPage>(`pages/${id}`, {}, options);
  return null;
}

async function lookupPost(slug: string, id: string): Promise<WpPost | null> {
  const options = { tags: [], embed: ["wp:term", "author"] as const, noStore: true };
  if (slug) {
    const posts = await wpGet<WpPost[]>("posts", { slug, per_page: 1 }, options);
    return posts?.[0] ?? null;
  }
  if (/^\d+$/.test(id)) return wpGet<WpPost>(`posts/${id}`, {}, options);
  return null;
}

export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET;
  const provided = request.headers.get("x-revalidate-secret") ?? "";
  if (!expected || provided.length !== expected.length || provided !== expected) {
    return NextResponse.json({ ok: false, error: "Invalid or missing x-revalidate-secret header." }, { status: 401 });
  }

  const body = await readPayload(request);
  const tags = new Set<string>();
  const type = text(body.type) || "post";
  const all = body.all === true || text(body.all) === "1" || text(body.all) === "true";
  let slug = text(body.slug);

  if (type === "page") {
    // Pages are one tagged list, so "pages" covers the nav, footer, sitemap and every page route.
    tags.add("pages");
    const page = all ? null : await lookupPage(slug, text(body.id ?? body.post_id));
    if (page) slug = page.slug;
    if (slug) tags.add(tagFor.page(slug));
  } else if (all) {
    tags.add("posts");
    tags.add("pages");
  } else {
    tags.add("posts");
    const post = await lookupPost(slug, text(body.id ?? body.post_id));
    if (post) {
      slug = post.slug;
      for (const term of (post._embedded?.["wp:term"] ?? []).flat()) {
        tags.add(term.taxonomy === "category" ? tagFor.section(term.slug) : tagFor.topic(term.slug));
      }
      const author = post._embedded?.author?.[0];
      if (author && "slug" in author && author.slug) tags.add(tagFor.author(author.slug));
    }
    if (slug) tags.add(tagFor.post(slug));
    for (const category of list(body.categories)) tags.add(tagFor.section(category));
    for (const tag of list(body.tags)) tags.add(tagFor.topic(tag));
    for (const author of list(body.author)) tags.add(tagFor.author(author));
  }

  for (const tag of tags) revalidateTag(tag, "max");
  console.info(`[revalidate] ${type} ${slug || "(no slug)"} -> ${[...tags].join(", ")}`);

  return NextResponse.json({ ok: true, type, slug: slug || null, revalidated: [...tags], at: new Date().toISOString() });
}
