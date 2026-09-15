import type { Metadata } from "next";
import Link from "next/link";
import { ArchivePage } from "@/components/ArchivePage";
import { SearchForm } from "@/components/SearchForm";
import { searchPath, sectionPath } from "@/lib/urls";
import { getSections, search } from "@/lib/wp/queries";

interface Props {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = first((await searchParams).q).trim();
  return {
    title: q ? `Search results for "${q}"` : "Search",
    description: "Search every story in the archive.",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q).trim();
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  const [result, sections] = await Promise.all([search(q, page), getSections()]);

  const hrefFor = (n: number) => (n > 1 ? `${searchPath(q)}&page=${n}` : searchPath(q));

  const emptyMessage = q
    ? `Nothing matched "${q}". Try a shorter word, or browse the sections below.`
    : "Type a word or a name to search the archive.";

  return (
    <ArchivePage
      title={q ? `Results for "${q}"` : "Search"}
      kicker="Search"
      intro={q && result.total ? `${result.total} ${result.total === 1 ? "story" : "stories"}, most relevant first.` : undefined}
      result={result}
      hrefFor={hrefFor}
      emptyMessage={emptyMessage}
      previousLabel="Previous page"
      nextLabel="Next page"
      emptyExtra={
        sections.length ? (
          <nav aria-label="Browse sections">
            <ul className="tag-list">
              {sections.map((section) => (
                <li key={section.id}>
                  <Link href={sectionPath(section.slug)}>{section.name}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null
      }
    >
      <SearchForm query={q} />
    </ArchivePage>
  );
}
