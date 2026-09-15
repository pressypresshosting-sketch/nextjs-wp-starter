import type { Metadata } from "next";
import { getAuthors } from "@/lib/wp/queries";
import { AuthorArchive, authorMetadata } from "./archive";

export const revalidate = 600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const authors = await getAuthors();
  return authors.map((author) => ({ slug: author.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return authorMetadata((await params).slug, 1);
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  return <AuthorArchive slug={slug} page={1} />;
}
