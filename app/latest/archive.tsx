import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchivePage } from "@/components/ArchivePage";
import { latestPath } from "@/lib/urls";
import { getLatest, getSiteInfo } from "@/lib/wp/queries";

export async function latestMetadata(page: number): Promise<Metadata> {
  const { name: siteName } = await getSiteInfo();
  const title = page > 1 ? `Latest stories, page ${page}` : "Latest stories";
  return {
    title,
    description: `Every story on ${siteName} in the order it was published, newest first.`,
    alternates: { canonical: latestPath(page) },
  };
}

export async function LatestArchive({ page }: { page: number }) {
  const result = await getLatest(page);
  if (page > 1 && result.totalPages > 0 && page > result.totalPages) notFound();

  return (
    <ArchivePage
      title="Latest stories"
      intro={result.total ? `${result.total} stories, newest first.` : undefined}
      result={result}
      hrefFor={latestPath}
      emptyMessage="Nothing has been published yet, or the newsroom could not be reached. Reload in a moment."
    />
  );
}
