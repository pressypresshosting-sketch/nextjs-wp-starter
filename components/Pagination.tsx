import Link from "next/link";

interface Props {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  previousLabel?: string;
  nextLabel?: string;
}

/** Previous/next links with a plain "Page x of y" count. */
export function Pagination({
  page,
  totalPages,
  hrefFor,
  previousLabel = "Newer stories",
  nextLabel = "Older stories",
}: Props) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="pagination">
      <div>
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} rel="prev">
            {previousLabel}
          </Link>
        ) : null}
      </div>
      <p className="meta">
        Page {page} of {totalPages}
      </p>
      <div>
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} rel="next">
            {nextLabel}
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
