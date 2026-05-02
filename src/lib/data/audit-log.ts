import { prisma } from "../db/client";
import type { Prisma } from "@prisma/client";

export function listRecentAuditLogs(take = 100) {
  return prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
}

export type AuditFilter = {
  entityType?: string;
  entityId?: string;
  actor?: string;
  action?: string;
  take?: number;
  cursor?: string;
};

export async function listAuditLogs(filter: AuditFilter = {}) {
  const where: Prisma.AdminAuditLogWhereInput = {};
  if (filter.entityType) where.entityType = filter.entityType;
  if (filter.entityId) where.entityId = filter.entityId;
  if (filter.actor) where.actorUsername = filter.actor;
  if (filter.action) where.action = { contains: filter.action };
  const take = Math.min(Math.max(filter.take ?? 50, 1), 200);

  const items = await prisma.adminAuditLog.findMany({
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
