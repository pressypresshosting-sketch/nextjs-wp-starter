import { parseDocument } from "htmlparser2";
import { isTag, isText, type ChildNode, type Element } from "domhandler";
import Image from "next/image";
import Script from "next/script";
import type { ReactNode } from "react";
import { withBasePath } from "@/lib/urls";
import { WP_URL } from "@/lib/wp/client";

/**
 * Render WordPress body HTML as React with a small allowlist.
 *
 * - Unknown tags are dropped but their children are kept (so text survives).
 * - Attributes are allowlisted per tag; `style`, `id` and event handlers never pass.
 * - `<img>` with known dimensions becomes next/image using WordPress's own srcset.
 * - `<iframe>` is allowed only from known embed providers.
 * - `<script>` is allowed only for the Twitter/X and Instagram embed loaders,
 *   rendered lazily through next/script.
 * - Internal WordPress links are rewritten to this site's routes.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "sub", "sup", "small",
  "a", "ul", "ol", "li", "h2", "h3", "h4", "h5", "h6", "blockquote", "cite", "q",
  "figure", "figcaption", "img", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "pre", "code", "kbd", "samp", "var", "div", "span", "time", "abbr", "dl", "dt", "dd", "iframe", "script",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);

const TAG_ATTRS: Record<string, readonly string[]> = {
  a: ["href", "target"],
  img: ["src", "srcset", "width", "height", "alt"],
  iframe: ["src", "width", "height", "title", "allow", "allowfullscreen"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan", "scope"],
  ol: ["start", "reversed"],
  time: ["datetime"],
  abbr: ["title"],
  blockquote: ["cite"],
  q: ["cite"],
};
const GLOBAL_ATTRS = ["class", "lang", "dir"] as const;

/** Only WordPress block classes survive, so nothing collides with our own utilities. */
const CLASS_RE = /^(wp-|has-|is-|align(?:left|right|center|wide|full|none)$|size-|blocks-gallery|twitter-tweet$|instagram-media$|screen-reader-text$)/;

const IFRAME_HOSTS = new Set([
  "www.youtube.com", "youtube.com", "www.youtube-nocookie.com",
  "player.vimeo.com", "open.spotify.com", "w.soundcloud.com",
]);
const EMBED_SCRIPTS = new Set(["https://platform.twitter.com/widgets.js", "https://www.instagram.com/embed.js"]);

const ATTR_TO_PROP: Record<string, string> = {
  class: "className",
  colspan: "colSpan",
  rowspan: "rowSpan",
  allowfullscreen: "allowFullScreen",
  datetime: "dateTime",
  srcset: "srcSet",
};

type Props = Record<string, string | number | boolean | undefined>;

/** A heading found in the body, used to build the table of contents. */
export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

interface RenderContext {
  headings: Heading[];
  /** Slug to number of times seen, so repeated headings get unique ids. */
  used: Map<string, number>;
}

/** Plain text of a node and its descendants, for heading labels. */
function textOf(node: ChildNode): string {
  if (isText(node)) return node.data;
  if (isTag(node)) return node.children.map(textOf).join("");
  return "";
}

function slugify(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip combining accents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section"
  );
}

