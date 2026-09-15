import Link from "next/link";
import { Story } from "@/components/Story";
import { StoryList } from "@/components/StoryList";
import { sectionPath } from "@/lib/urls";
import type { Article, Section } from "@/lib/wp/normalize";

interface Props {
  section: Section;
  articles: Article[];
}

/** Front-page block for one section: newest story with image, then a list. */
export function SectionBlock({ section, articles }: Props) {
  const [first, ...rest] = articles;
  if (!first) return null;
  const headingId = `section-${section.slug}`;
  return (
    <section aria-labelledby={headingId} className="section-block">
      <div className="block-heading">
        <h2 id={headingId} className="section-heading">
          <Link href={sectionPath(section.slug)}>{section.name}</Link>
        </h2>
        <p className="meta">
          <Link href={sectionPath(section.slug)}>
            {section.count === 1 ? "1 story" : `All ${section.count} stories`}
          </Link>
        </p>
      </div>
      <div className="section-block-body">
        <Story article={first} variant="sectionLead" />
        <StoryList articles={rest} />
      </div>
    </section>
  );
}
