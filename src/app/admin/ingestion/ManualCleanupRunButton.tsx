"use client";

import { useState } from "react";

type CleanupResponse = {
  ok: boolean;
  message?: string;
  miscategorised?: { totalArchived: number; buckets: Array<{ entity: string; archived: number }> };
  duplicatePrayers?: number;
  hardDeleted?: { totalDeleted: number; buckets: Array<{ entity: string; deleted: number }> };
  autoCleanupEnabled?: boolean;
  hardDeleteAfterDays?: number;
  durationMs?: number;
};

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; message: string }
  | { kind: "fail"; message: string };

/**
 * Admin button to trigger the Data Management cleanup passes on
 * demand. Mirrors the work the cron job does:
 *
 *   • cleanupMiscategorisedContent
 *   • archiveDuplicatePrayers
 *   • purgeStaleArchivedContent
 *
 * Shows a clear success or failure message (with counts) inline.
 */
export function ManualCleanupRunButton() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function trigger() {
    setState({ kind: "running" });
    try {
      const res = await fetch("/api/admin/data-management/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json().catch(() => null)) as CleanupResponse | null;
      if (!res.ok || !json?.ok) {
        setState({
          kind: "fail",
          message: json?.message ?? `Cleanup failed (HTTP ${res.status}). Check the server logs.`,
        });
        return;
      }
      const archived = json.miscategorised?.totalArchived ?? 0;
      const dupes = json.duplicatePrayers ?? 0;
      const purged = json.hardDeleted?.totalDeleted ?? 0;
      const parts = [
        `${archived} archived`,
        `${dupes} duplicate prayer${dupes === 1 ? "" : "s"} archived`,
        `${purged} permanently deleted`,
      ];
      setState({ kind: "ok", message: `Cleanup complete · ${parts.join(" · ")}.` });
    } catch (err) {
      setState({
        kind: "fail",
        message: err instanceof Error ? err.message : "Network error — try again.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="vf-btn vf-btn-primary"
        onClick={() => void trigger()}
        disabled={state.kind === "running"}
        aria-busy={state.kind === "running"}
      >
        {state.kind === "running" ? "Running cleanup…" : "Run data cleanup now"}
      </button>
      <p className="text-xs text-ink-faint">
        Runs the misc-content archive sweep, duplicate-prayer collapse, and the hard-delete pass
        immediately. Skipped passes are no-ops.
      </p>
      {state.kind === "ok" ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      {state.kind === "fail" ? <p className="text-xs text-red-700">{state.message}</p> : null}
    </div>
  );
}
