/**
 * Seed audit dashboard data.
 *
 * Reads how the current seed has performed under strict QA. Per the
 * spec, seed content should eventually flow through the factory
 * (source document → builder → normalizer → enricher → strict QA →
 * persistence → public gate) — but the existing seeder inserts
 * directly into public tables. This helper reads what is currently
 * present in those tables and reports:
 *
 *   - Count of seeded rows per content type (rows whose
 *     externalSourceKey starts with "seed:" OR whose sourceHost is
 *     "seed.viafidei.app", which is the canonical seed marker).
 *   - Of those, how many pass the strict public gate
 *     (status="PUBLISHED" + publicRenderReady + isThresholdEligible).
 *   - The seed-pass rate per content type.
 *
 * When the seeder is migrated to the factory, this dashboard will
 * answer "did all my seeds become public via QA?" — the only
 * acceptable answer is "yes, every row".
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

export type SeedAuditRow = {
  contentType: string;
  /** Total seeded rows present in the content table. */
  total: number;
  /** Seeded rows that pass the strict public gate. */
  publicAndValid: number;
  /** Pass rate: publicAndValid / total. */
  passRate: number;
  errors: string[];
};

export type SeedAuditReport = {
  generatedAt: Date;
  rows: SeedAuditRow[];
  /** True when every seeded row passes the strict public gate. */
  healthy: boolean;
};

/** Predicate matching a seeded row across content tables. */
function seedWhere() {
  return {
    OR: [{ externalSourceKey: { startsWith: "seed:" } }, { sourceHost: "seed.viafidei.app" }],
  };
}

function strictPublicWhere() {
  return {
    status: "PUBLISHED" as const,
    publicRenderReady: true,
    isThresholdEligible: true,
    archivedAt: null,
  };
}

const TYPES: Array<{ contentType: string; model: string }> = [
  { contentType: "Prayer", model: "prayer" },
  { contentType: "Saint", model: "saint" },
  { contentType: "MarianApparition", model: "marianApparition" },
  { contentType: "Parish", model: "parish" },
  { contentType: "Devotion", model: "devotion" },
  { contentType: "SpiritualLifeGuide", model: "spiritualLifeGuide" },
  { contentType: "LiturgyEntry", model: "liturgyEntry" },
];

async function countFor(
  model: string,
  whereExtra: Record<string, unknown> | null,
  errors: string[],
): Promise<number | null> {
  const delegate = (
    prisma as unknown as Record<string, { count: (a: { where: unknown }) => Promise<number> }>
  )[model];
  if (!delegate) {
    errors.push(`no model named ${model}`);
    return null;
  }
  try {
    const where = whereExtra ? { AND: [seedWhere(), whereExtra] } : seedWhere();
    return await delegate.count({ where });
  } catch (e) {
    errors.push(`${model}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export async function getSeedAuditReport(): Promise<SeedAuditReport> {
  const rows: SeedAuditRow[] = [];
  for (const t of TYPES) {
    const errors: string[] = [];
    const total = await countFor(t.model, null, errors);
    const publicAndValid = await countFor(t.model, strictPublicWhere(), errors);
    const totalN = total ?? 0;
    const validN = publicAndValid ?? 0;
    rows.push({
      contentType: t.contentType,
      total: totalN,
      publicAndValid: validN,
      passRate: totalN === 0 ? 1 : validN / totalN,
      errors,
    });
  }
  // Healthy when every type has either zero rows or 100% pass rate.
  const healthy = rows.every((r) => r.total === 0 || r.publicAndValid === r.total);
  logger.info("seed-audit.completed", { healthy, rows: rows.length });
  return {
    generatedAt: new Date(),
    rows,
    healthy,
  };
}
