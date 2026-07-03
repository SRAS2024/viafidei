/**
 * Innovation lab + experimentation memory (adaptive-worker Phase D).
 *
 * The schema and Python brain already model bounded A/B experiments
 * (LabExperimentPlan / LabExperimentResult) and strategy tournaments, but no
 * TypeScript runner ever executed one, persisted a result, or fed the winner
 * back into the worker's decisions. This module closes that loop — SAFELY:
 *
 *   - MEASURE-ONLY. It never publishes, never mutates content, never deploys
 *     code. It reasons over the per-method stats the worker already records
 *     (AdminWorkerStrategyStat, written by method-memory.ts) — a "shadow"
 *     experiment over real observed outcomes, not a live traffic split.
 *   - BOUNDED. Exactly two groups, a capped sample, `publishes:false`.
 *   - REMEMBERS THE WINNER. When a comparison is conclusive (clear margin +
 *     enough attempts on both), it records "prefer method X for this dimension /
 *     content type" into AdminWorkerMemory, which chooseMethodWithExploration and
 *     future ranking consult — so the better approach is actually applied, while
 *     the ε-greedy policy keeps occasionally trialling alternatives.
 *
 * Wired as the `innovation` ops lane (throttled), so the worker continuously
 * researches which of its methods works best without ever risking production.
 */

