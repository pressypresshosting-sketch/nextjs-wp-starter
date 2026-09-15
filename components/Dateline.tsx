import { formatDate } from "@/lib/dates";
import type { Article } from "@/lib/wp/normalize";

/** Published time, updated time when it differs, and reading time. */
export function Dateline({ article }: { article: Article }) {
  return (
    <div className="dateline meta">
      <p>
        Published <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, "datetime")}</time>
      </p>
      {article.wasUpdated ? (
        <p>
          Updated <time dateTime={article.updatedAt}>{formatDate(article.updatedAt, "datetime")}</time>
        </p>
      ) : null}
      <p>{article.readingMinutes === 1 ? "1 minute read" : `${article.readingMinutes} minute read`}</p>
    </div>
  );
}
