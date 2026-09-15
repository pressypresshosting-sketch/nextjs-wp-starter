import { formatRfc822 } from "@/lib/dates";
import { site } from "@/lib/site";
import { absoluteUrl, authorPath, sectionPath } from "@/lib/urls";
import { getLatest, getSiteInfo } from "@/lib/wp/queries";

export const revalidate = 600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(value: string): string {
  return `<![CDATA[${value.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

/** RSS 2.0 feed of the latest 50 stories. */
export async function GET() {
  const [latest, { name, description }] = await Promise.all([getLatest(1, 50), getSiteInfo()]);
  const newest = latest.items[0];

  const items = latest.items
    .map((article) => {
      const url = absoluteUrl(article.url);
      const categories = [
        ...article.sections.map((s) => `<category domain="${escapeXml(absoluteUrl(sectionPath(s.slug)))}">${escapeXml(s.name)}</category>`),
        ...article.topics.map((t) => `<category>${escapeXml(t.name)}</category>`),
      ].join("");
      const author = article.author
        ? `<dc:creator>${escapeXml(article.author.name)}</dc:creator><author>${escapeXml(absoluteUrl(authorPath(article.author.slug)))}</author>`
        : "";
      const enclosure = article.image
        ? `<enclosure url="${escapeXml(article.image.src)}" type="image/jpeg" length="0" />`
        : "";
      return `<item>
  <title>${escapeXml(article.title)}</title>
  <link>${escapeXml(url)}</link>
  <guid isPermaLink="true">${escapeXml(url)}</guid>
  <pubDate>${formatRfc822(article.publishedAt)}</pubDate>
  ${author}
  ${categories}
  <description>${escapeXml(article.dek)}</description>
  <content:encoded>${cdata(article.html)}</content:encoded>
  ${enclosure}
</item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${escapeXml(name)}</title>
  <link>${escapeXml(site.url)}</link>
  <description>${escapeXml(description)}</description>
  <language>${escapeXml(site.locale.toLowerCase())}</language>
  <lastBuildDate>${formatRfc822(newest?.publishedAt ?? new Date().toISOString())}</lastBuildDate>
  <atom:link href="${escapeXml(absoluteUrl("/feed.xml"))}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
    },
  });
}
