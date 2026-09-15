import Link from "next/link";
import { SectionBlock } from "@/components/SectionBlock";
import { Story } from "@/components/Story";
import { StoryList } from "@/components/StoryList";
import { site } from "@/lib/site";
import { getBySectionId, getLatest, getLeadStories, getSections } from "@/lib/wp/queries";
import type { Article } from "@/lib/wp/normalize";

export const revalidate = 600;

export default async function FrontPage() {
  const [leads, latest, sections] = await Promise.all([
    getLeadStories(),
    getLatest(1, site.perPage),
    getSections(),
  ]);

  // A story appears once. Everything already placed is excluded from what
  // follows, so a site with six posts does not repeat them in four blocks.
  const used = new Set<number>();
  const take = (candidates: Article[], count: number): Article[] => {
    const picked: Article[] = [];
    for (const article of candidates) {
      if (picked.length >= count) break;
      if (used.has(article.id)) continue;
      used.add(article.id);
      picked.push(article);
    }
    return picked;
  };

  // With one section every kicker would read the same, so it says nothing.
  const showKicker = sections.length > 1;

  const ranked = [...leads, ...latest.items];
  const [lead] = take(ranked, 1);
  const secondaries = take(ranked, 3);
  const latestList = take(latest.items, site.latestOnFront);

  if (!lead) {
    return (
      <div className="wrap notice">
        <h1 className="headline-page">No stories yet</h1>
        <p className="empty">
          Nothing has been published, or the newsroom could not be reached. Reload in a moment, or try the search.
        </p>
      </div>
    );
  }

  // One block per section, built only from stories not shown above. Sections
  // with too little left over are skipped rather than padded out.
  const placed = [...used];
  const blocks = (
    await Promise.all(
      sections.map(async (section) => ({
        section,
        articles: (await getBySectionId(section, 1, site.perSectionBlock, placed)).items,
      })),
    )
  ).filter((block) => block.articles.length >= site.minSectionBlock);

  return (
    <div className="wrap front">
      <Story article={lead} variant="lead" showKicker={showKicker} />

      {secondaries.length ? (
        <section aria-label="Top stories" className="secondaries">
          {secondaries.map((article) => (
            <Story key={article.id} article={article} variant="secondary" showKicker={showKicker} />
          ))}
        </section>
      ) : null}

      {latestList.length ? (
        <section aria-labelledby="latest-heading" className="section-block">
          <div className="block-heading">
            <h2 id="latest-heading" className="section-heading">
              <Link href="/latest">Latest</Link>
            </h2>
            <p className="meta">
              <Link href="/latest">All {latest.total} stories</Link>
            </p>
          </div>
          <StoryList articles={latestList} showKicker={showKicker} />
        </section>
      ) : null}

      {blocks.length ? (
        <div className="sections-grid">
          {blocks.map((block) => (
            <SectionBlock key={block.section.id} section={block.section} articles={block.articles} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
