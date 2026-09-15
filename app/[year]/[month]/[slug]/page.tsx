import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArticleBody } from "@/components/ArticleBody";
import { AuthorCard } from "@/components/AuthorCard";
import { Byline } from "@/components/Byline";
import { Dateline } from "@/components/Dateline";
import { pageMetadata, StaticPage } from "@/components/StaticPage";
import { StoryList } from "@/components/StoryList";
import { TableOfContents } from "@/components/TableOfContents";
import { TagList } from "@/components/TagList";
import { WpImage } from "@/components/WpImage";
import { renderWpHtml } from "@/lib/html/render";
import { site } from "@/lib/site";
import { dekRepeatsBody, truncate } from "@/lib/text";
import { absoluteUrl, authorPath, sectionPath } from "@/lib/urls";
import { getAllSlugs, getArticle, getMoreFromSection, getPageByPath, getRelated, getSiteInfo } from "@/lib/wp/queries";

export const revalidate = 600;

interface Props {
  params: Promise<{ year: string; month: string; slug: string }>;
}

export async function generateStaticParams() {
  const stubs = await getAllSlugs();
  return stubs.map(({ year, month, slug }) => ({ year, month, slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year, month, slug } = await params;
  const [article, { name: siteName }] = await Promise.all([getArticle(slug), getSiteInfo()]);
  if (!article) {
    // A WordPress page nested two deep has this shape, e.g. /about/team/history.
    const page = await getPageByPath([year, month, slug]);
    return page ? pageMetadata(page, siteName) : { title: "Story not found", robots: { index: false } };
  }

  const description = truncate(article.dek || article.title, 160);
  return {
    title: article.title,
    description,
    alternates: { canonical: article.url },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: absoluteUrl(article.url),
      siteName,
      locale: site.locale.replace("-", "_"),
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: article.author ? [absoluteUrl(authorPath(article.author.slug))] : undefined,
      section: article.section?.name,
      tags: article.topics.map((t) => t.name),
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { year, month, slug } = await params;
  const article = await getArticle(slug);
  if (!article) {
    const [page, { name }] = await Promise.all([getPageByPath([year, month, slug]), getSiteInfo()]);
    if (page) return <StaticPage page={page} siteName={name} />;
    notFound();
  }
  if (article.year !== year || article.month !== month) permanentRedirect(article.url);

  const [moreFromSection, relatedRaw, { name: siteName }] = await Promise.all([
    getMoreFromSection(article),
    getRelated(article),
    getSiteInfo(),
  ]);
  const shown = new Set(moreFromSection.map((a) => a.id));
  const related = relatedRaw.filter((a) => !shown.has(a.id));

  // Rendered once here so the table of contents and the body agree on ids.
  const { nodes, headings } = renderWpHtml(article.html);

  const { image, author, section } = article;
  const captionParts = image ? [image.caption, image.credit].filter(Boolean) : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.dek || undefined,
    image: image ? [image.src] : undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: author
      ? [{ "@type": "Person", name: author.name, url: absoluteUrl(authorPath(author.slug)) }]
      : [{ "@type": "Organization", name: siteName, url: site.url }],
    publisher: { "@type": "Organization", name: siteName, url: site.url },
    mainEntityOfPage: absoluteUrl(article.url),
    articleSection: section?.name,
    keywords: article.topics.length ? article.topics.map((t) => t.name).join(", ") : undefined,
    wordCount: article.wordCount,
  };

  return (
    <article className="wrap article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <header className="article-header">
        {section ? (
          <p className="kicker">
            <Link href={sectionPath(section.slug)}>{section.name}</Link>
          </p>
        ) : null}
        <h1 className="headline-article">{article.title}</h1>
        {article.dek && !dekRepeatsBody(article.dek, article.html) ? <p className="dek">{article.dek}</p> : null}
        <Byline article={article} withAvatar dateStyle="long" />
        <Dateline article={article} />
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

      <footer className="article-footer">
        {article.topics.length ? (
          <section aria-labelledby="topics-heading" className="section-block">
            <h2 id="topics-heading" className="meta">
              Topics
            </h2>
            <TagList topics={article.topics} />
          </section>
        ) : null}

        {section && moreFromSection.length ? (
          <section aria-labelledby="more-heading" className="section-block">
            <div className="block-heading">
              <h2 id="more-heading" className="section-heading">
                <Link href={sectionPath(section.slug)}>More from {section.name}</Link>
              </h2>
            </div>
            <StoryList articles={moreFromSection} />
          </section>
        ) : null}

        {related.length ? (
          <section aria-labelledby="related-heading" className="section-block">
            <div className="block-heading">
              <h2 id="related-heading" className="section-heading">
                Related stories
              </h2>
            </div>
            <StoryList articles={related} />
          </section>
        ) : null}

        {author ? <AuthorCard author={author} /> : null}
      </footer>
    </article>
  );
}
