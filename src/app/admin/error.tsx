"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin-error-boundary]", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="vf-wordmark text-xl text-ink">Administrator error</h1>
      <p className="mt-4 text-sm text-ink/70">
        An unexpected error occurred while loading the admin panel.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-ink/50">Reference: {error.digest}</p> : null}
      <div className="mt-8 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full border border-ink/20 px-5 py-2 text-sm hover:bg-ink/5"
        >
          Try again
        </button>
        <a
          href="/admin"
          className="rounded-full bg-ink px-5 py-2 text-sm text-paper hover:bg-ink/90"
        >
          Admin home
        </a>
      </div>
    </div>
  );
}
