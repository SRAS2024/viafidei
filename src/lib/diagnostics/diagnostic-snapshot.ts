/**
 * Durable diagnostic history.
 *
 * Every time the admin Diagnostics panel is opened or diagnostics are
 * run, `writeDiagnosticSnapshots()` records one DiagnosticSnapshot row
 * per diagnostic so the Developer Audit report can reproduce the
 * diagnostic state for any selected time period — not only "now".
 *
 * Snapshots are redacted before they are written: `detailsJson` passes
 * through `redactValue()` so a secret can never be persisted into the
 * diagnostic history.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { redactValue } from "./redaction";
import { loadSystemHealth, type HealthCard, type SystemHealthReport } from "./system-health";

/**
 * Canonical diagnostic order — mirrors the admin Diagnostics / System
 * Health panel, with the aggregate "Overall health" diagnostic first.
 * Any diagnostic added to the System Health dashboard later is picked
 * up automatically by `buildSnapshotInputs()`; this list only pins the
 * order and the friendly names of the known diagnostics.
 */
export const DIAGNOSTIC_ORDER: ReadonlyArray<{ key: string; name: string }> = [
  { key: "overall", name: "Overall health" },
  { key: "queue", name: "Queue health" },
  { key: "worker", name: "Worker health" },
  { key: "source_discovery", name: "Source discovery health" },
  { key: "source_fetch", name: "Source fetch health" },
  { key: "source_document", name: "Source document health" },
  { key: "content_factory", name: "Content factory health" },
  { key: "builder", name: "Builder health" },
  { key: "strict_qa", name: "Strict QA health" },
  { key: "persistence", name: "Persistence health" },
  { key: "cleanup", name: "Cleanup health" },
  { key: "growth", name: "Growth health" },
  { key: "security", name: "Security health" },
  { key: "admin_email", name: "Admin email health" },
  { key: "database", name: "Database health" },
];

export type DiagnosticSnapshotInput = {
  diagnosticKey: string;
  diagnosticName: string;
  status: string;
  summary: string;
  dataSource: string;
  detailsJson: unknown;
  suggestedAction: string | null;
};

export type DiagnosticSnapshotRecord = DiagnosticSnapshotInput & {
  id: string;
  createdAt: Date;
};

/**
 * Operator next-action hint for a non-passing diagnostic. Returns
 * `null` for a healthy diagnostic — there is nothing to do.
 */
export function suggestedActionForDiagnostic(key: string, status: string): string | null {
  if (status === "pass") return null;
  const actions: Record<string, string> = {
    overall: "Review the failing and warning diagnostics below; address the worst first.",
    queue:
      "Inspect IngestionJobQueue for failed jobs and run queue repair from Worker & Pipeline Diagnostics.",
    worker: "Start or restart the ingestion worker and confirm it is writing WorkerHeartbeat rows.",
    source_discovery: "Check source discovery feeds and review DiscoveredSourceItem failures.",
    source_fetch: "Inspect SourceDocument fetch failures and upstream source health.",
    source_document: "Review SourceDocument rows that did not finish with an ok fetch status.",
    content_factory: "Inspect ContentPackageBuildLog build failures grouped by builder.",
    builder: "Review builder coverage and weak builders in the Builder Quality diagnostics.",
    strict_qa: "Review RejectedContentLog for the dominant rejection categories.",
    persistence: "Confirm catalog rows are passing the strict public-render gate.",
    cleanup: "Confirm the strict cleanup pass is running on schedule.",
    growth: "Investigate why no complete content packages were built recently.",
    security: "Review recent SecurityEvent rows and any banned devices.",
    admin_email: "Set ADMIN_EMAIL and RESEND_API_KEY so operational alerts are delivered.",
    database: "Database access failed — check DATABASE_URL and Postgres availability.",
  };
  return actions[key] ?? "Investigate this diagnostic and review the related admin page.";
}

