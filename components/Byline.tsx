import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { formatDate } from "@/lib/dates";
import { authorPath } from "@/lib/urls";
import type { Article } from "@/lib/wp/normalize";

interface Props {
  article: Article;
  withAvatar?: boolean;
  dateStyle?: "short" | "long";
  /** Append the estimated reading time, as on the lead and article pages. */
  withReadingTime?: boolean;
}

/** Author link (when there is one), publication time and optional reading time. */
export function Byline({ article, withAvatar = false, dateStyle = "short", withReadingTime = false }: Props) {
  const { author, publishedAt, readingMinutes } = article;
  return (
    <p className="byline meta">
      {author ? (
        <span>
          By{" "}
          <Link href={authorPath(author.slug)} className="byline-author">
            {withAvatar ? <Avatar author={author} size={24} /> : null}
            {author.name}
          </Link>
        </span>
      ) : null}
      <time dateTime={publishedAt}>{formatDate(publishedAt, dateStyle)}</time>
      {withReadingTime ? <span>{readingMinutes} min read</span> : null}
    </p>
  );
}
