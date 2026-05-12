"use client";

import { useState } from "react";

type Props = {
  initialMode: "constant" | "maintenance";
};

export function ManualIngestRunButton({ initialMode }: Props) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function trigger() {
    setRunning(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/ingestion/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: boolean; result?: { totalJobs?: number } }
        | null;
      if (!res.ok || !json?.ok) {
        setError("Run failed. Check the server logs.");
        return;
      }
      const total = json.result?.totalJobs ?? 0;
      setStatus(`Triggered. ${total} job${total === 1 ? "" : "s"} ran. Refresh to see results.`);
    } catch {
      setError("Network error — try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="vf-btn vf-btn-primary"
        onClick={() => void trigger()}
        disabled={running}
        aria-busy={running}
      >
        {running ? "Running…" : "Run all jobs now"}
      </button>
      <p className="text-xs text-ink-faint">
        Current mode:{" "}
        <span className="font-medium">
          {initialMode === "constant"
            ? "constant fill (targets unmet)"
            : "maintenance (twice weekly)"}
        </span>
      </p>
      {status ? <p className="text-xs text-emerald-700">{status}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
