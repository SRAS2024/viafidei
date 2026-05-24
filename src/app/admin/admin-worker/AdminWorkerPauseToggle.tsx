"use client";

import { useState, useTransition } from "react";

interface AdminWorkerPauseToggleProps {
  /** Initial paused state read from the AdminWorkerState singleton. */
  initialPaused: boolean;
  /** Optional reason shown when paused. */
  initialReason: string | null;
}

/**
 * Pause / resume toggle. Sits above the Developer Audit button on the
 * diagnostics page per the operator's spec. Pausing the Admin Worker
 * stops non-security work; the security defender continues to run.
 */
export function AdminWorkerPauseToggle({
  initialPaused,
  initialReason,
}: AdminWorkerPauseToggleProps) {
  const [paused, setPaused] = useState(initialPaused);
  const [reason, setReason] = useState<string | null>(initialReason);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      try {
        const next = !paused;
        const res = await fetch(`/api/admin/admin-worker/${next ? "pause" : "resume"}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(next ? { reason: "Paused from diagnostics page" } : {}),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Failed with ${res.status}`);
        }
        const body = (await res.json()) as { paused: boolean; pausedReason: string | null };
        setPaused(body.paused);
        setReason(body.pausedReason);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded border-l-4 px-4 py-3 ${
        paused
          ? "border-amber-500 bg-amber-50 text-amber-900"
          : "border-emerald-500 bg-emerald-50 text-emerald-900"
      }`}
      data-testid="admin-worker-pause-toggle"
      data-paused={paused ? "true" : "false"}
    >
      <div className="flex flex-col text-sm">
        <span className="font-display text-base">Admin Worker: {paused ? "Paused" : "Active"}</span>
        <span className="font-serif text-xs">
          {paused
            ? `Non-security tasks are paused${reason ? ` — ${reason}` : ""}. Security defense keeps running.`
            : "Autonomous content, diagnostics, design, security, and maintenance system is running."}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={isPending}
          className={`rounded px-3 py-1 text-sm font-medium text-white shadow-sm transition disabled:opacity-50 ${
            paused ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
          }`}
        >
          {isPending ? "Saving…" : paused ? "Resume Admin Worker" : "Pause Admin Worker"}
        </button>
        {error && (
          <span className="text-xs text-rose-700" title={error}>
            ⚠ failed
          </span>
        )}
      </div>
    </div>
  );
}
