"use client";

import { useState } from "react";

type Period = "24h" | "week" | "month";

const LABELS: Record<Period, string> = {
  "24h": "Last 24 hours",
  week: "Last 7 days",
  month: "Last 30 days",
};

export function DeveloperAuditButton() {
  const [period, setPeriod] = useState<Period>("24h");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(
        `/api/admin/diagnostics/developer-audit?period=${encodeURIComponent(period)}`,
        { method: "GET" },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text || "Failed to generate audit"}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `viafidei-developer-audit-${period}-${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value as Period)}
        disabled={pending}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
        aria-label="Developer audit period"
      >
        {(["24h", "week", "month"] as const).map((p) => (
          <option key={p} value={p}>
            {LABELS[p]}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={download}
        className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Generating PDF…" : "Download Developer Audit (PDF)"}
      </button>
      {error && (
        <span className="ml-2 text-xs text-rose-700" title={error}>
          ⚠ failed
        </span>
      )}
    </div>
  );
}
