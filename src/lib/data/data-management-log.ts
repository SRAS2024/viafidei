import { prisma } from "../db/client";
import type { Prisma } from "@prisma/client";

/**
 * Discrete action categories tracked by the Ingestion & Data
 * Management system. Used by both the writer (cleanup pass, manual
 * admin actions) and the reader (Logs admin page).
 */
export type DataManagementAction =
  | "ADD"
  | "UPDATE"
  | "DELETE"
  | "REJECT"
  | "CLEANUP"
  | "DEDUPE"
  | "CATEGORY_FIX";

export const DATA_MANAGEMENT_ACTIONS: ReadonlyArray<DataManagementAction> = [
  "ADD",
  "UPDATE",
  "DELETE",
  "REJECT",
  "CLEANUP",
  "DEDUPE",
  "CATEGORY_FIX",
];

const ACTION_LABELS: Record<DataManagementAction, string> = {
  ADD: "Added",
  UPDATE: "Updated",
  DELETE: "Deleted",
  REJECT: "Rejected",
  CLEANUP: "Archived (cleanup)",
  DEDUPE: "Archived (duplicate)",
  CATEGORY_FIX: "Re-categorised",
};

export function dataManagementActionLabel(action: string): string {
  return ACTION_LABELS[action as DataManagementAction] ?? action;
}

export type DataManagementLogInput = {
  action: DataManagementAction;
  contentType: string;
  contentRef?: string | null;
  reason?: string | null;
  triggeredBy?: "automatic" | "manual";
  actorUsername?: string | null;
};

export async function recordDataManagementLog(input: DataManagementLogInput) {
  return prisma.dataManagementLog.create({
    data: {
      action: input.action,
      contentType: input.contentType,
      contentRef: input.contentRef ?? null,
      reason: input.reason ?? null,
      triggeredBy: input.triggeredBy ?? "automatic",
      actorUsername: input.actorUsername ?? null,
    },
  });
}

/**
 * Batched writer for the cleanup pass: a single transaction creates
 * many log rows at once so the cron job's footprint stays low.
 */
export async function recordDataManagementLogs(inputs: DataManagementLogInput[]) {
  if (inputs.length === 0) return { count: 0 };
  return prisma.dataManagementLog.createMany({
    data: inputs.map((input) => ({
      action: input.action,
      contentType: input.contentType,
      contentRef: input.contentRef ?? null,
      reason: input.reason ?? null,
      triggeredBy: input.triggeredBy ?? "automatic",
      actorUsername: input.actorUsername ?? null,
    })),
  });
}

export type DataManagementLogFilter = {
  action?: DataManagementAction;
  contentType?: string;
  triggeredBy?: "automatic" | "manual";
  take?: number;
  cursor?: string;
};

export async function listDataManagementLogs(filter: DataManagementLogFilter = {}) {
  const where: Prisma.DataManagementLogWhereInput = {};
  if (filter.action) where.action = filter.action;
  if (filter.contentType) where.contentType = filter.contentType;
  if (filter.triggeredBy) where.triggeredBy = filter.triggeredBy;
  const take = Math.min(Math.max(filter.take ?? 50, 1), 200);

  const items = await prisma.dataManagementLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
  });
  let nextCursor: string | null = null;
  if (items.length > take) {
    const next = items.pop();
    nextCursor = next?.id ?? null;
  }
  return { items, nextCursor };
}

/**
 * Aggregate count of actions in the last `hoursBack` hours, grouped
 * by contentType. Drives the "edits in the last 24 hours" line on
 * the Ingestion & Data Management admin page.
 */
export async function getRecentActivityByContentType(hoursBack = 24) {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const rows = await prisma.dataManagementLog.groupBy({
    by: ["contentType"],
    where: { createdAt: { gte: cutoff } },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.contentType] = row._count._all;
  }
  return out;
}

/**
 * Aggregate count by action over the last `hoursBack` hours, used by
 * the Data Management Diagnostics page so an admin can see at a
 * glance whether the system is currently rejecting / archiving /
 * deleting at the expected rate.
 */
export async function getRecentActivityByAction(hoursBack = 24) {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const rows = await prisma.dataManagementLog.groupBy({
    by: ["action"],
    where: { createdAt: { gte: cutoff } },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.action] = row._count._all;
  }
  return out;
}
