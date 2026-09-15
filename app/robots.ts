import type { MetadataRoute } from "next";
import { absoluteUrl, withBasePath } from "@/lib/urls";

/**
 * Served at {basePath}/robots.txt. Crawlers only read the root robots.txt,
 * which WordPress owns, so the useful part of this file is the sitemap line;
 * the rules are prefixed anyway so they are correct if ever merged.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: withBasePath("/"), disallow: [withBasePath("/api/"), withBasePath("/search")] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
