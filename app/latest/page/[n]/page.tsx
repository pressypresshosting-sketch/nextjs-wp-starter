import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { extraPages, parsePageParam } from "@/lib/paging";
import { site } from "@/lib/site";
import { getLatest } from "@/lib/wp/queries";
import { LatestArchive, latestMetadata } from "../../archive";

export const revalidate = 600;

interface Props {
  params: Promise<{ n: string }>;
}

export async function generateStaticParams() {
  const first = await getLatest(1, 1);
  return extraPages(first.total, site.perPage).map((n) => ({ n: String(n) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = parsePageParam((await params).n);
  return page ? latestMetadata(page) : {};
}

export default async function LatestPagedPage({ params }: Props) {
  const page = parsePageParam((await params).n);
  if (!page) notFound();
  return <LatestArchive page={page} />;
}
