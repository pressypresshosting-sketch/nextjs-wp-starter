import { Story, type StoryVariant } from "@/components/Story";
import type { Article } from "@/lib/wp/normalize";

interface Props {
  articles: Article[];
  variant?: Extract<StoryVariant, "list" | "row">;
  headingLevel?: "h2" | "h3";
  showKicker?: boolean;
}

/** Rule-separated list of stories. */
export function StoryList({ articles, variant = "list", headingLevel = "h3", showKicker = true }: Props) {
  if (!articles.length) return null;
  return (
    <ul className={variant === "row" ? "archive-list" : "story-list"}>
      {articles.map((article) => (
        <li key={article.id}>
          <Story article={article} variant={variant} headingLevel={headingLevel} showKicker={showKicker} />
        </li>
      ))}
    </ul>
  );
}
