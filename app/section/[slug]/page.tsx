import type { Metadata } from "next";
import { getSections } from "@/lib/wp/queries";
import { SectionArchive, sectionMetadata } from "./archive";

export const revalidate = 600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const sections = await getSections();
  return sections.map((section) => ({ slug: section.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return sectionMetadata((await params).slug, 1);
}

export default async function SectionPage({ params }: Props) {
  const { slug } = await params;
  return <SectionArchive slug={slug} page={1} />;
}
