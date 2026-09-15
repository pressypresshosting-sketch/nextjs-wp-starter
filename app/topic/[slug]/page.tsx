import type { Metadata } from "next";
import { getTopics } from "@/lib/wp/queries";
import { TopicArchive, topicMetadata } from "./archive";

export const revalidate = 600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const topics = await getTopics();
  return topics.map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return topicMetadata((await params).slug, 1);
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  return <TopicArchive slug={slug} page={1} />;
}
