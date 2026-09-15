import Link from "next/link";
import { topicPath } from "@/lib/urls";
import type { Topic } from "@/lib/wp/normalize";

export function TagList({ topics }: { topics: Topic[] }) {
  if (!topics.length) return null;
  return (
    <nav aria-label="Topics">
      <ul className="tag-list">
        {topics.map((topic) => (
          <li key={topic.id}>
            <Link href={topicPath(topic.slug)}>{topic.name}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
