import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getArticle, getSiteInfo } from "@/lib/wp/queries";

export const alt = "Story preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 600;

// Mirrors the tokens in app/globals.css.
const PAPER = "#fbfaf7";
const INK = "#14120f";
const MUTED = "#6b6459";
const ACCENT = "#a6231c";

async function headlineFont(): Promise<ArrayBuffer | null> {
  try {
    const file = await readFile(path.join(process.cwd(), "assets", "fonts", "Fraunces-700.woff"));
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

async function featuredImageDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { next: { revalidate: 86_400 } });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await response.arrayBuffer()).toString("base64");
    return `data:${type};base64,${bytes}`;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, font, { name: siteName }] = await Promise.all([getArticle(slug), headlineFont(), getSiteInfo()]);
  const image = article?.image ? await featuredImageDataUrl(article.image.src) : null;

  const title = article?.title ?? siteName;
  const kicker = article?.section?.name ?? "";
  const titleSize = title.length > 70 ? 52 : title.length > 40 ? 64 : 76;
  const imageBox = 470;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: PAPER,
          color: INK,
          fontFamily: "Fraunces, Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 56px 48px",
            width: image ? size.width - imageBox - 56 : size.width,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {kicker ? (
              <div style={{ fontSize: 28, color: ACCENT, textTransform: "capitalize", marginBottom: 20 }}>{kicker}</div>
            ) : null}
            <div style={{ fontSize: titleSize, lineHeight: 1.02, letterSpacing: -1.5, fontWeight: 700 }}>{title}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 30 }}>
            <div style={{ width: 10, height: 44, background: INK, marginRight: 18 }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: -0.5 }}>{siteName}</div>
              {article?.author ? (
                <div style={{ fontSize: 24, color: MUTED }}>{`By ${article.author.name}`}</div>
              ) : null}
            </div>
          </div>
        </div>
        {image ? (
          <div style={{ display: "flex", alignItems: "center", paddingRight: 56 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} width={imageBox} height={imageBox} alt="" style={{ objectFit: "cover" }} />
          </div>
        ) : null}
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: "Fraunces", data: font, weight: 700, style: "normal" }] : undefined,
    },
  );
}
