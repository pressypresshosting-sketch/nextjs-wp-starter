import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchivePage } from "@/components/ArchivePage";
import { Avatar } from "@/components/Avatar";
import { authorPath } from "@/lib/urls";
import { getAuthor, getByAuthor, getSiteInfo } from "@/lib/wp/queries";

export async function authorMetadata(slug: string, page: number): Promise<Metadata> {
  const [author, { name: siteName }] = await Promise.all([getAuthor(slug), getSiteInfo()]);
  if (!author) return { title: "Author not found", robots: { index: false } };
  return {
    title: page > 1 ? `${author.name}, page ${page}` : author.name,
    description: author.bio || `Stories by ${author.name} on ${siteName}.`,
    alternates: { canonical: authorPath(slug, page) },
  };
}

export async function AuthorArchive({ slug, page }: { slug: string; page: number }) {
  const author = await getAuthor(slug);
  if (!author) notFound();
  const result = await getByAuthor(slug, page);
  if (page > 1 && result.totalPages > 0 && page > result.totalPages) notFound();

  let website: string | null = null;
  if (author.website) {
    try {
      website = new URL(author.website).hostname.replace(/^www\./, "");
    } catch {
      website = null;
    }
  }

  const header = (
    <header className={author.avatar ? "archive-header author-header" : "archive-header author-header no-avatar"}>
      <Avatar author={author} size={96} />
      <div className="row-text">
        <p className="kicker">Author</p>
        <h1 className="headline-page">{author.name}</h1>
        {author.bio ? <p className="prose">{author.bio}</p> : null}
        <p className="meta">
          {result.total ? `${result.total} ${result.total === 1 ? "story" : "stories"}` : null}
          {website ? (
            <>
              {result.total ? " " : null}
              <a href={author.website} rel="me noopener" className="link">
                {website}
              </a>
            </>
          ) : null}
        </p>
      </div>
    </header>
  );

  return (
    <ArchivePage
      title={author.name}
      header={header}
      result={result}
      hrefFor={(n) => authorPath(slug, n)}
      emptyMessage={`${author.name} has not published any stories yet.`}
    />
  );
}
