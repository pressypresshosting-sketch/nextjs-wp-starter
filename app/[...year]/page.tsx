import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { pageMetadata, StaticPage } from "@/components/StaticPage";
import { getArticle, getPageByPath, getPages, getSiteInfo } from "@/lib/wp/queries";

export const revalidate = 600;

/**
 * Everything that is not a known route: WordPress pages at their own path
 * (any depth), and the legacy `/{slug}` permalink of a post, which redirects
 * to the dated article URL.
 *
 * The parameter is named `year` because Next.js requires one name per path
 * position and `/[year]/[month]/[slug]` owns this one. Here it is a path.
 * Three-segment paths always match the article route, which falls back to a
 * page lookup itself, so a page nested two deep still resolves.
 */
interface Props {
  params: Promise<{ year: string[] }>;
}

export async function generateStaticParams() {
  const pages = await getPages();
  return pages.map((page) => ({ year: page.path.split("/") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year: segments } = await params;
  const [page, { name }] = await Promise.all([getPageByPath(segments), getSiteInfo()]);
  if (!page) return { title: "Page not found", robots: { index: false } };
  return pageMetadata(page, name);
}

export default async function CatchAllPage({ params }: Props) {
  const { year: segments } = await params;
  const [page, { name }] = await Promise.all([getPageByPath(segments), getSiteInfo()]);
  if (page) return <StaticPage page={page} siteName={name} />;

  if (segments.length === 1 && segments[0]) {
    const article = await getArticle(segments[0]);
    if (article) permanentRedirect(article.url);
  }

  notFound();
}
