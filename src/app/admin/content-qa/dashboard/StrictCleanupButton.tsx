"use client";

import { useState } from "react";

type StrictCleanupResponse = {
  ok: boolean;
  message?: string;
  summary?: {
    totalInspected: number;
    totalFlaggedReady: number;
    totalFlaggedUnready: number;
    totalHardDeleted: number;
  };
  durationMs?: number;
};

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; message: string }
  | { kind: "fail"; message: string };

/**
 * Trigger the strict content QA cleanup pass on demand. Same pass the
 * scheduler runs as part of catalog_revalidate, but on the admin's
 * timeline so they can verify recent changes immediately.
 */
export function StrictCleanupButton() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function trigger() {
    setState({ kind: "running" });
    try {
      const res = await fetch("/api/admin/content-qa/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json().catch(() => null)) as StrictCleanupResponse | null;
      if (!res.ok || !json?.ok) {
        setState({
          kind: "fail",
          message: json?.message ?? `Cleanup failed (HTTP ${res.status}). Check the server logs.`,
        });
        return;
      }
      const s = json.summary;
      const parts = s
        ? [
            `${s.totalInspected} inspected`,
            `${s.totalFlaggedReady} flagged ready`,
            `${s.totalFlaggedUnready} flagged unready`,
            `${s.totalHardDeleted} hard-deleted`,
          ]
        : ["complete"];
      setState({ kind: "ok", message: `Strict QA cleanup · ${parts.join(" · ")}.` });
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
        {state.kind === "running" ? "Running strict QA cleanup…" : "Run strict QA cleanup now"}
      </button>
      <p className="text-xs text-ink-faint">
        Validates every PUBLISHED row against its package contract. Flips render flags, hides
        invalid rows, and hard-deletes wrong-content rows with a RejectedContentLog entry.
      </p>
      {state.kind === "ok" ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      {state.kind === "fail" ? <p className="text-xs text-red-700">{state.message}</p> : null}
    </div>
  );
}
