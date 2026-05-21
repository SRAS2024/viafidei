"use client";

import { useState } from "react";

type Json = Record<string, unknown>;

type ActionState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; summary: string }
  | { kind: "fail"; summary: string };

function asRecord(value: unknown): Json {
  return value && typeof value === "object" ? (value as Json) : {};
}

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

/**
 * One admin action button. POSTs to its endpoint, then renders a
 * concise human summary of the JSON result (or a real error) inline
 * — so the operator never has to open the server logs to see what
 * happened.
 */
function ActionButton({
  endpoint,
  label,
  runningLabel,
  describe,
}: {
  endpoint: string;
  label: string;
  runningLabel: string;
  describe: (json: Json) => string;
}) {
  const [state, setState] = useState<ActionState>({ kind: "idle" });

  async function run() {
    setState({ kind: "running" });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json().catch(() => null)) as Json | null;
      if (!res.ok || !json || json.ok === false) {
        const err = json && typeof json.error === "string" ? json.error : "see server logs";
        setState({ kind: "fail", summary: `Failed (HTTP ${res.status}) — ${err}.` });
        return;
      }
      setState({ kind: "ok", summary: describe(json) });
    } catch (err) {
      setState({
        kind: "fail",
        summary: err instanceof Error ? err.message : "Network error — try again.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-ink/10 bg-paper p-4">
      <button
        type="button"
        className="vf-btn vf-btn-primary"
        onClick={() => void run()}
        disabled={state.kind === "running"}
        aria-busy={state.kind === "running"}
      >
        {state.kind === "running" ? runningLabel : label}
      </button>
      {state.kind === "ok" ? (
        <p className="font-mono text-xs text-emerald-700">{state.summary}</p>
      ) : null}
      {state.kind === "fail" ? (
        <p className="font-mono text-xs text-red-700">{state.summary}</p>
      ) : null}
    </div>
  );
}

/**
 * Admin worker / queue / content-QA operations panel. Every button
 * maps to a protected admin API route.
 */
export function WorkerOpsPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="worker-ops-panel">
      <ActionButton
        endpoint="/api/admin/worker/run-once"
        label="Run worker once"
        runningLabel="Running one worker pass…"
        describe={(j) => {
          if (!j.jobLeased) return "No job was leased — the queue is empty.";
          return `Processed ${String(j.jobKind)} job — result: ${String(j.result)}${
            j.failureReason ? ` (${String(j.failureReason)})` : ""
          }. Heartbeat written: ${j.heartbeatWritten ? "yes" : "no"}.`;
        }}
      />
      <ActionButton
        endpoint="/api/admin/queue/repair"
        label="Repair queue"
        runningLabel="Repairing queue…"
        describe={(j) => {
          const r = asRecord(j.report);
          return `Stale jobs recovered: ${num(r.staleRunningJobsRecovered)} · retryable failed requeued: ${num(
            r.retryableFailedRequeued,
          )} · permanently failed left alone: ${num(r.permanentlyFailedLeftAlone)}.`;
        }}
      />
      <ActionButton
        endpoint="/api/admin/sources/repair-jobs"
        label="Repair source jobs"
        runningLabel="Repairing source jobs…"
        describe={(j) => {
          const r = asRecord(j.report);
          return `Factory-ready sources: ${num(r.factoryReadySources)} · zero-job sources: ${num(
            r.sourcesWithZeroJobs,
          )} · discovery jobs created: ${num(r.discoveryJobsCreated)}.`;
        }}
      />
      <ActionButton
        endpoint="/api/admin/growth/recover"
        label="Recover content growth"
        runningLabel="Running growth recovery…"
        describe={(j) => {
          const r = asRecord(j.report);
          return `Recovery ${r.ranRecovery ? "ran" : "skipped"} · failing stage: ${String(
            r.failingStage,
          )}.`;
        }}
      />
      <ActionButton
        endpoint="/api/admin/content-qa/audit-raw-rows"
        label="Audit existing raw rows"
        runningLabel="Auditing raw rows…"
        describe={(j) => {
          const r = asRecord(j.report);
          return `${num(r.totalRows)} rows · ${num(r.totalRawRows)} raw · ${num(
            r.totalConvertible,
          )} convertible through factory.`;
        }}
      />
      <ActionButton
        endpoint="/api/admin/content-qa/convert-raw-rows"
        label="Convert valid raw rows through factory"
        runningLabel="Enqueueing factory conversion…"
        describe={(j) =>
          `Conversion sweep enqueued — ${num(j.convertibleRows)} convertible row(s) will be re-gated by strict QA.`
        }
      />
      <ActionButton
        endpoint="/api/admin/content-qa/strict-cleanup"
        label="Run strict cleanup and explain results"
        runningLabel="Running strict cleanup…"
        describe={(j) => {
          const s = asRecord(j.summary);
          return `Inspected ${num(s.totalInspected)} · made public-ready ${num(
            s.totalFlaggedReady,
          )} · marked unready ${num(s.totalFlaggedUnready)} · hard-deleted ${num(
            s.totalHardDeleted,
          )}.`;
        }}
      />
    </div>
  );
}
