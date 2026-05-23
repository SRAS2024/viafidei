"use client";

import { useState, useTransition } from "react";

export function DeveloperReportButton() {
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setReport(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/diagnostics", { method: "POST" });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as { markdown: string };
        setReport(data.markdown);
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          navigator.clipboard.writeText(data.markdown).catch(() => undefined);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Generating…" : "Developer report"}
      </button>
      {report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-ink">
                Developer Report (copied to clipboard)
              </h2>
              <button
                type="button"
                onClick={() => setReport(null)}
                className="text-sm text-indigo-600 underline"
              >
                close
              </button>
            </div>
            <pre className="mt-4 max-h-[60vh] overflow-auto rounded bg-slate-50 p-3 text-xs">
              {report}
            </pre>
          </div>
        </div>
      )}
      {error && (
        <span className="ml-2 text-xs text-rose-700" title={error}>
          ⚠ failed
        </span>
      )}
    </>
  );
}
