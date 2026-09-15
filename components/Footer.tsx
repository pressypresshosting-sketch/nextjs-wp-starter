import Link from "next/link";
import { sectionPath, topicPath, withBasePath } from "@/lib/urls";
import type { Page, Section, Topic } from "@/lib/wp/normalize";

interface Props {
  siteName: string;
  sections: Section[];
  topics: Topic[];
  /** Top-level WordPress pages, in menu order. */
  pages: Page[];
}

export function Footer({ siteName, sections, topics, pages }: Props) {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <nav aria-labelledby="footer-sections">
          <h2 id="footer-sections" className="footer-heading">
            Sections
          </h2>
          <ul>
            {sections.map((section) => (
              <li key={section.id}>
                <Link href={sectionPath(section.slug)}>{section.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-topics">
          <h2 id="footer-topics" className="footer-heading">
            Topics
          </h2>
          {topics.length ? (
            <ul>
              {topics.map((topic) => (
                <li key={topic.id}>
                  <Link href={topicPath(topic.slug)}>{topic.name}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="meta">No topics have been used yet.</p>
          )}
        </nav>
        {pages.length ? (
          <nav aria-labelledby="footer-pages">
            <h2 id="footer-pages" className="footer-heading">
              Pages
            </h2>
            <ul>
              {pages.map((page) => (
                <li key={page.id}>
                  <Link href={page.url}>{page.title}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <nav aria-labelledby="footer-follow">
          <h2 id="footer-follow" className="footer-heading">
            Follow
          </h2>
          <ul>
            <li>
              <a href={withBasePath("/feed.xml")} type="application/rss+xml">
                RSS feed
              </a>
            </li>
            <li>
              <Link href="/latest">Latest stories</Link>
            </li>
            <li>
              <Link href="/search">Search the archive</Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="wrap footer-colophon meta">
        <p>{siteName}</p>
      </div>
    </footer>
  );
}
