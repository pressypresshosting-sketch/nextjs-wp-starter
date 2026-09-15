import { decodeHTML } from "entities";

/** Decode HTML entities such as `&#8217;` and `&hellip;` into characters. */
export function decodeEntities(input: string): string {
  return decodeHTML(input);
}

/** Remove every tag and decode entities, collapsing whitespace. */
export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Turn a WordPress `excerpt.rendered` into plain text: drop the `<p>`
 * wrapper and the auto-generated "Continue reading" link.
 */
export function excerptToText(rendered: string): string {
  const withoutMoreLink = rendered.replace(/<a[^>]*class="[^"]*more-link[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "");
  const text = stripHtml(withoutMoreLink);
  // WordPress leaves a bracketed or bare ellipsis before the removed link.
  return text.replace(/\s*\[?…\]?\s*$/u, "…").replace(/\s*\[&hellip;\]\s*$/u, "…").trim();
}

/** First paragraph of a body as plain text (fallback dek). */
export function firstParagraphText(html: string): string {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return stripHtml(match?.[1] ?? html);
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

/**
 * WordPress generates an excerpt by copying the first ~55 words of the body,
 * so a "dek" is often the opening paragraph again. Detect that so the article
 * page can skip it rather than print the same sentence twice.
 */
export function dekRepeatsBody(dek: string, html: string): boolean {
  if (!dek) return false;
  const head = (t: string) =>
    t
      .replace(/[….]+$/u, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60)
      .toLowerCase();
  const a = head(dek);
  return a.length >= 20 && head(firstParagraphText(html)).startsWith(a.slice(0, 40));
}

export function countWords(text: string): number {
  const words = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return words ? words.length : 0;
}

/** Reading time at a conservative 220 words per minute, minimum one minute. */
export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 220));
}

/** Capitalise the first character only. Used for lowercase term names. */
export function sentenceCase(text: string): string {
  return text.length ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
