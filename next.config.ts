import type { NextConfig } from "next";

if (!process.env.WP_URL) {
  throw new Error(
    "WP_URL is not set. Copy .env.example to .env and point WP_URL at your WordPress site, e.g. WP_URL=https://example.com",
  );
}
const wp = new URL(process.env.WP_URL);

// The app is proxied at a path prefix (https://your-site.example/news). The
// prefix is the pathname of NEXT_PUBLIC_SITE_URL so it is set in one place.
const publicUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/news");
const basePath = publicUrl.pathname.replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: basePath || undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Every image goes through lib/image-loader.ts, which maps a requested
    // width onto one of WordPress's own generated sizes (or a Gravatar size).
    // Nothing is resized on this server, so the image optimizer and sharp are
    // never used and the RAM footprint stays small.
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    // next/image snaps a requested width to the nearest entry in these lists
    // before calling the loader. They therefore include WordPress's sizes
    // (thumbnail 150, medium 300, the 400px originals, medium_large 768,
    // large 1024) and their 2x doubles, plus the avatar sizes.
    imageSizes: [24, 48, 96, 150, 192, 300],
    deviceSizes: [400, 600, 640, 768, 800, 1024, 1200, 1536, 2048],
    remotePatterns: [
      {
        protocol: wp.protocol === "http:" ? "http" : "https",
        hostname: wp.hostname,
        pathname: "/wp-content/uploads/**",
      },
      { protocol: "https", hostname: "secure.gravatar.com", pathname: "/avatar/**" },
    ],
  },
  outputFileTracingIncludes: {
    "/[year]/[month]/[slug]/opengraph-image": ["./assets/fonts/*"],
    "/icon": ["./assets/fonts/*"],
    "/apple-icon": ["./assets/fonts/*"],
  },

  /**
   * When the app owns a domain root, requests for WordPress's own paths land
   * here instead of the CMS: the host panel's one-click admin login builds its
   * URL from the primary domain, old bookmarks point at /wp-admin, and so on.
   * Forward them to the CMS rather than answering 404. Query strings are
   * preserved, so a login token still works.
   *
   * Skipped when WordPress and the app share a host, where WordPress already
   * serves these paths and a redirect would loop.
   */
  async redirects() {
    if (wp.host === publicUrl.host) return [];
    const wpBase = `${wp.protocol}//${wp.host}`;
    const forward = ["/wp-admin", "/wp-login.php", "/wp-cron.php", "/xmlrpc.php"];
    return [
      ...forward.map((source) => ({ source, destination: `${wpBase}${source}`, permanent: false })),
      ...["/wp-admin", "/wp-json", "/wp-content", "/wp-includes"].map((prefix) => ({
        source: `${prefix}/:path*`,
        destination: `${wpBase}${prefix}/:path*`,
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
