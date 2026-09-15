import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces, Newsreader } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Masthead } from "@/components/Masthead";
import { site } from "@/lib/site";
import { getLatest, getPages, getSections, getSiteInfo, getTopics } from "@/lib/wp/queries";
import "./globals.css";

// Display face: a variable serif with optical-size and "wonk" axes, so the
// masthead and headlines get real character at large sizes. Preloaded because
// the lead headline is the first thing painted.
const display = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--ff-display",
  // "optional" rather than "swap": at masthead and headline sizes a late font
  // swap re-wraps the largest text on the page, which is a big layout shift.
  // Preloaded, so in practice it arrives in time and is used on first paint.
  display: "optional",
});

// Grotesque for navigation, kickers, bylines and everything small.
const sans = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  variable: "--ff-sans",
  display: "optional",
});

// Reading face for deks and article bodies. Static instances rather than the
// variable font, and not preloaded: it is below the fold and preloading it
// delays first paint on a slow connection.
const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--ff-serif",
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const { name, description } = await getSiteInfo();
  return {
    metadataBase: new URL(site.url),
    title: { default: name, template: `%s | ${name}` },
    description,
    alternates: { types: { "application/rss+xml": `${site.url}/feed.xml` } },
    openGraph: { siteName: name, type: "website", locale: site.locale.replace("-", "_") },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ name }, sections, topics, latest, pages] = await Promise.all([
    getSiteInfo(),
    getSections(),
    getTopics(),
    getLatest(1, 1),
    getPages(),
  ]);
  const latestAt = latest.items[0]?.publishedAt ?? null;
  const topLevelPages = pages.filter((page) => page.parent === 0);
  // An explicit list in site.navPages picks and orders the main navigation;
  // without one, every top-level page is shown in WordPress's menu order.
  const navPages = site.navPages.length
    ? site.navPages
        .map((slug) => pages.find((page) => page.slug === slug))
        .filter((page): page is NonNullable<typeof page> => page !== undefined)
    : topLevelPages;

  return (
    <html lang={site.locale} className={`${display.variable} ${sans.variable} ${serif.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <Masthead siteName={name} navPages={navPages} sections={sections} latestAt={latestAt} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer siteName={name} sections={sections} topics={topics} pages={topLevelPages} />
      </body>
    </html>
  );
}
