import type { Metadata } from "next";
import { ArticleBody } from "@/components/ArticleBody";
import { TableOfContents } from "@/components/TableOfContents";
import { WpImage } from "@/components/WpImage";
import { formatDate } from "@/lib/dates";
import { renderWpHtml } from "@/lib/html/render";
import { site } from "@/lib/site";
import { dekRepeatsBody, truncate } from "@/lib/text";
import { absoluteUrl } from "@/lib/urls";
import type { Page } from "@/lib/wp/normalize";

/** Metadata for a WordPress page. Shared by the catch-all route and the article route's fallback. */
export function pageMetadata(page: Page, siteName: string): Metadata {
  const description = truncate(page.dek || page.title, 160);
  return {
    title: page.title,
    description,
    alternates: { canonical: page.url },
    openGraph: {
      type: "website",
      title: page.title,
      description,
      url: absoluteUrl(page.url),
      siteName,
      locale: site.locale.replace("-", "_"),
    },
    twitter: { card: "summary_large_image", title: page.title, description },
  };
}

/**
 * A WordPress page: title, optional image, body with a table of contents.
 * No kicker, byline, tags or related stories, because a page has none of
 * those. The "Updated" line appears only when the page has been edited.
 */
export function StaticPage({ page, siteName }: { page: Page; siteName: string }) {
  const { nodes, headings } = renderWpHtml(page.html);
  const { image } = page;
  const captionParts = image ? [image.caption, image.credit].filter(Boolean) : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.dek || undefined,
    url: absoluteUrl(page.url),
    dateModified: page.updatedAt,
    isPartOf: { "@type": "WebSite", name: siteName, url: site.url },
  };

  return (
    <article className="wrap article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <header className="article-header">
        <h1 className="headline-article">{page.title}</h1>
        {page.dek && !dekRepeatsBody(page.dek, page.html) ? <p className="dek">{page.dek}</p> : null}
        {page.wasUpdated ? (
          <p className="meta">
            Updated <time dateTime={page.updatedAt}>{formatDate(page.updatedAt, "long")}</time>
          </p>
        ) : null}
      </header>

      {image ? (
        <figure className="article-figure">
          <WpImage image={image} width={800} priority />
          {captionParts.length ? (
            <figcaption className="caption">
              {image.caption ? <span>{image.caption} </span> : null}
              {image.credit ? <span className="credit">{image.credit}</span> : null}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="article-layout">
        <TableOfContents headings={headings} />
        <div className="article-main">
          <ArticleBody nodes={nodes} />
        </div>
      </div>
    </article>
  );
}
