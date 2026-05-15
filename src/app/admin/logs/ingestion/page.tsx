import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

const STATUSES = ["RUNNING", "SUCCESS", "PARTIAL", "FAILED", "PENDING"] as const;

type Props = {
  searchParams: Promise<{
    status?: string;
    jobName?: string;
  }>;
};

function statusColor(status: string) {
  switch (status) {
    case "SUCCESS":
      return "text-emerald-700";
    case "FAILED":
      return "text-red-700";
    case "PARTIAL":
      return "text-amber-700";
    case "RUNNING":
      return "text-blue-700";
    default:
      return "text-ink-soft";
  }
}

/**
 * Dedicated /admin/logs/ingestion page — reads from IngestionJobRun.
 *
 * Shows every recorded run with: timestamp, source/job, status, the
 * full per-run counts (seen / created / updated / skipped / failed /
 * review-required), the error message when present, and the duration.
 * Lets the admin filter by status (RUNNING / SUCCESS / PARTIAL /
 * FAILED) or by job name.
 */
export default async function IngestionRunLogPage({ searchParams }: Props) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const sp = await searchParams;
  const status = (STATUSES as ReadonlyArray<string>).includes(sp.status ?? "")
    ? (sp.status as (typeof STATUSES)[number])
    : undefined;
  const jobName = (sp.jobName ?? "").trim() || undefined;

  const runs = await prisma.ingestionJobRun.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(jobName ? { job: { jobName: { contains: jobName, mode: "insensitive" } } } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: 200,
    include: { job: { include: { source: true } } },
  });

  const totalRuns = await prisma.ingestionJobRun.count();
  const failed24h = await prisma.ingestionJobRun.count({
    where: {
      startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      status: { in: ["FAILED", "PARTIAL"] },
    },
  });

  function buildHref(params: Record<string, string | undefined>): string {
    const out = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) out.set(k, v);
    }
    const qs = out.toString();
    return qs ? `?${qs}` : "";
  }

  return (
    <AdminSection
      titleKey="admin.card.logs"
      subtitle="Ingestion runs — every IngestionJobRun recorded by the scheduler. Each row shows the source, job, status, counts, duration, error message (when present), and start time."
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href="/admin/logs" className="vf-nav-link">
          ← Logs
        </Link>
        <Link href="/admin/logs/data-management" className="vf-nav-link">
          Data Management →
        </Link>
        <Link href="/admin/diagnostics/ingestion" className="vf-nav-link">
          Ingestion diagnostics →
        </Link>
        <Link href="/admin/ingestion" className="vf-nav-link">
          Open Ingestion →
        </Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="vf-card rounded-sm p-4">
          <p className="vf-eyebrow text-ink-faint">Total runs</p>
          <p className="mt-1 font-display text-2xl">{totalRuns.toLocaleString()}</p>
        </div>
        <div className="vf-card rounded-sm p-4">
          <p className="vf-eyebrow text-ink-faint">Failed (24h)</p>
          <p className={`mt-1 font-display text-2xl ${failed24h > 0 ? "text-red-700" : ""}`}>
            {failed24h.toLocaleString()}
          </p>
        </div>
        <div className="vf-card rounded-sm p-4">
          <p className="vf-eyebrow text-ink-faint">Showing</p>
          <p className="mt-1 font-display text-2xl">{runs.length}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/logs/ingestion"
          className={`vf-btn !py-1 !px-3 text-xs ${!status ? "vf-btn-primary" : "vf-btn-ghost"}`}
        >
          All statuses
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/logs/ingestion${buildHref({ status: s, jobName })}`}
            className={`vf-btn !py-1 !px-3 text-xs ${status === s ? "vf-btn-primary" : "vf-btn-ghost"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="vf-card overflow-x-auto rounded-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.2em] text-ink-faint">
              <th className="px-4 py-4 sm:px-5">Started</th>
              <th className="px-4 py-4 sm:px-5">Source</th>
              <th className="px-4 py-4 sm:px-5">Job</th>
              <th className="px-4 py-4 sm:px-5">Status</th>
              <th className="px-4 py-4 sm:px-5">Counts</th>
              <th className="hidden px-4 py-4 sm:table-cell sm:px-5">Duration</th>
              <th className="hidden px-4 py-4 lg:table-cell lg:px-5">Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center font-serif text-ink-faint">
                  No ingestion runs match this filter yet.
                </td>
              </tr>
            ) : (
              runs.map((r) => {
                const durationMs =
                  r.finishedAt && r.startedAt
                    ? r.finishedAt.getTime() - r.startedAt.getTime()
                    : null;
                return (
                  <tr key={r.id} className="border-b border-ink/5 font-serif">
                    <td className="px-4 py-3 text-ink-faint sm:px-5">
                      {r.startedAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="break-words px-4 py-3 sm:px-5">{r.job.source.name}</td>
                    <td className="break-words px-4 py-3 text-ink-soft sm:px-5">{r.job.jobName}</td>
                    <td className={`px-4 py-3 font-medium sm:px-5 ${statusColor(r.status)}`}>
                      {r.status}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft sm:px-5">
                      <span title="seen">{r.recordsSeen}s</span> /{" "}
                      <span title="created">{r.recordsCreated}c</span> /{" "}
                      <span title="updated">{r.recordsUpdated}u</span> /{" "}
                      <span title="skipped">{r.recordsSkipped}k</span> /{" "}
                      <span title="failed" className={r.recordsFailed > 0 ? "text-red-700" : ""}>
                        {r.recordsFailed}f
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-faint sm:table-cell sm:px-5">
                      {durationMs !== null ? `${Math.round(durationMs / 100) / 10}s` : "—"}
                    </td>
                    <td className="hidden break-words px-4 py-3 text-xs text-ink-faint lg:table-cell lg:px-5">
                      {r.errorMessage ? r.errorMessage.slice(0, 200) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {runs.length > 0 ? (
        <p className="mt-4 text-center font-serif text-xs text-ink-faint">
          Showing the most recent {runs.length} run{runs.length === 1 ? "" : "s"}. Filter by status
          using the buttons above; click into /admin/logs/data-management to see the per-item action
          log for each run.
        </p>
      ) : null}
    </AdminSection>
  );
}