/** A WordPress heading anchor is kept when it is a safe slug; otherwise one is generated. */
function headingId(el: Element, text: string, ctx: RenderContext): string {
  const existing = el.attribs.id?.trim();
  const base = existing && /^[A-Za-z][\w:.-]*$/.test(existing) ? existing : slugify(text);
  const seen = ctx.used.get(base) ?? 0;
  ctx.used.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen + 1}`;
}

function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^(\/|#|\.\/|\.\.\/)/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Map WordPress permalinks to this site's routes (plain <a>, so the basePath is added here). */
function rewriteInternalHref(href: string): string {
  if (!href.startsWith(`${WP_URL}/`)) return href;
  const path = href.slice(WP_URL.length).replace(/\/$/, "");
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 1 && segments[0]) return withBasePath(`/${segments[0]}`);
  if (segments.length === 2 && segments[1]) {
    if (segments[0] === "category") return withBasePath(`/section/${segments[1]}`);
    if (segments[0] === "tag") return withBasePath(`/topic/${segments[1]}`);
    if (segments[0] === "author") return withBasePath(`/author/${segments[1]}`);
  }
  return href;
}

function filterClasses(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const kept = value.split(/\s+/).filter((c) => CLASS_RE.test(c));
  return kept.length ? kept.join(" ") : undefined;
}

/**
 * Convert an `<img>` src + WordPress srcset into the encoded src that
 * lib/image-loader.ts understands. Falls back to the plain src.
 */
function encodeWpSrcset(src: string, srcset: string | undefined): string {
  const sizeRe = /-(\d+)x(\d+)(\.[a-z0-9]+)$/i;
  const candidates = (srcset ?? "")
    .split(",")
    .map((c) => c.trim().split(/\s+/)[0] ?? "")
    .filter(Boolean);
  if (!candidates.length) return src;

  const dims: string[] = [];
  let base: string | null = null;
  for (const candidate of candidates) {
    const match = candidate.match(sizeRe);
    if (match) dims.push(`${match[1]}x${match[2]}`);
    else base = candidate;
  }
  if (!base) base = src.replace(sizeRe, "$3");
  if (!dims.length) return src;
  return `${base}${base.includes("?") ? "&" : "?"}wps=${dims.join(",")}`;
}

function collectProps(el: Element): Props {
  const props: Props = {};
  const allowed = [...GLOBAL_ATTRS, ...(TAG_ATTRS[el.name] ?? [])];
  for (const name of allowed) {
    const value = el.attribs[name];
    if (value === undefined) continue;
    const prop = ATTR_TO_PROP[name] ?? name;
    if (name === "class") {
      const classes = filterClasses(value);
      if (classes) props.className = classes;
    } else if (name === "href" || name === "src" || name === "cite") {
      const url = safeUrl(value);
      if (url) props[prop] = name === "href" ? rewriteInternalHref(url) : url;
    } else if (name === "allowfullscreen" || name === "reversed") {
      props[prop] = true;
    } else if (name === "target") {
      if (value === "_blank") {
        props.target = "_blank";
        props.rel = "noopener noreferrer";
      }
    } else {
      props[prop] = value;
    }
  }
  return props;
}

function renderImage(el: Element, key: string): ReactNode {
  const src = safeUrl(el.attribs.src);
  if (!src) return null;
  const width = Number.parseInt(el.attribs.width ?? "", 10);
  const height = Number.parseInt(el.attribs.height ?? "", 10);
  const alt = el.attribs.alt ?? "";
  const className = filterClasses(el.attribs.class);

  if (width > 0 && height > 0) {
    return (
      <Image
        key={key}
        src={encodeWpSrcset(src, el.attribs.srcset)}
        width={width}
        height={height}
        alt={alt}
        className={className}
      />
    );
  }
  // Dimensions unknown: next/image cannot lay this out without them, so a
  // plain lazy image is the honest fallback.
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={key} src={src} alt={alt} loading="lazy" decoding="async" className={className} />;
}

function renderIframe(el: Element, key: string): ReactNode {
  const src = safeUrl(el.attribs.src);
  if (!src) return null;
  let host = "";
  try {
    host = new URL(src).hostname;
  } catch {
    return null;
  }
  if (!IFRAME_HOSTS.has(host)) return null;
  const width = Number.parseInt(el.attribs.width ?? "", 10);
  const height = Number.parseInt(el.attribs.height ?? "", 10);
  return (
    <iframe
      key={key}
      src={src}
      title={el.attribs.title || "Embedded content"}
      width={width > 0 ? width : undefined}
      height={height > 0 ? height : undefined}
      loading="lazy"
      allow={el.attribs.allow}
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

function renderScript(el: Element, key: string): ReactNode {
  const src = el.attribs.src?.trim();
  if (!src || !EMBED_SCRIPTS.has(src)) return null;
  return <Script key={key} src={src} strategy="lazyOnload" />;
}

function renderNode(node: ChildNode, key: string, ctx: RenderContext): ReactNode {
  if (isText(node)) return node.data;
  if (!isTag(node)) return null;

  const name = node.name.toLowerCase();
  if (!ALLOWED_TAGS.has(name)) {
    // Unknown wrapper: keep its content, drop the tag.
    return <span key={key}>{renderChildren(node.children, key, ctx)}</span>;
  }
  if (name === "img") return renderImage(node, key);
  if (name === "iframe") return renderIframe(node, key);
  if (name === "script") return renderScript(node, key);

  const Tag = name as keyof React.JSX.IntrinsicElements;
  const props = collectProps(node);

  // Top-level headings get a stable id so the table of contents can link to
  // them. This is the one place an id survives the allowlist, and it is one
  // we generate ourselves.
  if (name === "h2" || name === "h3") {
    const text = textOf(node).replace(/\s+/g, " ").trim();
    if (text) {
      const id = headingId(node, text, ctx);
      props.id = id;
      ctx.headings.push({ id, text, level: name === "h2" ? 2 : 3 });
    }
  }

  if (VOID_TAGS.has(name)) return <Tag key={key} {...props} />;
  return (
    <Tag key={key} {...props}>
      {renderChildren(node.children, key, ctx)}
    </Tag>
  );
}

function renderChildren(nodes: ChildNode[], keyPrefix: string, ctx: RenderContext): ReactNode[] {
  return nodes.map((node, index) => renderNode(node, `${keyPrefix}.${index}`, ctx)).filter((n) => n !== null);
}

export interface RenderedBody {
  nodes: ReactNode[];
  headings: Heading[];
}

/** Render trusted-source WordPress HTML as sanitised React, collecting its headings. */
export function renderWpHtml(html: string): RenderedBody {
  if (!html.trim()) return { nodes: [], headings: [] };
  const ctx: RenderContext = { headings: [], used: new Map() };
  const document = parseDocument(html);
  const nodes = renderChildren(document.children, "n", ctx);
  return { nodes, headings: ctx.headings };
}
