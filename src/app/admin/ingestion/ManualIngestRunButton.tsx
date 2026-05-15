"use client";

import { useState } from "react";

type RunResponse = {
  ok: boolean;
  message?: string;
  result?: {
    totalJobs?: number;
    runs?: Array<{
      jobName: string;
      sourceHost: string;
      adapterFound: boolean;
      summary: {
        recordsSeen: number;
        recordsCreated: number;
        recordsUpdated: number;
        recordsSkipped: number;
        recordsFailed: number;
        errorMessage?: string | null;
      };
    }>;
  };
};

type Props = {
  initialMode: "constant" | "maintenance";
};

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; message: string }
  | { kind: "fail"; message: string };

/**
 * Admin button that triggers an ingestion run on demand. Reports a
 * clear, count-based success message or a real error message inline so
 * the operator does not have to refresh the page or open the server
 * logs to see what happened.
 */
export function ManualIngestRunButton({ initialMode }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function trigger() {
    setState({ kind: "running" });
    try {
      const res = await fetch("/api/admin/ingestion/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json().catch(() => null)) as RunResponse | null;
      if (!res.ok || !json?.ok) {
        setState({
          kind: "fail",
          message: json?.message ?? `Run failed (HTTP ${res.status}). Check the server logs.`,
        });
        return;
      }
      const total = json.result?.totalJobs ?? 0;
      const runs = json.result?.runs ?? [];
      const totals = runs.reduce(
        (acc, r) => {
          acc.created += r.summary.recordsCreated;
          acc.updated += r.summary.recordsUpdated;
          acc.skipped += r.summary.recordsSkipped;
          acc.failed += r.summary.recordsFailed;
          return acc;
        },
        { created: 0, updated: 0, skipped: 0, failed: 0 },
      );
      const parts = [
        `${total} job${total === 1 ? "" : "s"} ran`,
        `${totals.created} created`,
        `${totals.updated} updated`,
        `${totals.skipped} skipped`,
        `${totals.failed} failed`,
      ];
      setState({
        kind: "ok",
        message:
          `Ingestion run finished · ${parts.join(" · ")}.` +
          (totals.failed > 0 ? " Some jobs failed — see /admin/logs/ingestion." : ""),
      });
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
        {state.kind === "running" ? "Running ingestion…" : "Run ingestion now"}
      </button>
      <p className="text-xs text-ink-faint">
        Current mode:{" "}
        <span className="font-medium">
          {initialMode === "constant"
            ? "constant fill (targets unmet)"
            : "maintenance (twice weekly)"}
        </span>
      </p>
      {state.kind === "ok" ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      {state.kind === "fail" ? <p className="text-xs text-red-700">{state.message}</p> : null}
    </div>
  );
}
