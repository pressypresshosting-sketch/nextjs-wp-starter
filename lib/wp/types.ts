/**
 * Raw shapes returned by the WordPress core REST API (wp/v2), derived from
 * the responses documented in docs/api-notes.md. Only the fields the front
 * end reads are typed; everything else is left off deliberately.
 */

export interface WpRendered {
  rendered: string;
  protected?: boolean;
}

export interface WpImageSize {
  file: string;
  width: number;
  height: number;
  mime_type: string;
  source_url: string;
  filesize?: number;
}

export interface WpImageMeta {
  credit?: string;
  copyright?: string;
  caption?: string;
  title?: string;
}

export interface WpMediaDetails {
  width?: number;
  height?: number;
  file?: string;
  filesize?: number;
  sizes?: Record<string, WpImageSize>;
  image_meta?: WpImageMeta;
}

export interface WpMedia {
  id: number;
  date: string;
  slug: string;
  title: WpRendered;
  caption: WpRendered;
  alt_text: string;
  media_type: string;
  mime_type: string;
  media_details: WpMediaDetails;
  source_url: string;
}

export interface WpTerm {
  id: number;
  link: string;
  name: string;
  slug: string;
  taxonomy: "category" | "post_tag";
}

export interface WpCategory {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
  parent: number;
}

export interface WpTag {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
}

export interface WpUser {
  id: number;
  name: string;
  url: string;
  description: string;
  link: string;
  slug: string;
  avatar_urls: Record<string, string>;
}

/** Shape of an `_embedded.author` entry when the user no longer exists. */
export interface WpEmbedError {
  code: string;
  message: string;
  data?: { status?: number };
}

export interface WpEmbedded {
  author?: Array<WpUser | WpEmbedError>;
  "wp:featuredmedia"?: Array<WpMedia | WpEmbedError>;
  "wp:term"?: WpTerm[][];
}

export interface WpPost {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: WpRendered;
  content: WpRendered;
  excerpt: WpRendered;
  author: number;
  featured_media: number;
  sticky: boolean;
  format: string;
  categories: number[];
  tags: number[];
  _embedded?: WpEmbedded;
}

/** A WordPress page: a post without taxonomies, plus hierarchy and ordering. */
export interface WpPage {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: WpRendered;
  content: WpRendered;
  excerpt: WpRendered;
  author: number;
  featured_media: number;
  parent: number;
  menu_order: number;
  template: string;
  _embedded?: WpEmbedded;
}

/** Minimal post shape returned with `_fields=id,slug,date,modified`. */
export interface WpPostStub {
  id: number;
  slug: string;
  date: string;
  modified?: string;
}
