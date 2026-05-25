"use client";

import { useState, useTransition } from "react";

interface MakeoverResult {
  taskId: string;
  draftId: string | null;
  status: string | null;
  finalScore: number;
  sectionsChanged: string[];
  reasonSummary: string;
}

/**
 * Operator-triggered "Request Homepage Makeover" (spec §22).
 * Creates an Admin Worker task + runs the homepage mutator inline.
 * Small high-confidence changes auto-publish; major changes file a
 * draft for review.
 */
export function RequestHomepageMakeoverButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MakeoverResult | null>(null);

  const run = () => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/admin-worker/request-homepage", {
          method: "POST",
        });
        if (!res.ok) {
          throw new Error(`${res.status}: ${(await res.text()) || "failed"}`);
        }
        setResult((await res.json()) as MakeoverResult);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="rounded bg-violet-600 px-3 py-1 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {isPending ? "Running makeover…" : "Request Homepage Makeover"}
      </button>
      {error && (
        <p className="text-xs text-rose-700" title={error}>
          ⚠ {error}
        </p>
      )}
      {result && (
        <div className="rounded border border-slate-300 bg-slate-50 p-2 text-xs">
          <p className="font-mono">
            draft={result.draftId ?? "—"} · status={result.status ?? "—"} · score=
            {result.finalScore.toFixed(2)}
          </p>
          <p className="mt-1 italic">{result.reasonSummary}</p>
          {result.sectionsChanged.length > 0 && (
            <p className="mt-1">Changed: {result.sectionsChanged.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
