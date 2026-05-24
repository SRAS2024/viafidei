import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { runAllDiagnostics } from "@/lib/diagnostics";
import { DeveloperReportButton } from "./DeveloperReportButton";
import { DeveloperAuditButton } from "./DeveloperAuditButton";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const results = await runAllDiagnostics();
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const r of results) counts[r.status]++;

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">System diagnostics</h1>
          <p className="mt-1 font-serif text-ink-soft">
            Live health check of every part of the checklist-first system.{" "}
            <span className="font-medium text-green-700">{counts.pass} pass</span> ·{" "}
            <span className="font-medium text-amber-700">{counts.warn} warn</span> ·{" "}
            <span className="font-medium text-rose-700">{counts.fail} fail</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-sm">
          <DeveloperAuditButton />
          <div className="flex items-center gap-3">
            <DeveloperReportButton />
            <Link className="text-indigo-600 underline" href="/admin/checklist">
              ← dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="space-y-2">
        {results.map((r) => {
          // Status colour scheme requested by the operator:
          //   pass  → green
          //   warn  → yellow
          //   fail  → red (with black text highlighted in red)
          const tone =
            r.status === "pass"
              ? "border-green-500 bg-green-50 text-green-900"
              : r.status === "warn"
                ? "border-amber-500 bg-amber-50 text-amber-900"
                : "border-rose-600 bg-rose-100 text-black";
          const badge =
            r.status === "pass"
              ? "bg-green-600 text-white"
              : r.status === "warn"
                ? "bg-amber-500 text-black"
                : "bg-rose-600 text-white";
          return (
            <div
              key={r.key}
              className={`rounded border-l-4 ${tone} px-4 py-3`}
              data-status={r.status}
              data-key={r.key}
            >
              <div className="flex items-baseline justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-xs uppercase ${badge}`}>
                    {r.status}
                  </span>
                  <span className="font-display text-lg">{r.label}</span>
                </div>
                {r.metric != null && (
                  <span className="font-mono text-xs">{r.metric.toFixed(2)}</span>
                )}
              </div>
              <p className="mt-1 font-serif text-sm">{r.summary}</p>
              {r.details && r.details.length > 0 && (
                <ul className="mt-2 list-disc pl-6 text-xs">
                  {r.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
              {r.suggestedAction && <p className="mt-2 text-xs italic">→ {r.suggestedAction}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
