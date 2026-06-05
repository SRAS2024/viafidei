/**
 * Content goals. Each content type has a single **maximum** target — a cap the
 * worker fills toward and never exceeds. There is no minimum: the worker keeps
 * building a type until it reaches the cap, then leaves it in MAINTENANCE.
 *
 * Some caps are fixed by the faith itself (exactly seven Sacraments, the set
 * list of Doctors of the Church and Popes); others are a sensible ceiling for a
 * curated catalog. The content type with the largest remaining gap to its cap
 * is prioritised. Caps ship as seeded defaults; admins can edit them via Prisma.
 */

import type { ChecklistContentType, ContentGoalStatus, PrismaClient } from "@prisma/client";

export interface ContentGoalSeed {
  contentType: ChecklistContentType;
  /** The maximum number of published items for this type — the worker stops here. */
  maximumTarget: number;
  priority: number;
}

/**
 * Default caps. Fixed-by-the-faith counts (7 sacraments, 37 Doctors of the
 * Church, 266 popes) are exact; the rest are practical ceilings for a curated
 * catalog. The worker never publishes past these.
 */
export const DEFAULT_GOAL_SEEDS: readonly ContentGoalSeed[] = [
  { contentType: "PRAYER", maximumTarget: 80, priority: 10 },
  { contentType: "SAINT", maximumTarget: 150, priority: 20 },
  { contentType: "DEVOTION", maximumTarget: 40, priority: 30 },
  { contentType: "NOVENA", maximumTarget: 30, priority: 40 },
  { contentType: "MARIAN_TITLE", maximumTarget: 25, priority: 50 },
  { contentType: "APPARITION", maximumTarget: 20, priority: 60 },
  { contentType: "SACRAMENT", maximumTarget: 7, priority: 5 }, // exactly seven
  { contentType: "GUIDE", maximumTarget: 30, priority: 70 },
  { contentType: "CHURCH_DOCUMENT", maximumTarget: 60, priority: 80 },
  { contentType: "LITURGICAL", maximumTarget: 40, priority: 90 },
  { contentType: "SPIRITUAL_PRACTICE", maximumTarget: 25, priority: 100 },
  { contentType: "PARISH", maximumTarget: 100, priority: 110 },
  { contentType: "POPE", maximumTarget: 266, priority: 120 }, // the set list of popes
  { contentType: "DOCTOR", maximumTarget: 37, priority: 130 }, // the 37 Doctors of the Church
  { contentType: "RITE", maximumTarget: 24, priority: 140 }, // the sui iuris churches
] as const;

export async function seedContentGoals(prisma: PrismaClient): Promise<number> {
  let seeded = 0;
  for (const seed of DEFAULT_GOAL_SEEDS) {
    // Upsert so the max-only caps apply even to pre-existing goal rows.
    // minimumTarget is pinned to 0 — the model has no minimum, only the cap
    // stored in desiredTarget.
    await prisma.contentGoal.upsert({
      where: { contentType: seed.contentType },
      update: { minimumTarget: 0, desiredTarget: seed.maximumTarget, priority: seed.priority },
      create: {
        contentType: seed.contentType,
        minimumTarget: 0,
        desiredTarget: seed.maximumTarget,
        priority: seed.priority,
        status: "NOT_STARTED",
      },
    });
    seeded += 1;
  }
  return seeded;
}

/**
 * Status from the live count against the maximum cap. No minimum: a type is
 * IN_PROGRESS until it nears the cap, NEAR_GOAL within the last quarter, and
 * MAINTENANCE once it reaches the cap.
 */
export function deriveStatus(current: number, maximum: number): ContentGoalStatus {
  if (maximum <= 0) return "NOT_STARTED";
  if (current <= 0) return "NOT_STARTED";
  if (current >= maximum) return "MAINTENANCE";
  if (current >= Math.floor(maximum * 0.75)) return "NEAR_GOAL";
  return "IN_PROGRESS";
}

/**
 * Refresh every ContentGoal row from the live PublishedContent count.
 * Run before the planner picks a priority, so the planner sees current
 * gaps-to-the-cap rather than stale snapshots.
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
    // desiredTarget holds the maximum cap; the gap is what remains up to it.
    const cap = goal.desiredTarget;
    const gap = Math.max(0, cap - current);
    const status = deriveStatus(current, cap);
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

export async function nextPriorityContentType(
  prisma: PrismaClient,
): Promise<{ contentType: string; gap: number } | null> {
  const goals = await prisma.contentGoal.findMany({
    where: { gapCount: { gt: 0 } },
    orderBy: [{ gapCount: "desc" }, { priority: "asc" }],
    take: 1,
  });
  if (goals.length === 0) return null;
  return { contentType: goals[0].contentType, gap: goals[0].gapCount };
}
