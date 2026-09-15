import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchivePage } from "@/components/ArchivePage";
import { sentenceCase } from "@/lib/text";
import { sectionPath } from "@/lib/urls";
import { getBySectionId, getSection, getSiteInfo } from "@/lib/wp/queries";

export async function sectionMetadata(slug: string, page: number): Promise<Metadata> {
  const [section, { name: siteName }] = await Promise.all([getSection(slug), getSiteInfo()]);
  if (!section) return { title: "Section not found", robots: { index: false } };
  const name = sentenceCase(section.name);
  return {
    title: page > 1 ? `${name}, page ${page}` : name,
    description: section.description || `The latest ${name} stories from ${siteName}.`,
    alternates: { canonical: sectionPath(slug, page) },
  };
}

export async function SectionArchive({ slug, page }: { slug: string; page: number }) {
  const section = await getSection(slug);
  if (!section) notFound();
  const result = await getBySectionId(section, page);
  if (page > 1 && result.totalPages > 0 && page > result.totalPages) notFound();

  return (
    <ArchivePage
      kicker="Section"
      title={sentenceCase(section.name)}
      intro={
        section.description ||
        (result.total ? `${result.total} ${result.total === 1 ? "story" : "stories"}, newest first.` : undefined)
      }
      result={result}
      hrefFor={(n) => sectionPath(slug, n)}
      emptyMessage={`There are no stories in ${sentenceCase(section.name)} yet.`}
    />
  );
}
