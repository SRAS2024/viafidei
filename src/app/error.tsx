"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Structured log so the line shape matches the server-side logger and
    // log aggregators can pick out kind/route/digest without a regex.
    console.error(
      JSON.stringify({
        level: "error",
        msg: "page.render_failed",
        kind: "client_boundary",
        digest: error.digest,
        route:
          typeof window !== "undefined" ? window.location.pathname : undefined,
        error: error.message,
      }),
    );
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="vf-wordmark text-2xl text-ink">Something went wrong</h1>
      <p className="mt-4 text-sm text-ink/70">
        We encountered an unexpected error. Please try again, or return to the home page.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-ink/50">Reference: {error.digest}</p> : null}
      <div className="mt-8 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full border border-ink/20 px-5 py-2 text-sm hover:bg-ink/5"
        >
          Try again
        </button>
        <a href="/" className="rounded-full bg-ink px-5 py-2 text-sm text-paper hover:bg-ink/90">
          Home
        </a>
      </div>
    </div>
  );
}
