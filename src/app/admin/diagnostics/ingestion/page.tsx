import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getDataManagementSettings } from "@/lib/data/site-settings";
import {
  getRecentActivityByAction,
  getRecentActivityByContentType,
} from "@/lib/data/data-management-log";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

type Check = {
  name: string;
  status: "ok" | "warn" | "fail" | "info";
  detail: string;
};

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];

  // 1. Data Management settings — toggle status.
  const settings = await getDataManagementSettings();
  checks.push({
    name: "Auto Data Management",
    status: settings.autoCleanupEnabled ? "ok" : "warn",
    detail: settings.autoCleanupEnabled
      ? `Enabled · hard-delete after ${settings.hardDeleteAfterDays} day(s)`
      : "Disabled — manual control. Per-row validator still runs on ingestion, but the catalog-wide cleanup sweep is paused.",
  });

  // 2. Last ingestion run.
  try {
    const lastRun = await prisma.ingestionJobRun.findFirst({
      orderBy: { startedAt: "desc" },
      include: { job: { include: { source: true } } },
    });
    if (!lastRun) {
      checks.push({
        name: "Last ingestion run",
        status: "warn",
        detail:
          "No IngestionJobRun rows yet. The scheduler creates them on the first cron tick — confirm /api/cron/ingest is wired up on the host.",
      });
    } else {
      const ageMinutes = Math.round((Date.now() - lastRun.startedAt.getTime()) / 60000);
      const status: Check["status"] =
        lastRun.status === "SUCCESS"
          ? "ok"
          : lastRun.status === "FAILED"
            ? "fail"
            : lastRun.status === "PARTIAL"
              ? "warn"
              : "info";
      const errPart = lastRun.errorMessage ? ` · "${lastRun.errorMessage.slice(0, 200)}"` : "";
      checks.push({
        name: "Last ingestion run",
        status,
        detail: `${lastRun.job.source.name} → ${lastRun.job.jobName} · ${lastRun.status} · ${ageMinutes} min ago · seen ${lastRun.recordsSeen} / created ${lastRun.recordsCreated} / skipped ${lastRun.recordsSkipped} / failed ${lastRun.recordsFailed}${errPart}`,
      });
    }
  } catch (err) {
    checks.push({
      name: "Last ingestion run",
      status: "fail",
      detail: `Could not query IngestionJobRun: ${(err as Error).message}`,
    });
  }

  // 3. Recent failures in the last 24h.
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failed = await prisma.ingestionJobRun.findMany({
      where: { startedAt: { gte: cutoff }, status: { in: ["FAILED", "PARTIAL"] } },
      include: { job: { include: { source: true } } },
      orderBy: { startedAt: "desc" },
      take: 5,
    });
    if (failed.length === 0) {
      checks.push({
        name: "Failures (24h)",
        status: "ok",
        detail: "No failed or partial ingestion runs in the last 24 hours.",
      });
    } else {
      for (const f of failed) {
        checks.push({
          name: `Failure · ${f.job.jobName}`,
          status: f.status === "FAILED" ? "fail" : "warn",
          detail: `${f.startedAt.toISOString().slice(0, 16)} · ${f.job.source.name} · ${f.status} · ${f.errorMessage?.slice(0, 240) ?? "no error message recorded"}`,
        });
      }
    }
  } catch (err) {
    checks.push({
      name: "Failures (24h)",
      status: "fail",
      detail: `Could not query IngestionJobRun: ${(err as Error).message}`,
    });
  }

  // 4. Recent Data Management activity by action.
  try {
    const byAction = await getRecentActivityByAction(24);
    const total = Object.values(byAction).reduce((sum, n) => sum + n, 0);
    if (total === 0) {
      checks.push({
        name: "Data Management activity (24h)",
        status: settings.autoCleanupEnabled ? "info" : "warn",
        detail: settings.autoCleanupEnabled
          ? "No automatic add / update / delete / cleanup actions in the last 24 hours. This is normal when the catalog is stable; if you expect activity, check the cron logs."
          : "Cleanup is disabled and there have been no manual data-management actions in the last 24 hours.",
      });
    } else {
      checks.push({
        name: "Data Management activity (24h)",
        status: "ok",
        detail: `${total} action(s): ${Object.entries(byAction)
          .map(([a, n]) => `${a.toLowerCase()} ${n}`)
          .join(", ")}`,
      });
    }
  } catch (err) {
    checks.push({
      name: "Data Management activity (24h)",
      status: "fail",
      detail: `Could not query DataManagementLog: ${(err as Error).message}`,
    });
  }

  // 5. Content counts by main type.
  try {
    const [prayers, saints, apparitions, parishes, devotions, liturgy, guides] = await Promise.all([
      prisma.prayer.count({ where: { status: "PUBLISHED" } }),
      prisma.saint.count({ where: { status: "PUBLISHED" } }),
      prisma.marianApparition.count({ where: { status: "PUBLISHED" } }),
      prisma.parish.count({ where: { status: "PUBLISHED" } }),
      prisma.devotion.count({ where: { status: "PUBLISHED" } }),
      prisma.liturgyEntry.count({ where: { status: "PUBLISHED" } }),
      prisma.spiritualLifeGuide.count({ where: { status: "PUBLISHED" } }),
    ]);
    checks.push({
      name: "Content counts (PUBLISHED)",
      status: "info",
      detail: `Prayers ${prayers} · Saints ${saints} · Marian apparitions ${apparitions} · Parishes ${parishes} · Devotions ${devotions} · Liturgy ${liturgy} · Spiritual-life guides ${guides}`,
    });
  } catch (err) {
    checks.push({
      name: "Content counts",
      status: "fail",
      detail: `Could not query content tables: ${(err as Error).message}`,
    });
  }

  // 6. REVIEW backlog — soft-validated content awaiting moderation.
  try {
    const [prayers, saints, apparitions, devotions, liturgy, guides] = await Promise.all([
      prisma.prayer.count({ where: { status: "REVIEW" } }),
      prisma.saint.count({ where: { status: "REVIEW" } }),
      prisma.marianApparition.count({ where: { status: "REVIEW" } }),
      prisma.devotion.count({ where: { status: "REVIEW" } }),
      prisma.liturgyEntry.count({ where: { status: "REVIEW" } }),
      prisma.spiritualLifeGuide.count({ where: { status: "REVIEW" } }),
    ]);
    const total = prayers + saints + apparitions + devotions + liturgy + guides;
    checks.push({
      name: "Review queue",
      status: total === 0 ? "ok" : total > 200 ? "warn" : "info",
      detail:
        total === 0
          ? "No content in REVIEW status."
          : `${total} item(s) awaiting moderation across the catalog. Use /admin/publish-list to triage.`,
    });
  } catch (err) {
    checks.push({
      name: "Review queue",
      status: "fail",
      detail: `Could not query review queue: ${(err as Error).message}`,
    });
  }

  return checks;
}

