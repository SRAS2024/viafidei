"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "page.global_error",
        kind: "client_global_boundary",
        digest: error.digest,
        route:
          typeof window !== "undefined" ? window.location.pathname : undefined,
        error: error.message,
        stack: error.stack,
      }),
    );
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: "4rem 1.5rem", textAlign: "center", fontFamily: "serif" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>An unexpected error occurred</h1>
          <p style={{ marginTop: "1rem", opacity: 0.7 }}>
            The application could not recover from this error.
          </p>
          {error.digest ? (
            <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", opacity: 0.5 }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: "2rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "9999px",
              border: "1px solid currentColor",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
