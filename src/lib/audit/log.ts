import { prisma } from "../db/client";

export type AuditEvent = {
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  actorUsername?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

export async function writeAudit(event: AuditEvent): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        previousValue: event.previousValue as never,
        newValue: event.newValue as never,
        actorUsername: event.actorUsername ?? null,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        requestId: event.requestId ?? null,
      },
    });
  } catch {
    // logging is best-effort; never throw from audit pipeline
  }
}
