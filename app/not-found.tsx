import Link from "next/link";
import type { Metadata } from "next";
import { SearchForm } from "@/components/SearchForm";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="wrap notice">
      <h1 className="headline-page">That page does not exist</h1>
      <p className="empty">
        It may have moved when the site changed address, or the link was mistyped. Try searching for the story, or go
        back to the <Link href="/" className="link">front page</Link>.
      </p>
      <SearchForm />
    </div>
  );
}
