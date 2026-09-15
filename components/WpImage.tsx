import Image from "next/image";
import { imageSrc, type Image as WpImageData } from "@/lib/wp/normalize";

interface Props {
  image: WpImageData;
  /** Intended rendered width in CSS pixels. Never exceeds the original. */
  width: number;
  priority?: boolean;
  className?: string;
}

/**
 * next/image wrapper for a WordPress media object. The src carries the list
 * of WordPress-generated sizes so lib/image-loader.ts can build a 1x/2x
 * srcset from them without touching the original for small renders.
 */
export function WpImage({ image, width, priority = false, className }: Props) {
  const w = Math.min(width, image.width);
  const h = Math.round((w * image.height) / image.width);
  return (
    <Image
      src={imageSrc(image)}
      width={w}
      height={h}
      alt={image.alt}
      priority={priority}
      className={className}
    />
  );
}
