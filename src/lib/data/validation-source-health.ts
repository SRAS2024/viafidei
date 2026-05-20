/**
 * Validation source health scoring.
 *
 * One health row per configured validation source. Combines two
 * real signals:
 *
 *   - ContentValidationEvidence — how often this source's evidence
 *     passed / failed / was insufficient, and when it last produced
 *     a passing validation.
 *   - IngestionSource — the source's fetch health (consecutive
 *     failures, last successful sync, auto-paused state).
 *
 * Produces a 0–100 health score the planner and the cross-source
 * validation dashboard read to decide whether a validation source
 * is still pulling its weight.
 *
 * Read-side only.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

export type ValidationSourceHealthRow = {
  host: string;
  role: string;
  evidenceCreated: number;
  passCount: number;
  failCount: number;
  insufficientCount: number;
  /** pass / total evidence rows. */
  matchSuccessRate: number;
  /** (fail + insufficient) / total evidence rows. */
  evidenceFailureRate: number;
  lastSuccessfulValidationAt: Date | null;
  fetchHealth: "healthy" | "degraded" | "failing";
  consecutiveFailures: number;
  lastSuccessfulSyncAt: Date | null;
  /** 0–100 composite health score. */
  healthScore: number;
  /** Each entry subtracts from the score. */
  penalties: Array<{ id: string; amount: number; reason: string }>;
};

export type ValidationSourceHealthReport = {
  generatedAt: Date;
  rows: ValidationSourceHealthRow[];
  /** Validation sources whose score is below the healthy floor. */
  unhealthyCount: number;
};

const STALE_VALIDATION_MS = 14 * 24 * 60 * 60 * 1000;

type DecisionGroup = {
  sourceHost: string;
  validationDecision: string;
  _count: { _all: number };
};

function fetchHealthOf(
  consecutiveFailures: number,
  autoPaused: boolean,
): ValidationSourceHealthRow["fetchHealth"] {
  if (autoPaused || consecutiveFailures >= 3) return "failing";
  if (consecutiveFailures >= 1) return "degraded";
  return "healthy";
}

