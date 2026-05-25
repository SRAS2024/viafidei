/**
 * Always-on security defender. Runs even when the Admin Worker is
 * paused.
 *
 * Ban policy (decided during planning): only confirmed brute force
 * results in an automatic ban. Use the existing
 * `recordAdminPasswordFailure` -> `reportSecurityBreach` -> signed-link
 * flow that already lives in `src/lib/security/`. The Admin Worker
 * security defender layers on top: it records what action it took, why,
 * and at what confidence in AdminWorkerSecurityAction so the
 * diagnostics card can show its work.
 *
 * Defender responsibilities (Phase 1):
 *   - Read recent SecurityEvent rows and synthesize a defender action.
 *   - When a 'breach'-classified event has not yet had a defender
 *     action, record one with OBSERVE / BAN_DEVICE / ESCALATE etc.
 *   - Never ban a device that has a valid authenticated admin session;
 *     the AdminActionLog 'admin_login_success' marker protects it.
 */

import type { AdminWorkerSecurityActionType, Prisma, PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";

export const DEFENDER_RULES = {
  /** Severity at which we always observe + log. */
  observeAt: "info",
  /** Severity at which we recommend a ban (brute force). */
  banAt: "critical",
  /** Confidence threshold for autonomous ban (only confirmed brute force). */
  banConfidence: 0.9,
} as const;

export interface DefendInput {
  securityEventId?: string;
  passId?: string;
  eventType: string;
  classification: "Suspicious" | "Breach" | "Info";
  severity: string;
  deviceFingerprintHash?: string;
  ipHash?: string;
  userAgentHash?: string;
  route?: string;
  reason: string;
  /** Caller-supplied confidence the event represents a real threat. */
  confidence: number;
}

export interface DefendOutcome {
  actionType: AdminWorkerSecurityActionType;
  actionTaken: string;
  recordId: string;
}

/**
 * Decide the action type for a security event. The decision is
 * deterministic so the operator can reason about defender behaviour.
 */
export function decideAction(input: DefendInput): {
  actionType: AdminWorkerSecurityActionType;
  actionTaken: string;
} {
  // Suspicious -> observe + warn. Never ban on suspicious alone.
  if (input.classification === "Suspicious") {
    return {
      actionType: "WARN",
      actionTaken: "Recorded suspicious-activity warning; no automatic ban.",
    };
  }
  // Breach with high confidence -> ban device.
  if (
    input.classification === "Breach" &&
    input.confidence >= DEFENDER_RULES.banConfidence &&
    input.deviceFingerprintHash
  ) {
    return {
      actionType: "BAN_DEVICE",
      actionTaken: "Issued automatic device ban for confirmed brute-force pattern.",
    };
  }
  // Breach with lower confidence -> escalate (admin gets email,
  // but no auto-ban without admin clicking signed link).
  if (input.classification === "Breach") {
    return {
      actionType: "ESCALATE",
      actionTaken: "Recorded breach; awaiting admin signed-link ban.",
    };
  }
  return { actionType: "OBSERVE", actionTaken: "Observed event; no action taken." };
}

export async function defend(prisma: PrismaClient, input: DefendInput): Promise<DefendOutcome> {
  const decision = decideAction(input);
  const row = await prisma.adminWorkerSecurityAction.create({
    data: {
      securityEventId: input.securityEventId,
      passId: input.passId,
      actionType: decision.actionType,
      deviceFingerprintHash: input.deviceFingerprintHash,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
      route: input.route,
      reason: input.reason,
      severity: input.severity,
      confidence: input.confidence,
      actionTaken: decision.actionTaken,
    },
    select: { id: true },
  });

  await writeAdminWorkerLog(prisma, {
    passId: input.passId ?? null,
    category: "SECURITY",
    severity: input.classification === "Breach" ? "ERROR" : "WARN",
    eventName: `security_${decision.actionType.toLowerCase()}`,
    message: `${decision.actionTaken} (event=${input.eventType}, route=${input.route ?? "?"})`,
    safeMetadata: {
      classification: input.classification,
      confidence: input.confidence,
    } satisfies Prisma.InputJsonValue,
    relatedEntityId: row.id,
  });

  // BAN_DEVICE: actually insert the BannedDevice row + send the
  // Admin Worker Banned Device email. Middleware reads BannedDevice
  // on every request so the ban is enforced immediately. Wrapped in
  // try / catch so a row insertion failure can never break the loop.
  if (decision.actionType === "BAN_DEVICE" && input.deviceFingerprintHash) {
    await issueBan(prisma, input, row.id);
  }

  return { ...decision, recordId: row.id };
}

async function issueBan(
  prisma: PrismaClient,
  input: DefendInput,
  workerActionId: string,
): Promise<void> {
  const now = new Date();
  try {
    await prisma.bannedDevice.upsert({
      where: { deviceCredentialHash: input.deviceFingerprintHash! },
      update: {
        lastSeenAt: now,
        active: true,
        banReason: input.eventType,
        securityEventId: input.securityEventId ?? null,
      },
      create: {
        deviceCredentialHash: input.deviceFingerprintHash!,
        ipAddressHash: input.ipHash ?? null,
        userAgentHash: input.userAgentHash ?? null,
        firstSeenAt: now,
        lastSeenAt: now,
        banReason: input.eventType,
        securityEventId: input.securityEventId ?? null,
        createdBy: "admin_worker",
        active: true,
      },
    });
  } catch (err) {
    await writeAdminWorkerLog(prisma, {
      passId: input.passId ?? null,
      category: "SECURITY",
      severity: "ERROR",
      eventName: "ban_insert_failed",
      message: `BannedDevice insert failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  // Dynamic import keeps the defender independent of the email module
  // for tests; email failure must never roll back the ban.
  try {
    const { sendAdminWorkerBannedDevice } = await import("@/lib/email/admin-send");
    await sendAdminWorkerBannedDevice({
      reason: input.reason,
      route: input.route,
      deviceCredentialFingerprint: input.deviceFingerprintHash,
      securityEventId: input.securityEventId,
      workerActionId,
      confidence: input.confidence,
    });
  } catch (err) {
    await writeAdminWorkerLog(prisma, {
      passId: input.passId ?? null,
      category: "SECURITY",
      severity: "WARN",
      eventName: "ban_email_failed",
      message: `Banned-device email failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

export async function listRecentSecurityActions(
  prisma: PrismaClient,
  opts: { limit?: number } = {},
) {
  return prisma.adminWorkerSecurityAction.findMany({
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 25,
  });
}
