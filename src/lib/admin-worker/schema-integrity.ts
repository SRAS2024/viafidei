/**
 * Database schema-integrity self-check.
 *
 * The Admin Worker's whole publish funnel reads rows through Prisma, and nearly
 * every read is fail-open (`.catch(() => [])`) so a transient hiccup can't wedge
 * a pass. That safety has a sharp edge: if the DEPLOYED database is behind the
 * Prisma schema — a migration didn't apply, a column is missing — then a
 * `findMany` that selects the missing column throws `P2022`, the fail-open catch
 * swallows it, and the query returns "no rows". Strict QA then sees "no artifacts
 * pending", nothing reaches QA_PASSED, and NOTHING publishes — while extraction /
 * build (which don't hit the missing column) keep succeeding. The symptom is
 * exactly the recurring EXTRACTING_WITHOUT_PUBLISHING escalation: hundreds of
 * builds, zero publishes, and no error surfaced anywhere.
 *
 * This module makes that failure LOUD instead of silent. It probes each critical
 * table with a full-row read and classifies any `P2022` (missing column) / `P2021`
 * (missing table) as a schema drift, naming the exact column so the operator
 * knows precisely what to run (`prisma migrate deploy`). It is surfaced at worker
 * startup (a critical alert) and as a diagnostics rating that goes red. Purely a
 * read-probe; it never mutates and never throws (fail-open).
 */

import type { PrismaClient } from "@prisma/client";

export interface SchemaDrift {
  /** The model whose table drifted. */
  model: string;
  /** Prisma error code: P2022 (missing column) or P2021 (missing table). */
  code: string;
  /** Human-readable detail, e.g. "missing column: AdminWorkerPackageArtifact.gateDiagnosis". */
  detail: string;
}

export interface SchemaIntegrityResult {
  ok: boolean;
  drifts: SchemaDrift[];
  checked: number;
}

type Probe = { model: string; run: (p: PrismaClient) => Promise<unknown> };

/**
 * The tables the publish funnel reads full rows from. If any of these is missing
 * a column the Prisma client expects, publishing silently stalls — so these are
 * exactly the ones worth probing. Each probe selects ALL columns (a bare
 * `findFirst`) so a missing column surfaces as P2022.
 */
const PROBES: Probe[] = [
  { model: "AdminWorkerPackageArtifact", run: (p) => p.adminWorkerPackageArtifact.findFirst({}) },
  { model: "PublishedContent", run: (p) => p.publishedContent.findFirst({}) },
  { model: "AdminWorkerSourceRead", run: (p) => p.adminWorkerSourceRead.findFirst({}) },
  { model: "AdminWorkerRepairPlan", run: (p) => p.adminWorkerRepairPlan.findFirst({}) },
  { model: "ChecklistItem", run: (p) => p.checklistItem.findFirst({}) },
  { model: "AdminWorkerStrictQAResult", run: (p) => p.adminWorkerStrictQAResult.findFirst({}) },
  { model: "ContentQualityScore", run: (p) => p.contentQualityScore.findFirst({}) },
  {
    model: "AdminWorkerCrossSourceVerification",
    run: (p) => p.adminWorkerCrossSourceVerification.findFirst({}),
  },
  { model: "HumanReviewQueue", run: (p) => p.humanReviewQueue.findFirst({}) },
  { model: "AdminWorkerEscalation", run: (p) => p.adminWorkerEscalation.findFirst({}) },
];

/** Classify a query error as a schema drift, or null when it isn't one. */
function classifyDrift(model: string, err: unknown): SchemaDrift | null {
  const e = err as { code?: unknown; meta?: { column?: unknown; table?: unknown } };
  const code = typeof e?.code === "string" ? e.code : "";
  if (code === "P2022") {
    const col = typeof e.meta?.column === "string" ? e.meta.column : `${model}.<unknown column>`;
    return { model, code, detail: `missing column: ${col}` };
  }
  if (code === "P2021") {
    const tbl = typeof e.meta?.table === "string" ? e.meta.table : model;
    return { model, code, detail: `missing table: ${tbl}` };
  }
  // Connection / auth / other errors are NOT schema drift — leave them to the
  // db-health rating and treat this probe as inconclusive (fail-open).
  return null;
}

/**
 * Probe every critical table for a schema drift (a column/table the Prisma
 * client expects but the database lacks). Never throws.
 */
export async function checkSchemaIntegrity(prisma: PrismaClient): Promise<SchemaIntegrityResult> {
  const drifts: SchemaDrift[] = [];
  let checked = 0;
  for (const probe of PROBES) {
    checked += 1;
    try {
      await probe.run(prisma);
    } catch (err) {
      const drift = classifyDrift(probe.model, err);
      if (drift) drifts.push(drift);
    }
  }
  return { ok: drifts.length === 0, drifts, checked };
}

/**
 * Log a query error LOUDLY when it is a Prisma DB/schema error (P-code), so a
 * fail-open `.catch(() => [])` that returns "no rows" can never SILENTLY stall
 * the funnel again. Call this from the catch of a critical publish-path read.
 * Non-Prisma errors (ordinary nulls) are ignored so normal empty results stay
 * quiet.
 */
export function reportQueryError(label: string, err: unknown): void {
  const e = err as { code?: unknown; message?: unknown };
  const code = typeof e?.code === "string" ? e.code : "";
  if (!code.startsWith("P")) return; // not a Prisma known-request error
  const msg = typeof e?.message === "string" ? e.message.split("\n")[0] : String(err);
  // eslint-disable-next-line no-console
  console.error(
    `[admin-worker] DB error in ${label} (${code}) — returning EMPTY (fail-open); ` +
      `if this is P2022/P2021 the database is behind the schema and publishing is stalled. ${msg}`,
  );
}

/** One-line summary of a drift result (for logs / alerts). */
export function summarizeDrift(res: SchemaIntegrityResult): string {
  if (res.ok) return `Schema OK (${res.checked} critical tables match the Prisma schema).`;
  return `Database schema drift on ${res.drifts.length} table(s): ${res.drifts
    .map((d) => `${d.model} — ${d.detail}`)
    .join("; ")}. Run \`prisma migrate deploy\`; publishing stalls until these exist.`;
}
