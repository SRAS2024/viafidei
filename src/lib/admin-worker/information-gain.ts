/**
 * Information-gain model (spec §17).
 *
 * Before spending local CPU, memory, network and time, the worker should be
 * able to answer: what am I trying to learn, how much is it worth, what is the
 * cheapest method likely to get it, and have I already failed at this?
 *
 * This module turns those questions into one deterministic score that the
 * brain's candidate ranking (`brain-candidates.ts` / `action-scores.ts`) and
 * the local runtime can both consult. It reuses what the worker already
 * stores: content goals and their gaps, source reputation, per-method strategy
 * stats, the durable source-read cache, and the acquisition planner's costs.
 *
 * The output is intentionally explainable — every score carries the reasons
 * that produced it, so "why did the worker choose this?" always has an answer.
 */

import type { PrismaClient } from "@prisma/client";

import { METHOD_COST, type AcquisitionMethod } from "./acquisition-planner";
import { rankMethods } from "./method-memory";

export interface GainInput {
  /** What the worker is trying to learn. */
  objective: string;
  contentType?: string | null;
  /** Planned acquisition method. */
  method: AcquisitionMethod;
  /** Target URL/host, when the action is a retrieval. */
  url?: string | null;
  /** Authority weight of the source, 0..1 (Vatican ≈ 1, community ≈ 0.35). */
  sourceAuthority?: number | null;
  /** Number of items still missing for the goal this action serves. */
  goalGap?: number | null;
  /** Total target for that goal (used to normalise the gap). */
  goalTarget?: number | null;
  /** True when this exact objective+method was already tried and failed. */
  previouslyFailed?: boolean;
  /** True when a cheaper method exists that has not been tried yet. */
  cheaperUntriedMethod?: AcquisitionMethod | null;
  /** True when the material is already covered by a durable source read. */
  alreadyKnown?: boolean;
}

export interface GainEstimate {
  /** 0..1 expected information gain. */
  gain: number;
  /** Relative resource cost of the action (local CPU/network/time). */
  cost: number;
  /** gain / cost — the ranking figure. */
  ratio: number;
  /** True when the action is worth taking now. */
  worthwhile: boolean;
  reasons: string[];
  /** A cheaper method the caller should prefer, when one exists. */
  preferInstead: AcquisitionMethod | null;
}

/** Actions below this ratio are not worth their resources. */
export const MIN_WORTHWHILE_RATIO = 0.5;

/**
 * Estimate expected information gain against cost. Pure and deterministic so
 * it can be unit-tested and explained in the reasoning log.
 */
export function estimateInformationGain(input: GainInput): GainEstimate {
  const reasons: string[] = [];
  let gain = 0.35;
  reasons.push(`baseline expectation for "${input.objective}"`);

  // How badly do we need this? A wide-open goal gap is the strongest signal.
  if (input.goalGap != null && input.goalGap > 0) {
    const target = input.goalTarget && input.goalTarget > 0 ? input.goalTarget : input.goalGap;
    const urgency = Math.min(1, input.goalGap / Math.max(1, target));
    gain += 0.35 * urgency;
    reasons.push(
      `content goal is short by ${input.goalGap}${input.goalTarget ? ` of ${input.goalTarget}` : ""} (urgency ${(urgency * 100).toFixed(0)}%)`,
    );
  } else if (input.goalGap === 0) {
    gain -= 0.2;
    reasons.push("the goal this action serves is already met");
  }

  // Authority raises the value of what we would learn.
  if (input.sourceAuthority != null) {
    gain += 0.2 * input.sourceAuthority;
    reasons.push(`source authority weight ${input.sourceAuthority.toFixed(2)}`);
  }

  // Things we already know teach us nothing.
  if (input.alreadyKnown) {
    gain -= 0.45;
    reasons.push("material is already covered by a durable source read — little new information");
  }

  // Repeating a known failure is the classic waste this model exists to stop.
  if (input.previouslyFailed) {
    gain -= 0.3;
    reasons.push("this objective+method combination already failed once — expected gain reduced");
  }

  gain = Math.max(0, Math.min(1, gain));
  const cost = METHOD_COST[input.method] ?? 0.5;
  const ratio = Number((gain / cost).toFixed(3));

  let preferInstead: AcquisitionMethod | null = null;
  if (input.cheaperUntriedMethod && METHOD_COST[input.cheaperUntriedMethod] < cost) {
    preferInstead = input.cheaperUntriedMethod;
    reasons.push(
      `a cheaper untried method exists (${input.cheaperUntriedMethod}, cost ${METHOD_COST[input.cheaperUntriedMethod]} vs ${cost})`,
    );
  }

  return {
    gain: Number(gain.toFixed(3)),
    cost,
    ratio,
    worthwhile: ratio >= MIN_WORTHWHILE_RATIO && preferInstead === null,
    reasons,
    preferInstead,
  };
}

export interface GainRankedAction<T> {
  action: T;
  estimate: GainEstimate;
}

/** Rank candidate actions by information gain per unit of local resource. */
export function rankByInformationGain<T>(
  actions: Array<{ action: T; input: GainInput }>,
): Array<GainRankedAction<T>> {
  return actions
    .map(({ action, input }) => ({ action, estimate: estimateInformationGain(input) }))
    .sort((a, b) => b.estimate.ratio - a.estimate.ratio);
}

/**
 * Database-backed convenience: fill in goal gap, prior failure and "already
 * known" from what the worker has stored, then estimate. Used by the local
 * runtime before it commits resources to a retrieval.
 */
