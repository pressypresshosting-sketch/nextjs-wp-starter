"use client";

import { useEffect, useRef, useState } from "react";
import type { Heading } from "@/lib/html/render";

/**
 * Contents list for an article, built from the headings in the body.
 *
 * Desktop: a sticky column beside the text, with the current section marked.
 * Mobile: a sticky bar at the top of the viewport that opens on tap.
 *
 * The only client-side work is tracking which heading is currently in view.
 * The list itself is rendered on the server, so it is in the HTML and works
 * with JavaScript disabled.
 */
export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (headings.length === 0) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      // The heading whose top has most recently passed the reading line.
      let current = headings[0]?.id ?? "";
      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (element && element.getBoundingClientRect().top <= 120) current = heading.id;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [headings]);

  if (headings.length < 2) return null;

  const activeLabel = headings.find((h) => h.id === activeId)?.text ?? "Contents";

  const list = (
    <ol className="toc-list">
      {headings.map((heading) => (
        <li key={heading.id} className={heading.level === 3 ? "toc-sub" : undefined}>
          <a
            href={`#${heading.id}`}
            aria-current={heading.id === activeId ? "location" : undefined}
            onClick={() => {
              setOpen(false);
              if (detailsRef.current) detailsRef.current.open = false;
            }}
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      {/* Mobile: a sticky bar that opens. Native <details> so it works without JS. */}
      <details ref={detailsRef} className="toc-mobile" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>
          <span className="toc-label">Contents</span>
          <span className="toc-current">{activeLabel}</span>
        </summary>
        <nav aria-label="Contents">{list}</nav>
      </details>

      {/* Desktop: a sticky column beside the article. */}
      <nav aria-label="Contents" className="toc-desktop">
        <h2 className="toc-heading">Contents</h2>
        {list}
      </nav>
    </>
  );
}
