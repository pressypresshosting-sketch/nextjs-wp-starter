import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parsePageParam } from "@/lib/paging";
import { AuthorArchive, authorMetadata } from "../../archive";

export const revalidate = 600;

interface Props {
  params: Promise<{ slug: string; n: string }>;
}

/** Author page counts are not exposed by the users endpoint, so extra pages render on demand. */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, n } = await params;
  const page = parsePageParam(n);
  return page ? authorMetadata(slug, page) : {};
}

export default async function AuthorPagedPage({ params }: Props) {
  const { slug, n } = await params;
  const page = parsePageParam(n);
  if (!page) notFound();
  return <AuthorArchive slug={slug} page={page} />;
}
