/**
 * Admin login event recording.
 *
 * Centralises the side effects of an admin sign-in attempt so the
 * login route stays small and every side effect is best-effort —
 * a failed audit write or email must never block or break the login.
 *
 * A *successful* sign-in produces:
 *   • a SecurityEvent of type `admin_login_success` (benign audit —
 *     classification "Audit", so it never inflates the Suspicious /
 *     Breach counters and never triggers a security email);
 *   • an AdminActionLog row of type `admin_login_success`;
 *   • an "Admin Log In" email — distinct from any security alert.
 *
 * A *failed* sign-in produces a SecurityEvent of type
 * `admin_login_failed`. The failed-login threshold escalation
 * (Suspicious Activity email after three in a row) is driven by the
 * login route via the failure counter.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { sendAdminLoginAlert } from "../email";
import { ADMIN_ACTION, hasKnownAdminDevice, writeAdminActionLog } from "../audit/admin-action-log";
import { describeDevice } from "./device-info";
import { SECURITY_EVENT } from "./event-types";
import { deviceCredentialFingerprint, ipFingerprint, userAgentFingerprint } from "./hash";

export type AdminLoginContext = {
  username: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceCredential?: string | null;
  route?: string | null;
};

/**
 * Write a benign-audit SecurityEvent for an admin login attempt.
 * Uses classification "Audit" — a valid login is expected activity, so
 * it must never be counted as Suspicious or Breach and never triggers
 * a security email. Best-effort; returns the new row id or null.
 */
async function writeLoginSecurityEvent(input: {
  eventType: string;
  severity: string;
  ctx: AdminLoginContext;
  attemptedAction: string;
}): Promise<string | null> {
  try {
    const row = await prisma.securityEvent.create({
      data: {
        eventType: input.eventType,
        classification: "Audit",
        severity: input.severity,
        ipAddressHash: ipFingerprint(input.ctx.ipAddress),
        deviceCredentialHash: deviceCredentialFingerprint(input.ctx.deviceCredential),
        userAgentHash: userAgentFingerprint(input.ctx.userAgent),
        userAgent: input.ctx.userAgent ?? null,
        targetRoute: input.ctx.route ?? "/api/admin/login",
        httpMethod: "POST",
        attemptedAction: input.attemptedAction,
        adminAccount: true,
        emailSent: false,
        banTokenIssued: false,
      },
    });
    return row?.id ?? null;
  } catch (error) {
    logger.warn("admin.login_event.security_event_failed", {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Record a successful admin sign-in: SecurityEvent + AdminActionLog +
 * the Admin Log In email. Best-effort throughout — never throws.
 */
export async function recordAdminLoginSuccess(ctx: AdminLoginContext): Promise<void> {
  try {
    const device = describeDevice(ctx.userAgent);
    // Resolve "seen before" BEFORE writing this login's action row so
    // the answer reflects prior sign-ins, not this one.
    let deviceSeenBefore = false;
    try {
      deviceSeenBefore = await hasKnownAdminDevice(ctx.deviceCredential);
    } catch {
      deviceSeenBefore = false;
    }

    const securityEventId = await writeLoginSecurityEvent({
      eventType: SECURITY_EVENT.adminLoginSuccess,
      severity: "info",
      ctx,
      attemptedAction: "admin_login_success",
    });

    const actionLogId = await writeAdminActionLog({
      adminUsername: ctx.username,
      actionType: ADMIN_ACTION.loginSuccess,
      route: ctx.route ?? "/api/admin/login",
      method: "POST",
      result: "success",
      deviceCredential: ctx.deviceCredential,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        browser: device.browser ?? "unknown",
        operatingSystem: device.operatingSystem ?? "unknown",
        deviceSeenBefore,
      },
    });

    await sendAdminLoginAlert({
      username: ctx.username,
      ipAddress: ctx.ipAddress ?? undefined,
      userAgent: ctx.userAgent ?? undefined,
      browser: device.browser ?? undefined,
      operatingSystem: device.operatingSystem ?? undefined,
      deviceSeenBefore,
      successful: true,
      referenceId: securityEventId ?? actionLogId ?? undefined,
    }).catch((error) => {
      logger.warn("admin.login_event.email_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    });
  } catch (error) {
    logger.warn("admin.login_event.success_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Record a single failed admin sign-in as a benign-audit SecurityEvent
 * of type `admin_login_failed`. The threshold escalation to a
 * Suspicious Activity email is handled separately by the login route.
 */
export async function recordAdminLoginFailure(ctx: AdminLoginContext): Promise<string | null> {
  return writeLoginSecurityEvent({
    eventType: SECURITY_EVENT.adminLoginFailed,
    severity: "warning",
    ctx,
    attemptedAction: "admin_login_failed",
  });
}
