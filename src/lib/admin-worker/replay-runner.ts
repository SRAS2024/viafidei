/**
 * Replay & simulation orchestration (spec item 16: "Replay last worker pass",
 * "Replay last 50 passes in simulation", "Idempotency keys for worker actions",
 * "Decision event sourcing").
 *
 * The event-sourced record is the durable AdminWorkerDecision table: each row
 * stores the chosen mission stage plus the full ranked candidate list it
 * considered (`rankedAlternatives`). This module is strictly READ-ONLY — it
 * reconstructs those candidates and asks the Python brain to replay the
 * decision deterministically (`replay_decision`), proving reproducibility and
 * surfacing drift, without re-executing or writing any worker action. An
 * idempotency key per (pass, stage, action) dedupes replays so the same stored
 * decision is never double-counted in a simulation window.
 */

import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { detectDecisionDrift, isBrainEnabled, replayDecision } from "./intelligence";
import { BrainCallContext, recordBrainCall } from "./intelligence/store";
import { writeAdminWorkerLog } from "./logs";

/**
 * Deterministic idempotency key for a worker action. The same (pass, stage,
 * action, contentType) always yields the same key, so a replayed/duplicated
 * action is recognised and never counted or executed twice.
 */
export function actionIdempotencyKey(input: {
  passId?: string | null;
  missionStage?: string | null;
  action?: string | null;
  contentType?: string | null;
}): string {
  const basis = [
    input.passId ?? "",
    input.missionStage ?? "",
    input.action ?? "",
    input.contentType ?? "",
  ].join("|");
  return createHash("sha1").update(basis).digest("hex").slice(0, 16);
}

interface StoredCandidate {
  missionStage?: string;
  finalScore?: number;
  safe?: boolean;
}

function reconstructCandidates(rankedAlternatives: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(rankedAlternatives)) return [];
  return rankedAlternatives
    .filter((a): a is StoredCandidate => !!a && typeof a === "object")
    .map((a) => ({
      missionStage: String(a.missionStage ?? ""),
      finalScore: typeof a.finalScore === "number" ? a.finalScore : 0,
      safe: a.safe !== false,
    }));
}

export interface ReplayResult {
  ran: boolean;
  reproduced: boolean;
  originalStage: string;
  replayedStage: string;
}

/**
 * Replay the most recent worker decision: reconstruct its candidates and ask
 * the brain to re-select, reporting whether the original choice reproduces.
 */
export async function replayLastPass(
  prisma: PrismaClient,
  ctx: BrainCallContext = {},
): Promise<ReplayResult> {
  if (!isBrainEnabled())
    return { ran: false, reproduced: false, originalStage: "", replayedStage: "" };
  try {
    const last = await prisma.adminWorkerDecision
      .findFirst({
        where: { decisionType: "brain_pass", missionStage: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { missionStage: true, rankedAlternatives: true },
      })
      .catch(() => null);
    if (!last) return { ran: false, reproduced: false, originalStage: "", replayedStage: "" };

    const candidates = reconstructCandidates(last.rankedAlternatives);
    if (candidates.length === 0)
      return {
        ran: false,
        reproduced: false,
        originalStage: last.missionStage ?? "",
        replayedStage: "",
      };

    const env = await replayDecision({ chosen_stage: last.missionStage ?? "", candidates });
    await recordBrainCall(prisma, "replay_decision", env, ctx);
    const res = (env?.result ?? null) as {
      reproduced?: boolean;
      replayed_stage?: string;
    } | null;
    return {
      ran: !!env?.ok,
      reproduced: !!res?.reproduced,
      originalStage: last.missionStage ?? "",
      replayedStage: res?.replayed_stage ?? "",
    };
  } catch {
    return { ran: false, reproduced: false, originalStage: "", replayedStage: "" };
  }
}

export interface ReplaySimulationResult {
  ran: boolean;
  replayed: number;
  reproduced: number;
  reproductionRate: number;
  drift: boolean;
}

/**
 * Replay the last N stored passes in simulation: re-select each decision from
 * its recorded candidates, aggregate the reproduction rate, and check the stage
 * sequence for drift. Idempotency-keyed so duplicate (pass, stage, action)
 * decisions are counted once. Writes a durable replay-simulation snapshot.
 */
export async function replayRecentPasses(
  prisma: PrismaClient,
  n = 50,
  ctx: BrainCallContext = {},
): Promise<ReplaySimulationResult> {
  if (!isBrainEnabled())
    return { ran: false, replayed: 0, reproduced: 0, reproductionRate: 0, drift: false };
  try {
    const rows = await prisma.adminWorkerDecision
      .findMany({
        where: { decisionType: "brain_pass", missionStage: { not: null } },
        orderBy: { createdAt: "desc" },
        take: Math.max(1, Math.min(n, 200)),
        select: { passId: true, missionStage: true, chosenAction: true, rankedAlternatives: true },
      })
      .catch(() => []);
    if (rows.length === 0)
      return { ran: false, replayed: 0, reproduced: 0, reproductionRate: 0, drift: false };

    const seen = new Set<string>();
    let replayed = 0;
    let reproduced = 0;
    for (const row of rows) {
      const key = actionIdempotencyKey({
        passId: row.passId,
        missionStage: row.missionStage,
        action: row.chosenAction,
      });
      if (seen.has(key)) continue; // idempotent: count each action once
      seen.add(key);
      const candidates = reconstructCandidates(row.rankedAlternatives);
      if (candidates.length === 0) continue;
      const best = candidates.reduce(
        (a, b) => ((b.finalScore as number) > (a.finalScore as number) ? b : a),
        candidates[0],
      );
      replayed += 1;
      if (String(best.missionStage) === (row.missionStage ?? "")) reproduced += 1;
    }

    const driftEnv = await detectDecisionDrift(
      rows.map((r) => ({ missionStage: r.missionStage ?? "" })),
    );
    await recordBrainCall(prisma, "detect_decision_drift", driftEnv, ctx);
    const drift = !!(driftEnv?.result as { drift?: boolean } | null)?.drift;
    const reproductionRate = replayed > 0 ? reproduced / replayed : 0;

    await writeAdminWorkerLog(prisma, {
      passId: ctx.passId ?? undefined,
      category: "REPORT",
      severity: reproductionRate < 0.8 ? "WARN" : "INFO",
      eventName: "replay_simulation",
      message: `Replayed ${replayed} pass(es) in simulation: ${reproduced} reproduced (${Math.round(
        reproductionRate * 100,
      )}%)${drift ? "; decision drift detected" : ""}.`,
      safeMetadata: { replayed, reproduced, reproductionRate, drift },
    }).catch(() => undefined);

    return { ran: true, replayed, reproduced, reproductionRate, drift };
  } catch {
    return { ran: false, replayed: 0, reproduced: 0, reproductionRate: 0, drift: false };
  }
}
