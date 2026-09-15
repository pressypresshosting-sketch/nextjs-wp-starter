import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchivePage } from "@/components/ArchivePage";
import { sentenceCase } from "@/lib/text";
import { topicPath } from "@/lib/urls";
import { getByTopic, getSiteInfo, getTopic } from "@/lib/wp/queries";

export async function topicMetadata(slug: string, page: number): Promise<Metadata> {
  const [topic, { name: siteName }] = await Promise.all([getTopic(slug), getSiteInfo()]);
  if (!topic) return { title: "Topic not found", robots: { index: false } };
  const name = sentenceCase(topic.name);
  return {
    title: page > 1 ? `${name}, page ${page}` : name,
    description: `Stories tagged ${topic.name} on ${siteName}.`,
    alternates: { canonical: topicPath(slug, page) },
  };
}

export async function TopicArchive({ slug, page }: { slug: string; page: number }) {
  const topic = await getTopic(slug);
  if (!topic) notFound();
  const result = await getByTopic(slug, page);
  if (page > 1 && result.totalPages > 0 && page > result.totalPages) notFound();

  return (
    <ArchivePage
      kicker="Topic"
      title={sentenceCase(topic.name)}
      intro={result.total ? `${result.total} ${result.total === 1 ? "story" : "stories"} tagged ${topic.name}.` : undefined}
      result={result}
      hrefFor={(n) => topicPath(slug, n)}
      emptyMessage={`No stories have been tagged ${topic.name} yet.`}
    />
  );
}