import type { PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";
import { rememberOutcome } from "./memory";
import { rankMethods, type RankedMethod } from "./method-memory";

/** Conclusive when the EWMA margin clears this AND both groups have data. */
const CONCLUSIVE_MARGIN = 0.2;
const MIN_ATTEMPTS_PER_GROUP = 3;

/** Dimensions the lab is allowed to experiment over (measure-only, all safe). */
const EXPERIMENT_DIMENSIONS = [
  "discovery",
  "fetch",
  "extraction",
  "verification",
  "quality",
  "repair",
  "publishing",
];

/** Throttle: at most once per window per process. */
const LAB_THROTTLE_MS = 30 * 60 * 1000;
let lastRunAt = 0;

export interface InnovationExperimentResult {
  ran: boolean;
  dimension?: string;
  contentType?: string;
  leader?: string | null;
  margin?: number;
  conclusive?: boolean;
  lesson?: string;
  planId?: string;
  reason?: string;
}

/**
 * Run one bounded, measure-only experiment: pick the dimension with the most
 * competing methods that have real data, compare the top two by recency-weighted
 * success rate, persist the plan + result, and — if conclusive — remember the
 * winner so it gets applied. Fail-open.
 */
export async function runInnovationExperiment(
  prisma: PrismaClient,
  opts: { passId?: string } = {},
): Promise<InnovationExperimentResult> {
  try {
    // Find the dimension with at least two methods carrying enough data.
    let chosen: { dimension: string; ranked: RankedMethod[] } | null = null;
    for (const dimension of EXPERIMENT_DIMENSIONS) {
      const ranked = await rankMethods(prisma, { dimension });
      const withData = ranked.filter((r) => r.attempts >= MIN_ATTEMPTS_PER_GROUP);
      if (withData.length >= 2) {
        if (!chosen || withData.length > chosen.ranked.length) {
          chosen = { dimension, ranked: withData };
        }
      }
    }
    if (!chosen) {
      return { ran: false, reason: "no dimension has two methods with enough data yet" };
    }

    const [a, b] = chosen.ranked; // already sorted by ewma desc, attempts desc
    const margin = Math.abs(a.ewma - b.ewma);
    const leader = a.ewma >= b.ewma ? a.method : b.method;
    const conclusive =
      margin >= CONCLUSIVE_MARGIN &&
      a.attempts >= MIN_ATTEMPTS_PER_GROUP &&
      b.attempts >= MIN_ATTEMPTS_PER_GROUP;
    const samplePerGroup = Math.min(10, Math.max(a.attempts, b.attempts));

    const question = `Which ${chosen.dimension} method performs better: ${a.method} vs ${b.method}?`;

    // Persist the bounded, non-publishing plan.
    const planRow = await createPlan(prisma, {
      passId: opts.passId,
      question,
      samplePerGroup,
      groups: [a.method, b.method],
    });

    const lesson = conclusive
      ? `Prefer "${leader}" for ${chosen.dimension} (ewma margin ${margin.toFixed(2)}).`
      : `Inconclusive: ${a.method} (${a.ewma.toFixed(2)}) vs ${b.method} (${b.ewma.toFixed(2)}), margin ${margin.toFixed(2)}.`;

    await createResult(prisma, {
      planId: planRow?.id,
      leader: conclusive ? leader : null,
      margin,
      conclusive,
      lesson,
      groups: { a, b },
    });

    // Remember + apply the winner: chooseMethodWithExploration / ranking consult
    // this GENERIC memory so the better method is preferred going forward.
    if (conclusive) {
      await rememberOutcome(prisma, {
        memoryType: "GENERIC",
        memoryKey: `strategy_winner:${chosen.dimension}`,
        memoryValue: { dimension: chosen.dimension, winner: leader, margin, lesson },
        outcome: "success",
      }).catch(() => undefined);
    }

    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "WORKER_PASS",
      severity: "INFO",
      eventName: "innovation_experiment",
      message: `Innovation lab: ${question} → ${lesson}`,
      safeMetadata: {
        dimension: chosen.dimension,
        groups: [a.method, b.method],
        ewma: [a.ewma, b.ewma],
        attempts: [a.attempts, b.attempts],
        margin,
        conclusive,
        leader: conclusive ? leader : null,
      },
    }).catch(() => undefined);

    return {
      ran: true,
      dimension: chosen.dimension,
      leader: conclusive ? leader : null,
      margin,
      conclusive,
      lesson,
      planId: planRow?.id,
    };
  } catch (err) {
    return { ran: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function createPlan(
  prisma: PrismaClient,
  input: { passId?: string; question: string; samplePerGroup: number; groups: string[] },
): Promise<{ id: string } | null> {
  try {
    const row = await prisma.labExperimentPlan.create({
      data: {
        passId: input.passId ?? null,
        question: input.question,
        metric: "ewma_success_rate",
        groups: input.groups,
        samplePerGroup: input.samplePerGroup,
        bounded: true,
        publishes: false,
        status: "COMPLETE",
        payload: { source: "innovation-lab", measureOnly: true },
      },
      select: { id: true },
    });
    return row;
  } catch {
    return null;
  }
}

async function createResult(
  prisma: PrismaClient,
  input: {
    planId?: string;
    leader: string | null;
    margin: number;
    conclusive: boolean;
    lesson: string;
    groups: { a: RankedMethod; b: RankedMethod };
  },
): Promise<void> {
  try {
    await prisma.labExperimentResult.create({
      data: {
        planId: input.planId ?? null,
        leader: input.leader,
        margin: input.margin,
        conclusive: input.conclusive,
        lesson: input.lesson,
        payload: {
          groups: [
            {
              method: input.groups.a.method,
              ewma: input.groups.a.ewma,
              attempts: input.groups.a.attempts,
            },
            {
              method: input.groups.b.method,
              ewma: input.groups.b.ewma,
              attempts: input.groups.b.attempts,
            },
          ],
        },
      },
    });
  } catch {
    // measure-only persistence — never blocks the lane
  }
}

/**
 * Throttled entry point for the innovation lane: run at most once per window.
 */
export async function maybeRunInnovationExperiment(
  prisma: PrismaClient,
  opts: { passId?: string; now?: number } = {},
): Promise<InnovationExperimentResult> {
  const now = opts.now ?? Date.now();
  if (now - lastRunAt < LAB_THROTTLE_MS) {
    return { ran: false, reason: "throttled" };
  }
  lastRunAt = now;
  return runInnovationExperiment(prisma, { passId: opts.passId });
}
