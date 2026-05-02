import { prisma } from "../db/client";

const DEFAULT_INGESTION_RUN_RETENTION_DAYS = 60;
const DEFAULT_AUDIT_RETENTION_DAYS = 365;

export async function pruneOldIngestionRuns(
  olderThanDays = DEFAULT_INGESTION_RUN_RETENTION_DAYS,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.ingestionJobRun.deleteMany({
    where: { startedAt: { lt: cutoff } },
  });
  return result.count;
}

export async function pruneOldAuditLogs(
  olderThanDays = DEFAULT_AUDIT_RETENTION_DAYS,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.adminAuditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}
