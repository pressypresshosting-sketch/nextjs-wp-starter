import { ImageResponse } from "next/og";
import { BrandMark, brandInitial, displayFont } from "@/lib/brand-mark";
import { getSiteInfo } from "@/lib/wp/queries";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export const revalidate = 600;

export default async function Icon() {
  const [{ name }, font] = await Promise.all([getSiteInfo(), displayFont()]);
  return new ImageResponse(<BrandMark initial={brandInitial(name)} size={size.width} />, {
    ...size,
    fonts: font ? [{ name: "Fraunces", data: font, weight: 700, style: "normal" }] : undefined,
  });
}
