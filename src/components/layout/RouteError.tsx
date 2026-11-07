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
      <h1 className="vf-section-title text-ink">{title ?? "Something went wrong"}</h1>
      <p className="vf-section-lede">
        {description ??
          "We couldn't load this section. Use the navigation above to continue, or try again."}
      </p>
      {error.digest ? <p className="vf-fineprint mt-2">Reference: {error.digest}</p> : null}
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="vf-btn vf-btn-primary">
          Try again
        </button>
      </div>
    </div>
  );
}
