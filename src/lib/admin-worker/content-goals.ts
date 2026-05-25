/**
 * Content goals. The planner compares the live count of published-and-
 * valid items per content type against the minimum and desired
 * targets. The content type with the largest gap is prioritised.
 *
 * Targets here are the Phase 1 starting point — admins can edit them
 * via Prisma directly until the goal-editor UI is wired up.
 */

import type { ChecklistContentType, ContentGoalStatus, PrismaClient } from "@prisma/client";

export interface ContentGoalSeed {
  contentType: ChecklistContentType;
  minimumTarget: number;
  desiredTarget: number;
  priority: number;
}

/**
 * Default goal seeds. Numbers are the minimum content count that
 * keeps each public tab feeling alive — calibrated against the
 * existing master checklists (eg. 24 prayers, 30 saints).
 */
export const DEFAULT_GOAL_SEEDS: readonly ContentGoalSeed[] = [
  { contentType: "PRAYER", minimumTarget: 24, desiredTarget: 60, priority: 10 },
  { contentType: "SAINT", minimumTarget: 30, desiredTarget: 75, priority: 20 },
  { contentType: "DEVOTION", minimumTarget: 12, desiredTarget: 25, priority: 30 },
  { contentType: "NOVENA", minimumTarget: 9, desiredTarget: 18, priority: 40 },
  { contentType: "MARIAN_TITLE", minimumTarget: 8, desiredTarget: 16, priority: 50 },
  { contentType: "APPARITION", minimumTarget: 5, desiredTarget: 12, priority: 60 },
  { contentType: "SACRAMENT", minimumTarget: 7, desiredTarget: 7, priority: 5 },
  { contentType: "GUIDE", minimumTarget: 8, desiredTarget: 20, priority: 70 },
  { contentType: "CHURCH_DOCUMENT", minimumTarget: 10, desiredTarget: 30, priority: 80 },
  { contentType: "LITURGICAL", minimumTarget: 12, desiredTarget: 25, priority: 90 },
  { contentType: "SPIRITUAL_PRACTICE", minimumTarget: 8, desiredTarget: 18, priority: 100 },
] as const;

export async function seedContentGoals(prisma: PrismaClient): Promise<number> {
  let seeded = 0;
  for (const seed of DEFAULT_GOAL_SEEDS) {
    const existing = await prisma.contentGoal.findUnique({
      where: { contentType: seed.contentType },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.contentGoal.create({
      data: {
        contentType: seed.contentType,
        minimumTarget: seed.minimumTarget,
        desiredTarget: seed.desiredTarget,
        priority: seed.priority,
        status: "NOT_STARTED",
      },
    });
    seeded += 1;
  }
  return seeded;
}

export function deriveStatus(current: number, minimum: number, desired: number): ContentGoalStatus {
  if (minimum === 0 && desired === 0) return "NOT_STARTED";
  if (current === 0) return "NOT_STARTED";
  if (current >= desired) return "MAINTENANCE";
  if (current >= minimum) return "GOAL_MET";
  if (current >= Math.floor(minimum * 0.75)) return "NEAR_GOAL";
  return "IN_PROGRESS";
}

/**
 * Refresh every ContentGoal row from the live PublishedContent count.
 * Run before the planner picks a priority, so the planner sees current
 * gaps rather than stale snapshots.
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
    const gap = Math.max(0, goal.minimumTarget - current);
    const status = deriveStatus(current, goal.minimumTarget, goal.desiredTarget);
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