function cardSnapshotInput(card: HealthCard): DiagnosticSnapshotInput {
  const details = redactValue({
    ...card.details,
    errorMessage: card.errorMessage ?? null,
    lastUpdatedAt: card.lastUpdatedAt,
  });
  return {
    diagnosticKey: card.id,
    diagnosticName: card.label,
    status: card.severity,
    summary: card.errorMessage ? `${card.summary} — ${card.errorMessage}` : card.summary,
    dataSource: card.dataSource,
    detailsJson: details,
    suggestedAction: suggestedActionForDiagnostic(card.id, card.severity),
  };
}

/**
 * Convert a live System Health report into the snapshot rows to
 * persist — the aggregate "Overall health" diagnostic followed by one
 * row per card, in canonical diagnostic order.
 */
export function buildSnapshotInputs(report: SystemHealthReport): DiagnosticSnapshotInput[] {
  const byId = new Map(report.cards.map((card) => [card.id, card]));
  const failing = report.cards.filter(
    (c) => c.severity === "fail" || c.severity === "error",
  ).length;
  const warnings = report.cards.filter((c) => c.severity === "warn").length;
  const passing = report.cards.filter((c) => c.severity === "pass").length;

  const overall: DiagnosticSnapshotInput = {
    diagnosticKey: "overall",
    diagnosticName: "Overall health",
    status: report.overallSeverity,
    summary: `${report.cards.length} diagnostics — ${failing} failing, ${warnings} warning, ${passing} healthy.`,
    dataSource: "System Health aggregate",
    detailsJson: { failing, warnings, passing, cardCount: report.cards.length },
    suggestedAction: suggestedActionForDiagnostic("overall", report.overallSeverity),
  };

  const inputs: DiagnosticSnapshotInput[] = [overall];
  // Known diagnostics first, in canonical order.
  for (const { key } of DIAGNOSTIC_ORDER) {
    if (key === "overall") continue;
    const card = byId.get(key as HealthCard["id"]);
    if (card) inputs.push(cardSnapshotInput(card));
  }
  // Any diagnostic added to System Health later but not in DIAGNOSTIC_ORDER.
  const known = new Set(DIAGNOSTIC_ORDER.map((d) => d.key));
  for (const card of report.cards) {
    if (!known.has(card.id)) inputs.push(cardSnapshotInput(card));
  }
  return inputs;
}

/**
 * Record a fresh diagnostic snapshot set. Called when the Diagnostics
 * panel loads and when diagnostics are run. Best-effort — a snapshot
 * write must never break the page it is attached to.
 */
export async function writeDiagnosticSnapshots(
  report?: SystemHealthReport,
): Promise<SystemHealthReport | null> {
  try {
    const resolved = report ?? (await loadSystemHealth());
    const inputs = buildSnapshotInputs(resolved);
    await prisma.diagnosticSnapshot.createMany({
      data: inputs.map((input) => ({
        diagnosticKey: input.diagnosticKey,
        diagnosticName: input.diagnosticName,
        status: input.status,
        summary: input.summary,
        dataSource: input.dataSource,
        detailsJson: input.detailsJson as never,
        suggestedAction: input.suggestedAction,
      })),
    });
    logger.info("admin.diagnostic_snapshot.written", { count: inputs.length });
    return resolved;
  } catch (error) {
    logger.warn("admin.diagnostic_snapshot.write_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Read every diagnostic snapshot recorded inside the time window. */
export async function readDiagnosticSnapshotsInRange(
  startAt: Date,
  endAt: Date,
): Promise<DiagnosticSnapshotRecord[]> {
  const rows = await prisma.diagnosticSnapshot.findMany({
    where: { createdAt: { gte: startAt, lte: endAt } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    diagnosticKey: row.diagnosticKey,
    diagnosticName: row.diagnosticName,
    status: row.status,
    summary: row.summary,
    dataSource: row.dataSource,
    detailsJson: row.detailsJson,
    suggestedAction: row.suggestedAction,
    createdAt: row.createdAt,
  }));
}

/** Earliest snapshot timestamp, or null when none have been recorded. */
export async function earliestDiagnosticSnapshotAt(): Promise<Date | null> {
  const row = await prisma.diagnosticSnapshot.findFirst({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}
