import Image from "next/image";
import type { Author } from "@/lib/wp/normalize";

interface Props {
  author: Author;
  size: 24 | 48 | 96;
}

/** Gravatar via next/image; the loader sets `s=` for 1x and 2x. Decorative: the name is always adjacent. */
export function Avatar({ author, size }: Props) {
  if (!author.avatar) return null;
  return <Image src={author.avatar} width={size} height={size} alt="" className="avatar" />;
}
