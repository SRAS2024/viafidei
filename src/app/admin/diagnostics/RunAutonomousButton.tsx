"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface CycleResult {
  attempted: number;
  succeeded: number;
  failed: number;
  bootstrapped: { attempted: number; created: number };
  promoted: number;
  errors?: string[];
}

/**
 * Kick the worker in-process from the diagnostics page. Calls
 * /api/admin/checklist/bulk/run-autonomous so an admin can advance the
 * pipeline without leaving the diagnostics view.
 */
export function RunAutonomousButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CycleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/checklist/bulk/run-autonomous", { method: "POST" });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as CycleResult;
        setResult(data);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {pending ? "Running…" : "⚡ Run autonomous now"}
      </button>
      {result && (
        <span className="text-xs text-emerald-800" title={(result.errors ?? []).join("\n")}>
          bootstrapped {result.bootstrapped.created} · promoted {result.promoted} · published{" "}
          {result.succeeded}/{result.attempted}
        </span>
      )}
      {error && (
        <span className="text-xs text-rose-700" title={error}>
          ⚠ failed
        </span>
      )}
    </div>
  );
}