function scoreHealth(input: {
  evidenceCreated: number;
  matchSuccessRate: number;
  evidenceFailureRate: number;
  consecutiveFailures: number;
  autoPaused: boolean;
  lastSuccessfulValidationAt: Date | null;
}): { score: number; penalties: ValidationSourceHealthRow["penalties"] } {
  const penalties: ValidationSourceHealthRow["penalties"] = [];
  let score = 100;
  const penalise = (id: string, amount: number, reason: string): void => {
    penalties.push({ id, amount, reason });
    score -= amount;
  };

  if (input.evidenceCreated === 0) {
    penalise("no_evidence", 30, "Configured as a validation source but has produced no evidence");
  }
  if (input.evidenceCreated >= 5 && input.matchSuccessRate < 0.5) {
    penalise(
      "low_match_rate",
      25,
      `Match success rate ${Math.round(input.matchSuccessRate * 100)}% (< 50%)`,
    );
  } else if (input.evidenceCreated >= 5 && input.matchSuccessRate < 0.8) {
    penalise(
      "low_match_rate",
      10,
      `Match success rate ${Math.round(input.matchSuccessRate * 100)}% (< 80%)`,
    );
  }
  if (input.evidenceCreated >= 5 && input.evidenceFailureRate > 0.5) {
    penalise(
      "high_failure_rate",
      20,
      `Evidence failure rate ${Math.round(input.evidenceFailureRate * 100)}% (> 50%)`,
    );
  }
  if (input.consecutiveFailures >= 3) {
    penalise("fetch_failing", 20, `${input.consecutiveFailures} consecutive fetch failures`);
  } else if (input.consecutiveFailures >= 1) {
    penalise("fetch_degraded", 10, `${input.consecutiveFailures} recent fetch failure(s)`);
  }
  if (input.autoPaused) {
    penalise("auto_paused", 30, "Source is auto-paused");
  }
  if (
    input.evidenceCreated > 0 &&
    (input.lastSuccessfulValidationAt == null ||
      Date.now() - input.lastSuccessfulValidationAt.getTime() > STALE_VALIDATION_MS)
  ) {
    penalise("stale_validation", 10, "No successful validation in the last 14 days");
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return { score, penalties };
}

/**
 * Build the validation source health report — one row per configured
 * validation source.
 */
export async function getValidationSourceHealthReport(): Promise<ValidationSourceHealthReport> {
  const generatedAt = new Date();

  let sources: Array<{
    host: string;
    role: string;
    consecutiveFailures: number;
    autoPaused: boolean;
    lastSuccessfulSync: Date | null;
  }> = [];
  try {
    sources = await prisma.ingestionSource.findMany({
      where: { role: "validation_source" },
      select: {
        host: true,
        role: true,
        consecutiveFailures: true,
        autoPaused: true,
        lastSuccessfulSync: true,
      },
    });
  } catch (e) {
    logger.warn("validation-source-health.sources_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { generatedAt, rows: [], unhealthyCount: 0 };
  }

  // Per-host evidence decision counts + last passing validation.
  const evidenceClient = prisma as unknown as {
    contentValidationEvidence?: {
      groupBy: (a: Record<string, unknown>) => Promise<unknown[]>;
    };
  };
  const decisionByHost = new Map<string, { pass: number; fail: number; insufficient: number }>();
  const lastPassByHost = new Map<string, Date>();
  if (evidenceClient.contentValidationEvidence) {
    try {
      const groups = (await evidenceClient.contentValidationEvidence.groupBy({
        by: ["sourceHost", "validationDecision"],
        _count: { _all: true },
      })) as DecisionGroup[];
      for (const g of groups) {
        const entry = decisionByHost.get(g.sourceHost) ?? { pass: 0, fail: 0, insufficient: 0 };
        if (g.validationDecision === "pass") entry.pass += g._count._all;
        else if (g.validationDecision === "fail") entry.fail += g._count._all;
        else entry.insufficient += g._count._all;
        decisionByHost.set(g.sourceHost, entry);
      }
      const lastPass = (await evidenceClient.contentValidationEvidence.groupBy({
        by: ["sourceHost"],
        where: { validationDecision: "pass" },
        _max: { createdAt: true },
      })) as Array<{ sourceHost: string; _max: { createdAt: Date | null } }>;
      for (const p of lastPass) {
        if (p._max.createdAt) lastPassByHost.set(p.sourceHost, p._max.createdAt);
      }
    } catch (e) {
      logger.warn("validation-source-health.evidence_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const rows: ValidationSourceHealthRow[] = sources.map((s) => {
    const decisions = decisionByHost.get(s.host) ?? { pass: 0, fail: 0, insufficient: 0 };
    const total = decisions.pass + decisions.fail + decisions.insufficient;
    const matchSuccessRate = total === 0 ? 0 : decisions.pass / total;
    const evidenceFailureRate = total === 0 ? 0 : (decisions.fail + decisions.insufficient) / total;
    const lastSuccessfulValidationAt = lastPassByHost.get(s.host) ?? null;
    const { score, penalties } = scoreHealth({
      evidenceCreated: total,
      matchSuccessRate,
      evidenceFailureRate,
      consecutiveFailures: s.consecutiveFailures,
      autoPaused: s.autoPaused,
      lastSuccessfulValidationAt,
    });
    return {
      host: s.host,
      role: s.role,
      evidenceCreated: total,
      passCount: decisions.pass,
      failCount: decisions.fail,
      insufficientCount: decisions.insufficient,
      matchSuccessRate,
      evidenceFailureRate,
      lastSuccessfulValidationAt,
      fetchHealth: fetchHealthOf(s.consecutiveFailures, s.autoPaused),
      consecutiveFailures: s.consecutiveFailures,
      lastSuccessfulSyncAt: s.lastSuccessfulSync,
      healthScore: score,
      penalties,
    };
  });
  rows.sort((a, b) => a.healthScore - b.healthScore);

  return {
    generatedAt,
    rows,
    unhealthyCount: rows.filter((r) => r.healthScore < 60).length,
  };
}
