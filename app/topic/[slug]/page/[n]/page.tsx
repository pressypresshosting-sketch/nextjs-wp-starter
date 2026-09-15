import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { extraPages, parsePageParam } from "@/lib/paging";
import { site } from "@/lib/site";
import { getTopics } from "@/lib/wp/queries";
import { TopicArchive, topicMetadata } from "../../archive";

export const revalidate = 600;

interface Props {
  params: Promise<{ slug: string; n: string }>;
}

export async function generateStaticParams() {
  const topics = await getTopics();
  return topics.flatMap((topic) => extraPages(topic.count, site.perPage).map((n) => ({ slug: topic.slug, n: String(n) })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, n } = await params;
  const page = parsePageParam(n);
  return page ? topicMetadata(slug, page) : {};
}

export default async function TopicPagedPage({ params }: Props) {
  const { slug, n } = await params;
  const page = parsePageParam(n);
  if (!page) notFound();
  return <TopicArchive slug={slug} page={page} />;
}
