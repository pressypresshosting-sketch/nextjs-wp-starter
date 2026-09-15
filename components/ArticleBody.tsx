import type { ReactNode } from "react";
import "@/app/article-body.css";

/** Renders the sanitised nodes produced by renderWpHtml(). */
export function ArticleBody({ nodes }: { nodes: ReactNode[] }) {
  return (
    <div className="article-body">
      {nodes.length ? nodes : <p>This story has no text yet. Check back later or browse the section for more.</p>}
    </div>
  );
}
