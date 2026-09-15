import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { sectionPath, withBasePath } from "@/lib/urls";
import type { Page, Section } from "@/lib/wp/normalize";

interface Props {
  siteName: string;
  /** Pages in the main navigation, already filtered and ordered. */
  navPages: Page[];
  /** Sections for the secondary row under the main navigation. */
  sections: Section[];
  /** Publication time of the newest story, printed in the utility bar. */
  latestAt: string | null;
}

export function Masthead({ siteName, navPages, sections, latestAt }: Props) {
  return (
    <header className="masthead">
      {latestAt ? (
        <div className="utility-bar">
          <div className="wrap utility-inner">
            <p>
              Updated <time dateTime={latestAt}>{formatDate(latestAt, "weekday")}</time>
            </p>
            <p className="utility-end">
              <a href={withBasePath("/feed.xml")} type="application/rss+xml">
                RSS
              </a>
            </p>
          </div>
        </div>
      ) : null}

      <div className="wrap masthead-row">
        <Link href="/" className="wordmark">
          {siteName}
        </Link>
        <Link href="/search" className="search-pill">
          Search
        </Link>
      </div>

      <nav aria-label="Main" className="main-nav">
        <div className="wrap">
          <ul>
            <li>
              <Link href="/latest">Latest</Link>
            </li>
            {navPages.map((page) => (
              <li key={page.id}>
                <Link href={page.url}>{page.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {sections.length ? (
        <nav aria-labelledby="sections-label" className="sections-nav">
          <div className="wrap sections-inner">
            <span id="sections-label" className="sections-label">
              Sections
            </span>
            <ul>
              {sections.map((section) => (
                <li key={section.id}>
                  <Link href={sectionPath(section.slug)}>{section.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
