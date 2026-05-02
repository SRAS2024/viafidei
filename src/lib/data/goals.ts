import { prisma } from "../db/client";
import type { GoalStatus, MilestoneTier } from "@prisma/client";

export type GoalLookup<T> =
  | { ok: true; goal: T }
  | { ok: false; reason: "not_found" | "forbidden" };

const GOAL_INCLUDE = { checklist: { orderBy: { sortOrder: "asc" as const } } };

export function listGoals(userId: string, status?: GoalStatus) {
  return prisma.goal.findMany({
    where: { userId, ...(status ? { status } : {}) },
    include: GOAL_INCLUDE,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
  });
}

export async function getGoal(userId: string, goalId: string) {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: GOAL_INCLUDE,
  });
  if (!goal) return { ok: false as const, reason: "not_found" as const };
  if (goal.userId !== userId) return { ok: false as const, reason: "forbidden" as const };
  return { ok: true as const, goal };
}

export async function createGoal(input: {
  userId: string;
  title: string;
  description?: string | null;
  dueDate?: Date | null;
  templateSlug?: string | null;
  checklist?: { label: string }[];
}) {
  return prisma.goal.create({
    data: {
      userId: input.userId,
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate ?? null,
      templateSlug: input.templateSlug ?? null,
      checklist: input.checklist
        ? {
            create: input.checklist.map((item, index) => ({
              label: item.label,
              sortOrder: index,
            })),
          }
        : undefined,
    },
    include: GOAL_INCLUDE,
  });
}

export async function updateGoal(
  userId: string,
  goalId: string,
  patch: {
    title?: string;
    description?: string | null;
    dueDate?: Date | null;
    status?: GoalStatus;
  },
) {
  const lookup = await getGoal(userId, goalId);
  if (!lookup.ok) return lookup;
  const updated = await prisma.goal.update({
    where: { id: goalId },
    data: patch,
    include: GOAL_INCLUDE,
  });
  return { ok: true as const, goal: updated };
}

export async function deleteGoal(userId: string, goalId: string) {
  const lookup = await getGoal(userId, goalId);
  if (!lookup.ok) return lookup;
  await prisma.goal.delete({ where: { id: goalId } });
  return { ok: true as const };
}

export async function archiveGoal(userId: string, goalId: string) {
  return updateGoal(userId, goalId, { status: "ARCHIVED" });
}

const MILESTONE_TITLE_FALLBACK = "Completed goal";

export async function completeGoal(userId: string, goalId: string, promote = true) {
  const lookup = await getGoal(userId, goalId);
  if (!lookup.ok) return lookup;

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.goal.update({
      where: { id: goalId },
      data: { status: "COMPLETED", completedAt: now },
      include: GOAL_INCLUDE,
    });
    let milestone = null;
    if (promote) {
      const slug = `goal-${updated.id}`;
      const existing = await tx.milestone.findUnique({
        where: { userId_slug: { userId, slug } },
      });
      if (!existing) {
        milestone = await tx.milestone.create({
          data: {
            userId,
            goalId: updated.id,
            tier: "PERSONAL" as MilestoneTier,
            slug,
            title: updated.title || MILESTONE_TITLE_FALLBACK,
            description: updated.description ?? null,
          },
        });
      } else {
        milestone = existing;
      }
    }
    return { ok: true as const, goal: updated, milestone };
  });
}

export async function markOverdueGoals(now: Date = new Date()) {
  const result = await prisma.goal.updateMany({
    where: {
      status: "ACTIVE",
      dueDate: { lt: now, not: null },
    },
    data: { status: "OVERDUE" },
  });
  return result.count;
}

export async function addChecklistItem(userId: string, goalId: string, label: string) {
  const lookup = await getGoal(userId, goalId);
  if (!lookup.ok) return lookup;
  const max = await prisma.goalChecklistItem.aggregate({
    where: { goalId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;
  const item = await prisma.goalChecklistItem.create({
    data: { goalId, label, sortOrder },
  });
  return { ok: true as const, item };
}

export async function updateChecklistItem(
  userId: string,
  goalId: string,
  itemId: string,
  patch: { label?: string; isCompleted?: boolean },
) {
  const lookup = await getGoal(userId, goalId);
  if (!lookup.ok) return lookup;
  const item = await prisma.goalChecklistItem.findUnique({ where: { id: itemId } });
  if (!item || item.goalId !== goalId) {
    return { ok: false as const, reason: "not_found" as const };
  }
  const updated = await prisma.goalChecklistItem.update({
    where: { id: itemId },
    data: patch,
  });
  return { ok: true as const, item: updated };
}

export async function deleteChecklistItem(userId: string, goalId: string, itemId: string) {
  const lookup = await getGoal(userId, goalId);
  if (!lookup.ok) return lookup;
  const item = await prisma.goalChecklistItem.findUnique({ where: { id: itemId } });
  if (!item || item.goalId !== goalId) {
    return { ok: false as const, reason: "not_found" as const };
  }
  await prisma.goalChecklistItem.delete({ where: { id: itemId } });
  return { ok: true as const };
}

export async function reorderChecklist(userId: string, goalId: string, itemIds: string[]) {
  const lookup = await getGoal(userId, goalId);
  if (!lookup.ok) return lookup;
  await prisma.$transaction(async (tx) => {
    // Move existing items to high temporary sort orders so the unique
    // (goalId, sortOrder) constraint is not violated mid-transaction.
    await Promise.all(
      itemIds.map((id, idx) =>
        tx.goalChecklistItem.updateMany({
          where: { id, goalId },
          data: { sortOrder: 1_000_000 + idx },
        }),
      ),
    );
    await Promise.all(
      itemIds.map((id, idx) =>
        tx.goalChecklistItem.updateMany({
          where: { id, goalId },
          data: { sortOrder: idx },
        }),
      ),
    );
  });
  return { ok: true as const };
}
