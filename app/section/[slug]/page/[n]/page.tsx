import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { extraPages, parsePageParam } from "@/lib/paging";
import { site } from "@/lib/site";
import { getSections } from "@/lib/wp/queries";
import { SectionArchive, sectionMetadata } from "../../archive";

export const revalidate = 600;

interface Props {
  params: Promise<{ slug: string; n: string }>;
}

export async function generateStaticParams() {
  const sections = await getSections();
  return sections.flatMap((section) =>
    extraPages(section.count, site.perPage).map((n) => ({ slug: section.slug, n: String(n) })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, n } = await params;
  const page = parsePageParam(n);
  return page ? sectionMetadata(slug, page) : {};
}

export default async function SectionPagedPage({ params }: Props) {
  const { slug, n } = await params;
  const page = parsePageParam(n);
  if (!page) notFound();
  return <SectionArchive slug={slug} page={page} />;
}
