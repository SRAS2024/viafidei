/**
 * Content goals.
 *
 * Every content type has a **target goal** — the number the worker grows
 * toward. Only *closed* content types (those fixed by the faith) carry a
 * **canonicalMax**: a true hard maximum the worker never exceeds. Today the
 * ONLY closed type is SACRAMENT (exactly seven). Every other type is *open*:
 * `canonicalMax` is null, the target is a growth milestone, and the worker
 * keeps building verified content past the target at a slower maintenance
 * pace (it never treats the target as an absolute cap).
 *
 * The content type with the largest remaining gap to its target is
 * prioritised. Targets ship as seeded defaults; admins can edit them via
 * Prisma. The target is NEVER a reason to publish — content still has to pass
 * every accuracy / approval / source / verification / QA / quality gate.
 */

import type { ChecklistContentType, ContentGoalStatus, PrismaClient } from "@prisma/client";

export interface ContentGoalSeed {
  contentType: ChecklistContentType;
  /** Growth target — the milestone the worker builds toward. */
  targetGoal: number;
  /**
   * Hard maximum, only for *closed* content types fixed by the faith. `null`
   * for every open type (the worker keeps growing past the target). Today
   * only SACRAMENT has one.
   */
  canonicalMax: number | null;
  priority: number;
}

/**
 * Default targets. Only SACRAMENT is closed (canonicalMax 7). Every other
 * type is open (canonicalMax null): the target is a growth milestone, not a
 * ceiling — recognized, approved, verified content keeps flowing in past it.
 */
export const DEFAULT_GOAL_SEEDS: readonly ContentGoalSeed[] = [
  // Closed — fixed by the faith. The ONLY hard maximum.
  { contentType: "SACRAMENT", targetGoal: 7, canonicalMax: 7, priority: 5 },
  // Open — grow toward the target, then maintain + keep growing as verified
  // content becomes available. No hard maximum.
  { contentType: "PRAYER", targetGoal: 1000, canonicalMax: null, priority: 10 },
  { contentType: "POPE", targetGoal: 267, canonicalMax: null, priority: 15 },
  { contentType: "SAINT", targetGoal: 10000, canonicalMax: null, priority: 20 },
  { contentType: "DOCTOR", targetGoal: 37, canonicalMax: null, priority: 25 },
  { contentType: "DEVOTION", targetGoal: 100, canonicalMax: null, priority: 30 },
  { contentType: "NOVENA", targetGoal: 100, canonicalMax: null, priority: 40 },
  { contentType: "MARIAN_TITLE", targetGoal: 50, canonicalMax: null, priority: 50 },
  { contentType: "APPARITION", targetGoal: 50, canonicalMax: null, priority: 60 },
  { contentType: "GUIDE", targetGoal: 100, canonicalMax: null, priority: 70 },
  { contentType: "CHURCH_DOCUMENT", targetGoal: 200, canonicalMax: null, priority: 80 },
  { contentType: "LITURGICAL", targetGoal: 100, canonicalMax: null, priority: 90 },
  { contentType: "SPIRITUAL_PRACTICE", targetGoal: 50, canonicalMax: null, priority: 100 },
  { contentType: "PARISH", targetGoal: 300000, canonicalMax: null, priority: 110 },
  { contentType: "RITE", targetGoal: 24, canonicalMax: null, priority: 140 },
] as const;

export async function seedContentGoals(prisma: PrismaClient): Promise<number> {
  let seeded = 0;
  for (const seed of DEFAULT_GOAL_SEEDS) {
    // `desiredTarget` stores the growth target; `canonicalMax` is the hard
    // maximum (only for closed types). minimumTarget stays 0.
    await prisma.contentGoal.upsert({
      where: { contentType: seed.contentType },
      update: {
        minimumTarget: 0,
        desiredTarget: seed.targetGoal,
        canonicalMax: seed.canonicalMax,
        priority: seed.priority,
      },
      create: {
        contentType: seed.contentType,
        minimumTarget: 0,
        desiredTarget: seed.targetGoal,
        canonicalMax: seed.canonicalMax,
        priority: seed.priority,
        status: "NOT_STARTED",
      },
    });
    seeded += 1;
  }
  return seeded;
}

/**
 * Status from the live count.
 *
 *   - Closed type (canonicalMax set): CANONICAL_COMPLETE once the count
 *     reaches the hard maximum; otherwise IN_PROGRESS / NEAR_GOAL.
 *   - Open type (canonicalMax null): TARGET_REACHED once the count reaches
 *     the target (the worker keeps growing past it at a maintenance pace);
 *     otherwise IN_PROGRESS / NEAR_GOAL.
 *
 * "complete" is reserved for closed types only — an open type that hit its
 * target is "target reached", never "complete".
 */
