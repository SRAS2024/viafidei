import { z } from "zod";
import { constantTimeEquals } from "./crypto";
import { getSession } from "./session";
import { prisma } from "./db";

export const adminLoginSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(256),
});

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  const userOk = constantTimeEquals(username, expectedUser);
  const passOk = constantTimeEquals(password, expectedPass);
  return userOk && passOk;
}

export async function requireAdmin() {
  const session = await getSession();
  if (session.role !== "ADMIN" || !session.adminSignedInAt) return null;
  return {
    username: session.userEmail ?? process.env.ADMIN_USERNAME ?? "admin",
    signedInAt: session.adminSignedInAt,
  };
}

export async function writeAudit(params: {
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  actorUsername?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        previousValue: params.previousValue as never,
        newValue: params.newValue as never,
        actorUsername: params.actorUsername ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        requestId: params.requestId ?? null,
      },
    });
  } catch {
    // logging best-effort
  }
}
