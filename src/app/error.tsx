"use client";

import { useEffect } from "react";
import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";

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
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
        error: error.message,
      }),
    );
  }, [error]);

  return (
    <div className="vf-message">
      <PageHero
        title="Something went wrong"
        subtitle="We encountered an unexpected error. Please try again, or return to the home page."
      />
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="vf-btn vf-btn-primary">
          Try again
        </button>
        <Link href="/" className="vf-btn vf-btn-ghost">
          Home
        </Link>
      </div>
      {error.digest ? <p className="vf-fineprint mt-4">Reference: {error.digest}</p> : null}
    </div>
  );
}
