"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  verifyCount: number;
  buildCount: number;
}

interface BulkResult {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

export function BulkActions({ verifyCount, buildCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ kind: string; result: BulkResult } | null>(null);

  // When there is nothing more to verify but items are sitting in
  // SOURCE_VERIFIED, the Build All button is "highlighted" so the operator
  // notices the next step.
  const allVerified = verifyCount === 0 && buildCount > 0;

  const call = (kind: string, url: string, body: object = {}) => {
    setError(null);
    setLastResult(null);
    startTransition(async () => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status}: ${text}`);
        }
        const data = (await res.json()) as BulkResult;
        setLastResult({ kind, result: data });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <h2 className="font-display text-lg text-ink">Bulk actions</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Operate on every item that is ready to advance. The worker advances items autonomously when
        the queue is idle, but these buttons let you kick the whole list at once.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || verifyCount === 0}
          onClick={() => call("verify-all", "/api/admin/checklist/bulk/verify-all")}
          className={`rounded px-4 py-2 text-sm text-white disabled:opacity-40 ${
            verifyCount > 0 ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-400"
          }`}
        >
          Verify all
          {verifyCount > 0 && (
            <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-xs">{verifyCount}</span>
          )}
        </button>
        <button
          type="button"
          disabled={pending || buildCount === 0}
          onClick={() =>
            call("build-all", "/api/admin/checklist/bulk/build-all", { includeReview: false })
          }
          className={`rounded px-4 py-2 text-sm text-white disabled:opacity-40 ${
            allVerified
              ? "bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300 ring-offset-2 animate-pulse"
              : buildCount > 0
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-slate-400"
          }`}
        >
          Build all
          {buildCount > 0 && (
            <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-xs">{buildCount}</span>
          )}
          {allVerified && <span className="ml-2 text-xs">⚡ ready</span>}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const reason = window.prompt(
              "Reject every DISCOVERED item. Reason?",
              "Bulk reject from dashboard",
            );
            if (!reason) return;
            call("reject-discovered", "/api/admin/checklist/bulk/reject-all", {
              approvalStatus: "DISCOVERED",
              reason,
            });
          }}
          className="rounded bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-40"
        >
          Reject all discovered
        </button>
      </div>

      {error && <p className="mt-3 rounded bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {lastResult && (
        <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span className="font-medium">{lastResult.kind}</span>: attempted{" "}
          {lastResult.result.attempted}, succeeded {lastResult.result.succeeded}, failed{" "}
          {lastResult.result.failed}.
          {lastResult.result.errors.length > 0 && (
            <>
              <br />
              <span className="text-xs">{lastResult.result.errors.slice(0, 3).join("; ")}</span>
            </>
          )}
        </p>
      )}
    </section>
  );
}
