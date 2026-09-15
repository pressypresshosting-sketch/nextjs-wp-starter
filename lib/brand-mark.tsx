import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The favicon and touch icon are drawn from the site's own name, so nothing
 * about one publication is baked into an image file. Colours mirror the
 * tokens in app/globals.css: an ImageResponse cannot read CSS variables.
 */
const PAPER = "#fbfaf7";
const INK = "#14120f";
const ACCENT = "#a6231c";

export async function displayFont(): Promise<ArrayBuffer | null> {
  try {
    const file = await readFile(path.join(process.cwd(), "assets", "fonts", "Fraunces-700.woff"));
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

/** The first letter of the site name, or a paragraph mark for an empty one. */
export function brandInitial(siteName: string): string {
  const letter = siteName.trim().match(/\p{L}|\p{N}/u)?.[0];
  return letter ? letter.toUpperCase() : "¶";
}

/**
 * A square mark: the initial in the display face on paper, sitting on an
 * accent rule, like a masthead reduced to one character. Every dimension is a
 * fraction of `size` so the favicon and the touch icon are the same drawing.
 */
export function BrandMark({ initial, size }: { initial: string; size: number }) {
  const inset = Math.round(size * 0.14);
  const rule = Math.max(2, Math.round(size * 0.07));
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        background: PAPER,
        color: INK,
        fontFamily: "Fraunces, Georgia, serif",
        padding: inset,
        // Touch icons get rounded by the OS; a browser tab shows the square.
        borderRadius: size >= 120 ? Math.round(size * 0.18) : 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          flexGrow: 1,
          // Wide capitals such as M and W fill the box at this size; anything
          // larger clips their serifs on the left edge.
          fontSize: Math.round(size * 0.68),
          fontWeight: 700,
          lineHeight: 0.8,
        }}
      >
        {initial}
      </div>
      <div style={{ height: rule, marginTop: Math.round(size * 0.1), background: ACCENT }} />
    </div>
  );
}
