import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getCleanupHealth, getSystemHealthReport, type HealthScore } from "@/lib/content-qa";
import { getDashboardWarnings, getAdminDataSourceCard } from "@/lib/diagnostics";
import { prisma } from "@/lib/db/client";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

type HealthRow = {
  key: string;
  label: string;
  status: "healthy" | "warn" | "fail" | "unknown";
  score?: number;
  summary: string;
  hasQueryFailures?: boolean;
};

function statusClass(status: HealthRow["status"]): string {
  switch (status) {
    case "healthy":
      return "text-emerald-700";
    case "warn":
      return "text-amber-700";
    case "fail":
      return "text-red-700";
    default:
      return "text-ink-soft";
  }
}

function scoreRow(s: HealthScore, label?: string): HealthRow {
  return {
    key: s.key,
    label: label ?? s.label,
    status: s.status,
    score: s.score,
    summary: s.summary,
    hasQueryFailures: s.hasQueryFailures,
  };
}

async function safeRow(
  key: string,
  label: string,
  fn: () => Promise<{ status: HealthRow["status"]; summary: string }>,
): Promise<HealthRow> {
  try {
    const out = await fn();
    return { key, label, status: out.status, summary: out.summary };
  } catch (err) {
    return {
      key,
      label,
      status: "fail",
      summary: `Query failed: ${err instanceof Error ? err.message : String(err)}`,
      hasQueryFailures: true,
    };
  }
}

/**
 * Section 5 of the strict QA spec asks for a Data Management Health
 * panel showing 10 rows:
 *   queue / worker / ingestion / source / strict QA / cleanup /
 *   threshold / report / admin email / database.
 *
 * Each row uses an existing health-score signal where possible and a
 * lightweight probe where the signal is binary (admin email
 * configured? database reachable?).
 */