export async function estimateGainFromState(
  prisma: PrismaClient,
  input: {
    objective: string;
    contentType?: string | null;
    method: AcquisitionMethod;
    url?: string | null;
    sourceAuthority?: number | null;
  },
): Promise<GainEstimate> {
  const [goal, knownRead, ranked] = await Promise.all([
    input.contentType
      ? prisma.contentGoal
          .findFirst({ where: { contentType: input.contentType } })
          .catch(() => null)
      : Promise.resolve(null),
    input.url
      ? prisma.adminWorkerSourceRead
          .findFirst({ where: { sourceUrl: input.url }, select: { id: true } })
          .catch(() => null)
      : Promise.resolve(null),
    rankMethods(prisma, { dimension: "acquisition", contentType: input.contentType ?? null }),
  ]);

  const thisMethod = ranked.find((r) => r.method === input.method);
  const cheaper = ranked
    .filter(
      (r) => (METHOD_COST[r.method as AcquisitionMethod] ?? 1) < (METHOD_COST[input.method] ?? 1),
    )
    .filter((r) => r.attempts === 0)
    .map((r) => r.method as AcquisitionMethod)[0];

  return estimateInformationGain({
    objective: input.objective,
    contentType: input.contentType ?? null,
    method: input.method,
    url: input.url ?? null,
    sourceAuthority: input.sourceAuthority ?? null,
    goalGap: goal?.gapCount ?? null,
    goalTarget: goal?.desiredTarget ?? goal?.minimumTarget ?? null,
    previouslyFailed: thisMethod ? thisMethod.attempts > 2 && thisMethod.ewma < 0.2 : false,
    cheaperUntriedMethod: cheaper ?? null,
    alreadyKnown: knownRead != null,
  });
}

export interface GainReprioritizeResult {
  considered: number;
  adjusted: number;
  demoted: number;
  /** Human-readable examples for the log line. */
  examples: string[];
}

/**
 * Apply the information-gain model to the candidate queue.
 *
 * The candidate scorer already ranks by how likely a URL is to yield a good
 * package. This adds the other half of the question (spec §17): would getting
 * it actually teach Via Fidei something it needs? Candidates whose content
 * goal is already met, or whose page the worker has already read, are demoted;
 * candidates that close a wide goal gap are promoted. Bounded and fail-open —
 * a scoring pass is never allowed to block the queue.
 */
export async function applyInformationGainToCandidates(
  prisma: PrismaClient,
  opts: { limit?: number } = {},
): Promise<GainReprioritizeResult> {
  const out: GainReprioritizeResult = { considered: 0, adjusted: 0, demoted: 0, examples: [] };
  const limit = opts.limit ?? 150;

  const candidates = await prisma.candidateSourceUrl
    .findMany({
      where: { status: { in: ["DISCOVERED", "PRIORITIZED"] } },
      orderBy: [{ fetchPriority: "desc" }, { createdAt: "asc" }],
      take: limit,
      select: {
        id: true,
        discoveredUrl: true,
        predictedContentType: true,
        fetchPriority: true,
        predictedUsefulness: true,
      },
    })
    .catch(
      () =>
        [] as Array<{
          id: string;
          discoveredUrl: string;
          predictedContentType: string | null;
          fetchPriority: number;
          predictedUsefulness: number;
        }>,
    );

  if (candidates.length === 0) return out;

  // One goal read for the whole batch rather than one per candidate.
  const goals = await prisma.contentGoal
    .findMany({ select: { contentType: true, gapCount: true, desiredTarget: true } })
    .catch(() => [] as Array<{ contentType: string; gapCount: number; desiredTarget: number }>);
  const goalByType = new Map(goals.map((g) => [g.contentType, g]));

  const alreadyRead = new Set(
    (
      await prisma.adminWorkerSourceRead
        .findMany({
          where: { sourceUrl: { in: candidates.map((c) => c.discoveredUrl) } },
          select: { sourceUrl: true },
        })
        .catch(() => [] as Array<{ sourceUrl: string }>)
    ).map((r) => r.sourceUrl),
  );

  for (const candidate of candidates) {
    out.considered += 1;
    const goal = candidate.predictedContentType
      ? goalByType.get(candidate.predictedContentType)
      : undefined;

    const estimate = estimateInformationGain({
      objective: `close the ${candidate.predictedContentType ?? "unclassified"} content gap`,
      contentType: candidate.predictedContentType,
      method: "static-http",
      url: candidate.discoveredUrl,
      goalGap: goal?.gapCount ?? null,
      goalTarget: goal?.desiredTarget ?? null,
      alreadyKnown: alreadyRead.has(candidate.discoveredUrl),
    });

    // Blend rather than replace: the scorer's judgement about the URL itself
    // still matters; gain decides how much the worker wants what is behind it.
    const next = Number((candidate.fetchPriority * 0.7 + estimate.gain * 0.3).toFixed(3));
    if (Math.abs(next - candidate.fetchPriority) < 0.02) continue;

    const updated = await prisma.candidateSourceUrl
      .update({
        where: { id: candidate.id },
        data: { fetchPriority: next, predictedUsefulness: estimate.gain },
      })
      .catch(() => null);
    if (!updated) continue;

    out.adjusted += 1;
    if (next < candidate.fetchPriority) out.demoted += 1;
    if (out.examples.length < 5) {
      out.examples.push(
        `${candidate.discoveredUrl.slice(0, 80)} → gain ${estimate.gain} (${estimate.reasons[estimate.reasons.length - 1]})`,
      );
    }
  }

  return out;
}
