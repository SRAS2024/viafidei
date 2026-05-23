/**
 * System health diagnostics for the checklist-first architecture.
 *
 * Each diagnostic returns one of three statuses:
 *   - pass   — green, the part is healthy
 *   - warn   — yellow, the part is degraded but functioning
 *   - fail   — red, the part is broken or unsafe
 *
 * The admin diagnostics page calls `runAllDiagnostics()` and renders each
 * row with the appropriate colour. The Developer Report button collects
 * every diagnostic into a markdown blob the operator can copy.
 */

import { prisma } from "@/lib/db/client";
import { AUTHORITY_SOURCES } from "@/lib/worker";

export type DiagnosticStatus = "pass" | "warn" | "fail";

export interface DiagnosticResult {
  key: string;
  label: string;
  status: DiagnosticStatus;
  summary: string;
  details?: string[];
  metric?: number;
  /** Optional suggestion the operator can act on. */
  suggestedAction?: string;
}

async function databaseReachability(): Promise<DiagnosticResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      key: "database",
      label: "Database connectivity",
      status: "pass",
      summary: "Postgres is reachable.",
    };
  } catch (err) {
    return {
      key: "database",
      label: "Database connectivity",
      status: "fail",
      summary: "Cannot reach Postgres.",
      details: [err instanceof Error ? err.message : String(err)],
      suggestedAction: "Check DATABASE_URL and the database service status.",
    };
  }
}

async function checklistSeed(): Promise<DiagnosticResult> {
  const total = await prisma.checklistItem.count();
  if (total === 0) {
    return {
      key: "checklist",
      label: "Master checklist seeded",
      status: "fail",
      summary: "No checklist items present.",
      suggestedAction: "Run `npm run seed:checklist` to load the master checklists.",
    };
  }
  if (total < 100) {
    return {
      key: "checklist",
      label: "Master checklist seeded",
      status: "warn",
      summary: `${total} items — expected ~190.`,
      metric: total,
      suggestedAction: "Re-run `npm run seed:checklist` to fill in missing items.",
    };
  }
  return {
    key: "checklist",
    label: "Master checklist seeded",
    status: "pass",
    summary: `${total} checklist items loaded.`,
    metric: total,
  };
}

async function authoritySources(): Promise<DiagnosticResult> {
  const inDb = await prisma.authoritySource.count({ where: { isActive: true } });
  const expected = AUTHORITY_SOURCES.length;
  if (inDb === 0) {
    return {
      key: "authority-sources",
      label: "Authority source registry",
      status: "fail",
      summary: "No authority sources in the database.",
      suggestedAction: "Run `npm run seed:checklist` to populate the source registry.",
    };
  }
  if (inDb < expected) {
    return {
      key: "authority-sources",
      label: "Authority source registry",
      status: "warn",
      summary: `${inDb}/${expected} authority sources active.`,
      metric: inDb,
      suggestedAction: "Re-seed to bring the registry up to date.",
    };
  }
  return {
    key: "authority-sources",
    label: "Authority source registry",
    status: "pass",
    summary: `${inDb} active authority sources.`,
    metric: inDb,
  };
}

async function workerQueue(): Promise<DiagnosticResult> {
  const [pending, running, failed, oldestPending] = await Promise.all([
    prisma.workerBuildJob.count({ where: { status: "pending" } }),
    prisma.workerBuildJob.count({ where: { status: "running" } }),
    prisma.workerBuildJob.count({ where: { status: "failed" } }),
    prisma.workerBuildJob.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  const oldestAgeMin = oldestPending
    ? Math.round((Date.now() - oldestPending.createdAt.getTime()) / 60_000)
    : 0;
  if (failed > 10) {
    return {
      key: "queue",
      label: "Worker build queue",
      status: "fail",
      summary: `${failed} failed builds backed up.`,
      details: [`pending=${pending}`, `running=${running}`, `failed=${failed}`],
      suggestedAction: "Open /admin/checklist/failed and investigate.",
    };
  }
  if (oldestAgeMin > 60 || failed > 0) {
    return {
      key: "queue",
      label: "Worker build queue",
      status: "warn",
      summary: `${pending} pending, oldest ${oldestAgeMin}m, ${failed} failed.`,
      details: [`pending=${pending}`, `running=${running}`, `failed=${failed}`],
    };
  }
  return {
    key: "queue",
    label: "Worker build queue",
    status: "pass",
    summary: `${pending} pending, ${running} running, ${failed} failed.`,
    metric: pending,
  };
}

async function qaPipeline(): Promise<DiagnosticResult> {
  const [needsReview, failedQa, recentReports] = await Promise.all([
    prisma.checklistItem.count({ where: { needsHumanReview: true, approvalStatus: "QA_PENDING" } }),
    prisma.checklistQAReport.count({ where: { passed: false, reviewedAt: null } }),
    prisma.checklistQAReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { overallScore: true },
    }),
  ]);
  const avg =
    recentReports.length === 0
      ? 1
      : recentReports.reduce((s, r) => s + r.overallScore, 0) / recentReports.length;
  if (avg < 0.6) {
    return {
      key: "qa",
      label: "QA pipeline",
      status: "fail",
      summary: `Recent avg QA score ${avg.toFixed(2)} is dangerous.`,
      details: [`pending review: ${needsReview}`, `failed QA reports: ${failedQa}`],
      suggestedAction: "Investigate /admin/checklist/qa and the source registry.",
    };
  }
  if (avg < 0.8 || needsReview > 10) {
    return {
      key: "qa",
      label: "QA pipeline",
      status: "warn",
      summary: `Avg QA ${avg.toFixed(2)}, ${needsReview} items need review.`,
      metric: avg,
    };
  }
  return {
    key: "qa",
    label: "QA pipeline",
    status: "pass",
    summary: `Avg QA ${avg.toFixed(2)}, ${needsReview} items pending review.`,
    metric: avg,
  };
}

