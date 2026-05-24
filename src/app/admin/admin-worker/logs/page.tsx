import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { LOG_SECTIONS, listAdminWorkerLogs } from "@/lib/admin-worker";
import type { AdminWorkerLogCategory, AdminWorkerLogSeverity } from "@prisma/client";

export const dynamic = "force-dynamic";

const SEVERITIES: AdminWorkerLogSeverity[] = ["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"];

const PERIODS: Record<string, { label: string; ms: number }> = {
  "24h": { label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  "7d": { label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  "30d": { label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
};

interface PageProps {
  searchParams: Promise<{
    category?: string;
    severity?: string;
    period?: string;
    contentType?: string;
    sourceHost?: string;
  }>;
}

/**
 * Admin Worker logs page. Spec section 21: log sections (Overview,
 * Worker passes, Source discovery, etc.) + filters (period, severity,
 * content type, source host, task type, status).
 *
 * The page reads `LOG_SECTIONS` from the engine so the section tabs
 * never drift from the engine's category enum.
 */
export default async function AdminWorkerLogsPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const category = (params.category ?? "OVERVIEW") as AdminWorkerLogCategory;
  const severity = params.severity as AdminWorkerLogSeverity | undefined;
  const period = params.period && PERIODS[params.period] ? params.period : "24h";
  const since = new Date(Date.now() - PERIODS[period].ms);
  const contentType = params.contentType?.trim() || undefined;
  const sourceHost = params.sourceHost?.trim() || undefined;

  const logs = await listAdminWorkerLogs(prisma, {
    category,
    severity,
    since,
    contentType,
    sourceHost,
    limit: 500,
  });

  const buildLink = (next: Partial<typeof params>) => {
    const sp = new URLSearchParams();
    sp.set("category", next.category ?? category);
    if (next.severity ?? severity) sp.set("severity", next.severity ?? severity!);
    sp.set("period", next.period ?? period);
    if (next.contentType ?? contentType) sp.set("contentType", next.contentType ?? contentType!);
    if (next.sourceHost ?? sourceHost) sp.set("sourceHost", next.sourceHost ?? sourceHost!);
    return `/admin/admin-worker/logs?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Admin Worker · Logs</h1>
          <p className="mt-1 font-serif text-ink-soft">
            Structured Admin Worker logs, grouped by section. {logs.length} row
            {logs.length === 1 ? "" : "s"} shown.
          </p>
        </div>
        <Link className="text-sm text-indigo-600 underline" href="/admin/admin-worker">
          ← Command Center
        </Link>
      </header>

      {/* Section tabs */}
      <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 text-xs">
        {LOG_SECTIONS.map((s) => {
          const active = s.category === category;
          return (
            <Link
              key={s.category}
              href={buildLink({ category: s.category })}
              className={`rounded px-2 py-1 ${
                active ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>

      {/* Filters */}
      <form
        className="flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-3 text-sm"
        method="get"
      >
        <input type="hidden" name="category" value={category} />
        <label className="flex flex-col">
          <span className="text-xs text-ink-soft">Period</span>
          <select name="period" defaultValue={period} className="rounded border px-2 py-1">
            {Object.entries(PERIODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-ink-soft">Severity</span>
          <select
            name="severity"
            defaultValue={severity ?? ""}
            className="rounded border px-2 py-1"
          >
            <option value="">Any</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-ink-soft">Content type</span>
          <input
            name="contentType"
            defaultValue={contentType ?? ""}
            placeholder="PRAYER"
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-ink-soft">Source host</span>
          <input
            name="sourceHost"
            defaultValue={sourceHost ?? ""}
            placeholder="www.vatican.va"
            className="rounded border px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-slate-900 px-3 py-1 text-white hover:bg-slate-800"
        >
          Apply filters
        </button>
      </form>

      {/* Log rows */}
      {logs.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-4 text-sm italic text-ink-soft">
          No logs match these filters.
        </p>
      ) : (
        <ul className="space-y-1">
          {logs.map((log) => (
            <li
              key={log.id}
              className="rounded border-l-4 border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
              data-severity={log.severity}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono">
                  [{log.createdAt.toISOString()}] {log.severity} {log.category} · {log.eventName}
                </span>
                {log.contentType && (
                  <span className="font-mono text-[10px] text-ink-soft">{log.contentType}</span>
                )}
              </div>
              <p className="mt-1 font-serif">{log.message}</p>
              {log.sourceHost && (
                <p className="text-[10px] text-ink-soft">source: {log.sourceHost}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
