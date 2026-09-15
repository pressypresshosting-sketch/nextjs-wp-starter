import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { authorPath } from "@/lib/urls";
import type { Author } from "@/lib/wp/normalize";

/** End-of-article author card. Bio and website are omitted when empty. */
export function AuthorCard({ author }: { author: Author }) {
  const headingId = `author-card-${author.slug}`;
  return (
    <aside aria-labelledby={headingId} className={author.avatar ? "author-card" : "author-card no-avatar"}>
      <Avatar author={author} size={96} />
      <div className="author-card-text">
        <p className="meta">Written by</p>
        <h2 id={headingId} className="headline-secondary">
          <Link href={authorPath(author.slug)}>{author.name}</Link>
        </h2>
        {author.bio ? <p className="prose">{author.bio}</p> : null}
        <p className="meta">
          <Link href={authorPath(author.slug)}>All stories by {author.name}</Link>
        </p>
      </div>
    </aside>
  );
}