function statusColor(status: Check["status"]) {
  return status === "ok"
    ? "#185c2a"
    : status === "warn"
      ? "#9b6b00"
      : status === "fail"
        ? "#8b1a1a"
        : "#3b3f4a";
}
function statusGlyph(status: Check["status"]) {
  return status === "ok" ? "✓" : status === "warn" ? "!" : status === "fail" ? "✗" : "·";
}

export default async function IngestionDiagnostics() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const checks = await runChecks();
  const byContentType = await getRecentActivityByContentType(24).catch(() => ({}));

  return (
    <AdminSection
      titleKey="admin.card.diagnostics"
      subtitle="Ingestion & Data Management — verify content validation, cleanup activity, automatic deletes, and recent failure detail."
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href="/admin/diagnostics" className="vf-nav-link">
          ← Diagnostics
        </Link>
        <Link href="/admin/ingestion" className="vf-nav-link">
          Open Ingestion & Data Management →
        </Link>
        <Link href="/admin/logs/data-management" className="vf-nav-link">
          Data Management Logs →
        </Link>
      </div>

      <h2 className="font-display text-2xl">Ingestion & Data Management</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {checks.map((c, idx) => (
          <li key={idx} className="vf-card rounded-sm p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs text-white"
                style={{ backgroundColor: statusColor(c.status) }}
              >
                {statusGlyph(c.status)}
              </span>
              <div className="min-w-0">
                <p className="break-words font-display text-base text-ink">{c.name}</p>
                <p className="mt-1 break-words font-serif text-sm text-ink-soft">{c.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {Object.keys(byContentType).length > 0 ? (
        <section className="mt-8 vf-card rounded-sm p-5">
          <h2 className="font-display text-xl">Activity by content type (24h)</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {Object.entries(byContentType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <li key={type} className="flex items-baseline justify-between font-serif text-sm">
                  <span className="text-ink-soft">{type}</span>
                  <span className="font-medium text-ink">{count}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </AdminSection>
  );
}