export default async function DataManagementHealthPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const [report, cleanup, dataSourceCard, dashboardWarnings] = await Promise.all([
    getSystemHealthReport().catch(() => null),
    getCleanupHealth().catch(() => null),
    getAdminDataSourceCard().catch(() => null),
    getDashboardWarnings().catch(() => [] as Awaited<ReturnType<typeof getDashboardWarnings>>),
  ]);

  // Database health — probe a single cheap query.
  const dbHealth = await safeRow("database", "Database health", async () => {
    const count = await prisma.dataManagementLog.count();
    return { status: "healthy" as const, summary: `Reachable (${count} DM log rows).` };
  });

  // Admin email health — REUSE the env check the email diagnostic
  // already exposes.
  const adminEmailHealth: HealthRow = {
    key: "admin_email",
    label: "Admin email health",
    status: process.env.ADMIN_EMAIL ? "healthy" : "warn",
    summary: process.env.ADMIN_EMAIL
      ? `ADMIN_EMAIL configured (${process.env.ADMIN_EMAIL.replace(/(.{2}).*(@.*)/, "$1***$2")}).`
      : "ADMIN_EMAIL not set — admin notifications silently skipped.",
  };

  // Report health — fresh if any flow row has lastSentAt within 35 days.
  const reportHealth = await safeRow("report", "Report health", async () => {
    const recent = await prisma.adminNotificationState.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    if (!recent) {
      return { status: "warn" as const, summary: "No admin reports have ever been sent." };
    }
    const ageMs = Date.now() - recent.updatedAt.getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    if (ageDays > 35) {
      return {
        status: "warn" as const,
        summary: `Last report dispatched ${Math.round(ageDays)} days ago — biweekly is overdue.`,
      };
    }
    return {
      status: "healthy" as const,
      summary: `Last report dispatched ${Math.round(ageDays)} days ago.`,
    };
  });

  // Ingestion health — derived from "completed jobs in the last 24h".
  const ingestionHealth = await safeRow("ingestion", "Ingestion health", async () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const completed = await prisma.ingestionJobQueue.count({
      where: { status: "completed", finishedAt: { gte: dayAgo } },
    });
    if (completed === 0) {
      return { status: "warn" as const, summary: "No completed jobs in the last 24h." };
    }
    return {
      status: "healthy" as const,
      summary: `${completed} jobs completed in the last 24h.`,
    };
  });

  const rows: HealthRow[] = [
    report
      ? scoreRow(report.scores.system, "System health (composite)")
      : {
          key: "system",
          label: "System health (composite)",
          status: "unknown",
          summary: "Unable to compute system health.",
        },
    report
      ? scoreRow(report.scores.durableQueue, "Queue health")
      : {
          key: "durableQueue",
          label: "Queue health",
          status: "unknown",
          summary: "Unable to compute queue health.",
        },
    report
      ? scoreRow(report.scores.workerReliability, "Worker health")
      : {
          key: "workerReliability",
          label: "Worker health",
          status: "unknown",
          summary: "Unable to compute worker health.",
        },
    ingestionHealth,
    report
      ? scoreRow(report.scores.sourceQuality, "Source health")
      : {
          key: "sourceQuality",
          label: "Source health",
          status: "unknown",
          summary: "Unable to compute source health.",
        },
    report
      ? scoreRow(report.scores.contentQA, "Strict QA health")
      : {
          key: "contentQA",
          label: "Strict QA health",
          status: "unknown",
          summary: "Unable to compute strict QA health.",
        },
    cleanup
      ? {
          key: "cleanup",
          label: "Cleanup health",
          status: cleanup.isStale ? "warn" : "healthy",
          summary: cleanup.isStale
            ? `Cleanup last ran ${cleanup.lastRunAt?.toISOString().slice(0, 16) ?? "never"} — stale.`
            : `Cleanup fresh; mode=${cleanup.mode}, ${cleanup.deletedLast24h} deletions in 24h.`,
        }
      : {
          key: "cleanup",
          label: "Cleanup health",
          status: "unknown",
          summary: "Unable to compute cleanup health.",
        },
    report
      ? scoreRow(report.scores.thresholdGrowth, "Threshold health")
      : {
          key: "thresholdGrowth",
          label: "Threshold health",
          status: "unknown",
          summary: "Unable to compute threshold health.",
        },
    reportHealth,
    adminEmailHealth,
    dbHealth,
  ];

  const lastUpdated = new Date().toISOString().slice(0, 16);

  return (
    <AdminSection
      titleKey="admin.card.diagnostics"
      subtitle="Data Management Health — every operations signal in one panel."
    >
      <div className="mb-4 font-serif text-xs text-ink-faint">Last updated {lastUpdated}.</div>

      {dashboardWarnings.length > 0 ? (
        <section className="mb-6 vf-card rounded-sm border-l-4 border-amber-500 bg-amber-50 p-4">
          <p className="font-display text-lg text-amber-900">
            {dashboardWarnings.length} active dashboard warning
            {dashboardWarnings.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-3 space-y-2 font-serif text-sm text-amber-900">
            {dashboardWarnings.map((w) => (
              <li key={w.key}>
                <span className="font-medium">{w.label}</span> — {w.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="vf-card mb-6 rounded-sm p-4">
        <table className="w-full font-serif text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-3 py-2 text-left">Panel</th>
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-ink-faint/40">
                <td className="px-3 py-2 font-medium text-ink">{r.label}</td>
                <td className="px-3 py-2">
                  {typeof r.score === "number" ? `${r.score}/100` : "—"}
                </td>
                <td className={`px-3 py-2 ${statusClass(r.status)}`}>{r.status}</td>
                <td className="px-3 py-2 text-ink-soft">
                  {r.summary}
                  {r.hasQueryFailures ? (
                    <span className="ml-2 text-xs text-red-700">(one or more inputs failed)</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dataSourceCard ? (
        <section className="vf-card rounded-sm p-4">
          <p className="vf-eyebrow">Backing tables</p>
          <p
            className={
              "mt-1 font-display text-sm " +
              (dataSourceCard.allReachable ? "text-emerald-700" : "text-red-700")
            }
          >
            {dataSourceCard.allReachable
              ? "All required tables reachable — zero in any card means real zero."
              : "One or more tables unreachable — the affected counts may be misleading."}
          </p>
          <ul className="mt-3 grid gap-1 font-mono text-xs sm:grid-cols-2 lg:grid-cols-3">
            {dataSourceCard.surfaces.map((s) => (
              <li
                key={s.key}
                className={s.present ? "text-emerald-700" : "text-red-700"}
                title={s.errorMessage}
              >
                {s.present ? "✓" : "✗"} {s.label} ({s.rowCount.toLocaleString()} rows)
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6 font-serif text-xs text-ink-faint">
        <Link href="/admin/content-qa/dashboard" className="vf-nav-link">
          ← back to Content QA dashboard
        </Link>
      </div>
    </AdminSection>
  );
}
