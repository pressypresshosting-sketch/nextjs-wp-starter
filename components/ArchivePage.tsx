import type { ReactNode } from "react";
import { Pagination } from "@/components/Pagination";
import { StoryList } from "@/components/StoryList";
import type { Article } from "@/lib/wp/normalize";
import type { Paged } from "@/lib/wp/queries";

interface Props {
  title: string;
  kicker?: string;
  intro?: ReactNode;
  /** Replaces the default header entirely (used by the author page). */
  header?: ReactNode;
  /** Rendered between the header and the list (used by search for its form). */
  children?: ReactNode;
  result: Paged<Article>;
  hrefFor: (page: number) => string;
  emptyMessage: string;
  /** Rendered after the empty message (used by search to offer the sections). */
  emptyExtra?: ReactNode;
  previousLabel?: string;
  nextLabel?: string;
}

/** Shared layout for section, topic, author, latest and search pages. */
export function ArchivePage({
  title,
  kicker,
  intro,
  header,
  children,
  result,
  hrefFor,
  emptyMessage,
  emptyExtra,
  previousLabel,
  nextLabel,
}: Props) {
  return (
    <div className="wrap archive">
      {header ?? (
        <header className="archive-header">
          {kicker ? <p className="kicker">{kicker}</p> : null}
          <h1 className="headline-page">{title}</h1>
          {intro ? <p className="meta">{intro}</p> : null}
        </header>
      )}
      {children}
      {result.items.length ? (
        <StoryList articles={result.items} variant="row" headingLevel="h2" />
      ) : (
        <>
          <p className="empty">{emptyMessage}</p>
          {emptyExtra}
        </>
      )}
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={hrefFor}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
      />
    </div>
  );
}
