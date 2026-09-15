"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="wrap notice">
      <h1 className="headline-page">Something went wrong</h1>
      <p className="empty">
        This page could not be loaded. Reload to try again. If it keeps happening, the newsroom may be temporarily
        unreachable.
      </p>
      <p>
        <button type="button" className="button" onClick={() => reset()}>
          Reload this page
        </button>
      </p>
    </div>
  );
}
