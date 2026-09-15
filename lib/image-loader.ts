import type { ImageLoaderProps } from "next/image";

/**
 * Global next/image loader (configured in next.config.ts).
 *
 * WordPress images: the `src` given to next/image is the URL of the original
 * ("full") file with a `wps` query parameter listing the sizes WordPress
 * generated, e.g. `?wps=150x150,300x300`. For a requested width we pick the
 * smallest generated size that covers it and rebuild WordPress's own file
 * name (`name-300x300.jpg`). If no generated size is large enough, the
 * original is returned, so an image is never upscaled and never resized on
 * this server. See lib/wp/normalize.ts `imageSrc()` for the encoding side.
 *
 * Gravatar: the `s` parameter is set to the requested width.
 *
 * Anything else is returned untouched.
 */
export default function imageLoader({ src, width }: ImageLoaderProps): string {
  let url: URL;
  try {
    url = new URL(src, "http://relative.invalid");
  } catch {
    return src;
  }
  const isRelative = url.hostname === "relative.invalid";

  if (url.hostname.endsWith("gravatar.com")) {
    url.searchParams.set("s", String(Math.min(width, 1024)));
    return url.toString();
  }

  const encoded = url.searchParams.get("wps");
  if (encoded === null) return src;
  url.searchParams.delete("wps");

  const candidates = encoded
    .split(",")
    .map((pair) => pair.split("x").map(Number))
    .filter((dims): dims is [number, number] => dims.length === 2 && dims.every((n) => Number.isFinite(n) && n > 0))
    .sort((a, b) => a[0] - b[0]);

  const pick = candidates.find(([w]) => w >= width);
  const serialise = () => (isRelative ? `${url.pathname}${url.search}` : url.toString());
  if (!pick) return serialise();

  const match = url.pathname.match(/^(.*)\.([a-z0-9]+)$/i);
  if (!match) return serialise();
  const base = (match[1] ?? "").replace(/-scaled$/, "");
  url.pathname = `${base}-${pick[0]}x${pick[1]}.${match[2]}`;
  return serialise();
}
