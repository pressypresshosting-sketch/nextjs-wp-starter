import Link from "next/link";
import { Byline } from "@/components/Byline";
import { WpImage } from "@/components/WpImage";
import { formatDate } from "@/lib/dates";
import { truncate } from "@/lib/text";
import { sectionPath } from "@/lib/urls";
import type { Article } from "@/lib/wp/normalize";

export type StoryVariant = "lead" | "secondary" | "sectionLead" | "list" | "row";

interface Props {
  article: Article;
  variant: StoryVariant;
  /** Heading level for the headline; defaults to h3 (h2 for the lead). */
  headingLevel?: "h2" | "h3";
  /**
   * Show the section kicker. A kicker that reads the same on every story
   * carries no information, so the front page turns it off on a site with a
   * single section.
   */
  showKicker?: boolean;
}

/** The section name, which is the one thing a kicker is allowed to say. */
function Kicker({ article, accent = false, show = true }: { article: Article; accent?: boolean; show?: boolean }) {
  if (!show || !article.section) return null;
  return (
    <p className={accent ? "kicker kicker-accent" : "kicker"}>
      <Link href={sectionPath(article.section.slug)}>{article.section.name}</Link>
    </p>
  );
}

/**
 * One story in five treatments. Importance is carried by size and position,
 * so the variants share their markup and differ in scale. Every variant works
 * with or without a featured image, because plenty of WordPress sites have
 * none: the image is an enhancement, never the thing that holds the layout up.
 */
export function Story({ article, variant, headingLevel, showKicker = true }: Props) {
  const Heading = headingLevel ?? (variant === "lead" ? "h2" : "h3");
  const { image, title, url, publishedAt } = article;
  const dek = truncate(article.dek, variant === "lead" ? 240 : 150);

  if (variant === "lead") {
    return (
      <article className={image ? "lead" : "lead no-image"}>
        <div className="lead-text">
          <Kicker article={article} accent show={showKicker} />
          <Heading className="headline-lead">
            <Link href={url}>{title}</Link>
          </Heading>
          {dek ? <p className="dek">{dek}</p> : null}
          <Byline article={article} withReadingTime />
        </div>
        {image ? (
          <figure className="lead-figure">
            <WpImage image={image} width={720} priority />
          </figure>
        ) : null}
      </article>
    );
  }

  if (variant === "secondary") {
    return (
      <article className={image ? "secondary" : "secondary no-image"}>
        {image ? (
          <Link href={url} className="secondary-figure" tabIndex={-1} aria-hidden="true">
            <WpImage image={image} width={420} />
          </Link>
        ) : null}
        <div className="secondary-text">
          <Kicker article={article} show={showKicker} />
          <Heading className="headline-secondary">
            <Link href={url}>{title}</Link>
          </Heading>
          {dek ? <p className="dek dek-clamp">{dek}</p> : null}
          <Byline article={article} withReadingTime />
        </div>
      </article>
    );
  }

  if (variant === "sectionLead") {
    return (
      <article className="section-lead">
        {image ? (
          <figure>
            <Link href={url} tabIndex={-1} aria-hidden="true">
              <WpImage image={image} width={420} />
            </Link>
          </figure>
        ) : null}
        <Kicker article={article} show={showKicker} />
        <Heading className="headline-secondary">
          <Link href={url}>{title}</Link>
        </Heading>
        {dek ? <p className="dek dek-clamp">{dek}</p> : null}
        <Byline article={article} withReadingTime />
      </article>
    );
  }

  if (variant === "row") {
    return (
      <article className={image ? "row" : "row no-image"}>
        {image ? (
          <Link href={url} className="row-figure" tabIndex={-1} aria-hidden="true">
            <WpImage image={image} width={200} />
          </Link>
        ) : null}
        <div className="row-text">
          <Kicker article={article} show={showKicker} />
          <Heading className="headline-secondary">
            <Link href={url}>{title}</Link>
          </Heading>
          {dek ? <p className="dek">{dek}</p> : null}
          <Byline article={article} withReadingTime />
        </div>
      </article>
    );
  }

  return (
    <article className="story-row">
      <div className="story-row-main">
        <Kicker article={article} show={showKicker} />
        <Heading className="headline-list">
          <Link href={url}>{title}</Link>
        </Heading>
      </div>
      <time className="meta" dateTime={publishedAt}>
        {formatDate(publishedAt, "short")}
      </time>
    </article>
  );
}
