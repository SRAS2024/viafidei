import { redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma, AdminWorkerLogSeverity } from "@prisma/client";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: "bg-slate-100 text-slate-700",
  INFO: "bg-blue-100 text-blue-800",
  WARN: "bg-amber-100 text-amber-800",
  ERROR: "bg-rose-100 text-rose-800",
  CRITICAL: "bg-rose-200 text-rose-900",
};

export default async function AdminWorkerLogPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; step?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const { level, step } = await searchParams;

  const where: Prisma.AdminWorkerLogWhereInput = {
    ...(level ? { severity: level.toUpperCase() as AdminWorkerLogSeverity } : {}),
    ...(step ? { eventName: { contains: step, mode: "insensitive" } } : {}),
  };

  const logs = await prisma.adminWorkerLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Admin Worker log</h1>
          <p className="mt-1 font-serif text-ink-soft">
            Last {logs.length} entries. Filter via{" "}
            <code className="px-1 py-0.5 bg-slate-100 rounded">?level=warn</code> or{" "}
            <code className="px-1 py-0.5 bg-slate-100 rounded">?step=publish</code>.
          </p>
        </div>
        <Link className="text-sm text-indigo-600 underline" href="/admin/logs">
          ← logs
        </Link>
      </header>

      <div className="space-y-1">
        {logs.length === 0 ? (
          <p className="rounded border border-slate-200 bg-white p-6 text-center font-serif text-ink-faint">
            No Admin Worker logs match the current filter.
          </p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="rounded border border-slate-200 bg-white p-3 text-sm"
              data-level={log.severity}
            >
              <div className="flex items-baseline gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${LEVEL_COLORS[log.severity] ?? "bg-slate-100"}`}
                >
                  {log.severity}
                </span>
                <span className="font-medium text-ink">{log.eventName}</span>
                <span className="font-serif text-ink-soft">
                  {log.category}
                  {log.contentType ? ` · ${log.contentType}` : ""}
                </span>
                <span className="ml-auto text-xs text-ink-faint">
                  {log.createdAt.toISOString()}
                </span>
              </div>
              <p className="mt-1 font-serif text-ink">{log.message}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-ink-soft">
                {log.sourceHost && <span>host: {log.sourceHost}</span>}
                {log.sourceUrl && (
                  <a className="text-indigo-600 underline break-all" href={log.sourceUrl}>
                    {log.sourceUrl}
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
