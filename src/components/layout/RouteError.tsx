"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
};

export function RouteError({ error, reset, title, description }: Props) {
  useEffect(() => {
    console.error("[route-error]", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-2 py-12 text-center">
      <h1 className="vf-wordmark text-2xl text-ink">{title ?? "Something went wrong"}</h1>
      <p className="mt-4 text-sm text-ink/70">
        {description ??
          "We couldn't load this section. Use the navigation above to continue, or try again."}
      </p>
      {error.digest ? <p className="mt-2 text-xs text-ink/50">Reference: {error.digest}</p> : null}
      <div className="mt-8 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full border border-ink/20 px-5 py-2 text-sm hover:bg-ink/5"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