async function publishingHealth(): Promise<DiagnosticResult> {
  const [published, unpublished, total] = await Promise.all([
    prisma.publishedContent.count({ where: { isPublished: true } }),
    prisma.publishedContent.count({ where: { isPublished: false } }),
    prisma.checklistItem.count(),
  ]);
  if (total > 50 && published === 0) {
    return {
      key: "publishing",
      label: "Publishing pipeline",
      status: "fail",
      summary: "No items have been published yet.",
      suggestedAction: "Run the worker (`npm run worker`) to drain the build queue.",
    };
  }
  if (published < 5) {
    return {
      key: "publishing",
      label: "Publishing pipeline",
      status: "warn",
      summary: `Only ${published} items live (out of ${total} on the checklist).`,
      details: [`unpublished: ${unpublished}`],
    };
  }
  return {
    key: "publishing",
    label: "Publishing pipeline",
    status: "pass",
    summary: `${published} items live on the site.`,
    metric: published,
  };
}

async function janitorFindings(): Promise<DiagnosticResult> {
  const { scanForJanitorFindings } = await import("@/lib/worker/janitor");
  const findings = await scanForJanitorFindings(prisma);
  const high = findings.filter((f) => f.severity === "high").length;
  const deletes = findings.filter((f) => f.action === "delete").length;
  if (high > 5 || deletes > 5) {
    return {
      key: "janitor",
      label: "Janitor review",
      status: "fail",
      summary: `${findings.length} findings (${high} high severity, ${deletes} flagged for deletion).`,
      suggestedAction: "Open /admin/checklist/janitor/deletes to triage.",
    };
  }
  if (findings.length > 5) {
    return {
      key: "janitor",
      label: "Janitor review",
      status: "warn",
      summary: `${findings.length} findings (${high} high, ${deletes} deletes).`,
    };
  }
  return {
    key: "janitor",
    label: "Janitor review",
    status: "pass",
    summary:
      findings.length === 0
        ? "Janitor is happy."
        : `${findings.length} low/medium findings to review.`,
  };
}

async function buildLogActivity(): Promise<DiagnosticResult> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.workerBuildLog.count({
    where: { createdAt: { gte: cutoff } },
  });
  if (recent === 0) {
    return {
      key: "activity",
      label: "Worker activity (24h)",
      status: "warn",
      summary: "No worker activity in the last 24 hours.",
      suggestedAction: "Start the worker process or check Railway.",
    };
  }
  return {
    key: "activity",
    label: "Worker activity (24h)",
    status: "pass",
    summary: `${recent} build-log entries written in the last 24h.`,
    metric: recent,
  };
}

async function schemaCoverage(): Promise<DiagnosticResult> {
  const { CONTENT_SCHEMAS } = await import("@/lib/worker/schemas");
  const all = Object.keys(CONTENT_SCHEMAS).length;
  if (all !== 11) {
    return {
      key: "schemas",
      label: "Content schemas",
      status: "fail",
      summary: `Expected 11 schemas, found ${all}.`,
    };
  }
  return {
    key: "schemas",
    label: "Content schemas",
    status: "pass",
    summary: `All ${all} content schemas registered.`,
  };
}

export async function runAllDiagnostics(): Promise<DiagnosticResult[]> {
  const results = await Promise.all([
    databaseReachability(),
    schemaCoverage(),
    checklistSeed(),
    authoritySources(),
    workerQueue(),
    qaPipeline(),
    publishingHealth(),
    buildLogActivity(),
    janitorFindings(),
  ]);
  return results;
}

/**
 * Build a markdown Developer Report that the admin can copy to share with a
 * developer. Each diagnostic becomes one section with status, summary, and
 * any details/suggested actions.
 */
export function buildDeveloperReport(results: DiagnosticResult[]): string {
  const lines: string[] = [];
  lines.push(`# Viafidei Developer Report`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const r of results) counts[r.status]++;
  lines.push(`**Status:** ${counts.pass} pass · ${counts.warn} warn · ${counts.fail} fail`);
  lines.push("");
  for (const r of results) {
    const marker = r.status === "pass" ? "✓" : r.status === "warn" ? "⚠" : "✕";
    lines.push(`## ${marker} ${r.label} — ${r.status.toUpperCase()}`);
    lines.push("");
    lines.push(r.summary);
    if (r.details && r.details.length) {
      lines.push("");
      lines.push("Details:");
      for (const d of r.details) lines.push(`- ${d}`);
    }
    if (r.suggestedAction) {
      lines.push("");
      lines.push(`Suggested action: ${r.suggestedAction}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
