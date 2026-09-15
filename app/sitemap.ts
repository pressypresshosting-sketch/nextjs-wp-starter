import type { MetadataRoute } from "next";
import { absoluteUrl, articlePath, authorPath, sectionPath, topicPath } from "@/lib/urls";
import { getAllSlugs, getAuthors, getPages, getSections, getTopics } from "@/lib/wp/queries";

export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, sections, topics, authors, pages] = await Promise.all([
    getAllSlugs(),
    getSections(),
    getTopics(),
    getAuthors(),
    getPages(),
  ]);

  const newest = articles.reduce<string | undefined>(
    (latest, a) => (!latest || a.updatedAt > latest ? a.updatedAt : latest),
    undefined,
  );

  return [
    { url: absoluteUrl("/"), lastModified: newest, changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/latest"), lastModified: newest, changeFrequency: "hourly", priority: 0.8 },
    ...sections.map((s) => ({ url: absoluteUrl(sectionPath(s.slug)), changeFrequency: "daily" as const, priority: 0.7 })),
    ...topics.map((t) => ({ url: absoluteUrl(topicPath(t.slug)), changeFrequency: "weekly" as const, priority: 0.4 })),
    ...authors.map((a) => ({ url: absoluteUrl(authorPath(a.slug)), changeFrequency: "weekly" as const, priority: 0.4 })),
    ...pages.map((p) => ({
      url: absoluteUrl(p.url),
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...articles.map((a) => ({
      url: absoluteUrl(articlePath(a)),
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
