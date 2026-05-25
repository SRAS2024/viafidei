"use client";

import { useState, useTransition } from "react";

type PassKind =
  | "diagnostics"
  | "content_goal"
  | "source_discovery"
  | "homepage"
  | "source_repair"
  | "report"
  | "cleanup"
  | "security";

const PASS_LABELS: Record<PassKind, string> = {
  diagnostics: "Run diagnostic pass",
  content_goal: "Run content goal pass",
  source_discovery: "Run source discovery pass",
  homepage: "Run homepage pass",
  source_repair: "Run source repair pass",
  report: "Run report generation",
  cleanup: "Run cleanup pass",
  security: "Run security defense pass",
};

interface AdminWorkerControlsProps {
  initialPaused: boolean;
}

/**
 * Command Center control panel. Lets the operator hand-trigger any of
 * the named passes. Each button POSTs `/api/admin/admin-worker/run`
 * with the chosen `passType`. Disabled when the worker is paused
 * (except for the security pass, which always runs).
 */
export function AdminWorkerControls({ initialPaused }: AdminWorkerControlsProps) {
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<PassKind | null>(null);
  const [, startTransition] = useTransition();

  const run = (kind: PassKind) => {
    setError(null);
    setActive(kind);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/admin-worker/run`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ passType: kind }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Failed with ${res.status}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setActive(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.keys(PASS_LABELS) as PassKind[]).map((kind) => {
          const securityAllowed = kind === "security";
          const disabled = (initialPaused && !securityAllowed) || active != null;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => run(kind)}
              disabled={disabled}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {active === kind ? `Running ${PASS_LABELS[kind].toLowerCase()}…` : PASS_LABELS[kind]}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-xs text-rose-700" title={error}>
          ⚠ {error}
        </p>
      )}
      {initialPaused && (
        <p className="text-xs italic text-amber-700">
          Admin Worker is paused — only the security defense pass will run.
        </p>
      )}
    </div>
  );
}