export function deriveStatus(
  current: number,
  target: number,
  canonicalMax: number | null,
): ContentGoalStatus {
  if (current <= 0) return "NOT_STARTED";
  if (canonicalMax != null) {
    if (current >= canonicalMax) return "CANONICAL_COMPLETE";
    if (current >= Math.floor(canonicalMax * 0.75)) return "NEAR_GOAL";
    return "IN_PROGRESS";
  }
  if (target > 0 && current >= target) return "TARGET_REACHED";
  if (target > 0 && current >= Math.floor(target * 0.75)) return "NEAR_GOAL";
  return "IN_PROGRESS";
}

/**
 * Refresh every ContentGoal row from the live PublishedContent count.
 * Run before the planner picks a priority. For open types the gap is what
 * remains up to the target; reaching the target leaves a zero gap (the worker
 * deprioritises it to a maintenance pace but never hard-stops — new verified
 * content still flows through the pipeline).
 */
export async function refreshContentGoals(prisma: PrismaClient): Promise<void> {
  const goals = await prisma.contentGoal.findMany();
  if (goals.length === 0) return;
  const counts = await prisma.publishedContent.groupBy({
    by: ["contentType"],
    where: { isPublished: true },
    _count: true,
  });
  const countMap = new Map(counts.map((c) => [c.contentType as string, c._count as number]));

  for (const goal of goals) {
    const current = countMap.get(goal.contentType) ?? 0;
    const target = goal.desiredTarget;
    const gap = Math.max(0, target - current);
    const status = deriveStatus(current, target, goal.canonicalMax ?? null);
    await prisma.contentGoal.update({
      where: { id: goal.id },
      data: {
        currentValidCount: current,
        gapCount: gap,
        status,
        lastUpdatedAt: new Date(),
      },
    });
  }
}

/**
 * Human-readable label for a goal status. "complete" is reserved for closed
 * content types (CANONICAL_COMPLETE); an open type that reached its target
 * shows "Target reached", never "complete".
 */
export function contentGoalStatusLabel(status: ContentGoalStatus | string): string {
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "IN_PROGRESS":
      return "In progress";
    case "NEAR_GOAL":
      return "Near target";
    case "GOAL_MET":
    case "TARGET_REACHED":
      return "Target reached";
    case "CANONICAL_COMPLETE":
      return "Canonical complete";
    case "NEEDS_VERIFICATION":
      return "Needs verification";
    case "SOURCE_BLOCKED":
      return "Source blocked";
    case "STALLED":
      return "Stalled";
    case "MAINTENANCE":
      return "Maintenance";
    case "PAUSED":
      return "Paused";
    default:
      return String(status);
  }
}

export async function nextPriorityContentType(
  prisma: PrismaClient,
): Promise<{ contentType: string; gap: number } | null> {
  const goals = await prisma.contentGoal.findMany({
    where: { gapCount: { gt: 0 } },
  });
  if (goals.length === 0) return null;

  // Rank by gap FRACTION (gap / desiredTarget), not absolute gap, so a type
  // with a very large target (Parish 300k, Saint 10k) cannot permanently
  // monopolize discovery over the other below-goal types. Ties break on raw
  // gap, then declared priority.
  const ranked = goals
    .map((g) => ({
      contentType: g.contentType,
      gap: g.gapCount,
      frac: g.desiredTarget > 0 ? g.gapCount / g.desiredTarget : 1,
      priority: g.priority,
    }))
    .sort((a, b) => b.frac - a.frac || b.gap - a.gap || a.priority - b.priority);

  // Rotation: spread discovery across types instead of fixating on the single
  // neediest one (the live worker was looping DISCOVERY on PARISH forever).
  // Skip the types targeted in the last few discovery decisions so the worker
  // visits each below-goal type in turn — but never exclude every option.
  // Defensive: tolerate a prisma client without the decision model (tests /
  // degraded) — fall back to no rotation rather than throwing.
  let recentTypes = new Set<string | null>();
  try {
    const recent = await prisma.adminWorkerDecision.findMany({
      where: { missionStage: "DISCOVERY", contentType: { not: null } },
      orderBy: { createdAt: "desc" },
      take: Math.max(0, Math.min(3, ranked.length - 1)),
      select: { contentType: true },
    });
    recentTypes = new Set(recent.map((r) => r.contentType));
  } catch {
    recentTypes = new Set();
  }
  const pick = ranked.find((g) => !recentTypes.has(g.contentType)) ?? ranked[0];
  return { contentType: pick.contentType, gap: pick.gap };
}
