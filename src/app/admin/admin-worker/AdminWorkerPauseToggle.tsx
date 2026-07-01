"use client";

import { useState, useTransition } from "react";

import { AdminWorkerIcon } from "./_ui";

interface AdminWorkerPauseToggleProps {
  /** Initial paused state read from the AdminWorkerState singleton. */
  initialPaused: boolean;
  /** Optional reason shown when paused. */
  initialReason: string | null;
  /** Whether the worker process is live (recent heartbeat). */
  workerLive: boolean;
  /** Human "17h ago" string for the last heartbeat. */
  heartbeatAgo: string;
}

/**
 * Pause / resume toggle + live status banner. Sits at the top of the Command
 * Center. It shows the worker's REAL state, not just the pause flag:
 *   - Paused   — an operator paused it (only security runs).
 *   - Offline  — not paused, but no recent heartbeat (the process isn't
 *                running), so it says so and points at `npm run worker`.
 *   - Running  — not paused and the heartbeat is fresh.
 * This is why the banner no longer says "Active" while the heartbeat is 17h
 * stale (the bug the audit + screenshots surfaced).
 */
export function AdminWorkerPauseToggle({
  initialPaused,
  initialReason,
  workerLive,
  heartbeatAgo,
}: AdminWorkerPauseToggleProps) {
  const [paused, setPaused] = useState(initialPaused);
  const [reason, setReason] = useState<string | null>(initialReason);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Three-way live state. "Offline" only applies when NOT paused (a paused
  // worker is intentionally idle, not crashed).
  const status: "paused" | "offline" | "running" = paused
    ? "paused"
    : workerLive
      ? "running"
      : "offline";

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

  const frame =
    status === "running"
      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
      : status === "paused"
        ? "border-amber-500 bg-amber-50 text-amber-900"
        : "border-rose-500 bg-rose-50 text-rose-900";
  const label = status === "running" ? "Running" : status === "paused" ? "Paused" : "Offline";
  const detail =
    status === "running"
      ? "Autonomous content, diagnostics, design, security, and maintenance system is running."
      : status === "paused"
        ? `Non-security tasks are paused${reason ? ` — ${reason}` : ""}. Security defense keeps running.`
        : `No heartbeat for ${heartbeatAgo} — the worker process is not running. Start it with \`npm run worker\`. Nothing publishes while the loop is down.`;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded border-l-4 px-4 py-3 ${frame}`}
      data-testid="admin-worker-pause-toggle"
      data-paused={paused ? "true" : "false"}
      data-status={status}
    >
      <div className="flex items-center gap-3 text-sm">
        <AdminWorkerIcon className="h-7 w-7 shrink-0" />
        <div className="flex flex-col">
          <span className="font-display text-base">Admin Worker: {label}</span>
          <span className="font-serif text-xs">{detail}</span>
        </div>
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
