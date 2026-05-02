import { prisma } from "../db/client";

export function listRecentAuditLogs(take = 100) {
  return prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
}
