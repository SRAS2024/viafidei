/**
 * Request-path security defender (spec §21).
 *
 * Wraps the lower-level `defend()` for use from admin request
 * handlers. Each helper classifies one well-known request-path
 * event and lets `defend()` decide the action (OBSERVE / WARN /
 * BAN_DEVICE / ESCALATE).
 *
 * Important behaviour from spec §21:
 *   - normal redirect-to-login is OBSERVE, not Suspicious
 *   - valid admin session navigation is OBSERVE, not Suspicious
 *   - failed admin login (one) is WARN
 *   - 3+ failed admin logins is Suspicious (triggers email)
 *   - confirmed brute force is BAN_DEVICE
 *   - unauthorized mutation with device fingerprint + high
 *     confidence is BAN_DEVICE
 *   - landing on /admin/login as anonymous is OBSERVE
 *
 * Every helper is fire-and-forget — a security helper that throws
 * must never break a valid request.
 */

import type { PrismaClient } from "@prisma/client";

import { defend, type DefendOutcome } from "./security-defender";

export interface RequestDefenderInput {
  prisma: PrismaClient;
  route?: string | null;
  ipHash?: string | null;
  deviceFingerprintHash?: string | null;
  userAgentHash?: string | null;
  securityEventId?: string | null;
}

/**
 * Anonymous visitor lands on /admin/login or hits a redirect-to-login.
 * Normal, expected, must NOT trigger suspicious-activity emails.
 */
export async function defendRedirectToLogin(
  input: RequestDefenderInput,
): Promise<DefendOutcome | null> {
  return run(input, {
    eventType: "redirect_to_login",
    classification: "Info",
    severity: "info",
    reason: "Unauthenticated request redirected to /admin/login.",
    confidence: 1.0,
  });
}

/**
 * A valid admin session navigated to an admin page. Audit-only —
 * must never trigger a defender action beyond OBSERVE.
 */
export async function defendValidAdminNavigation(
  input: RequestDefenderInput,
): Promise<DefendOutcome | null> {
  return run(input, {
    eventType: "admin_navigation",
    classification: "Info",
    severity: "info",
    reason: "Authenticated admin navigated to a protected route.",
    confidence: 1.0,
  });
}

/**
 * One failed admin login. WARN (not ban) — the threshold-based
 * suspicious-activity email is fired after three consecutive failures.
 */
export async function defendFailedAdminLogin(
  input: RequestDefenderInput & { attemptsInWindow?: number },
): Promise<DefendOutcome | null> {
  const attempts = input.attemptsInWindow ?? 1;
  return run(input, {
    eventType: "admin_failed_login",
    classification: attempts >= 3 ? "Suspicious" : "Suspicious",
    severity: attempts >= 3 ? "warning" : "warning",
    reason:
      attempts >= 3
        ? `${attempts} consecutive admin-password failures from this device.`
        : "Single failed admin login attempt.",
    confidence: attempts >= 3 ? 0.8 : 0.5,
  });
}

/**
 * Confirmed brute force pattern (many failures from one device in a
 * short window). Defender bans the device automatically.
 */
export async function defendConfirmedBruteForce(
  input: RequestDefenderInput & { attemptsInWindow: number },
): Promise<DefendOutcome | null> {
  return run(input, {
    eventType: "admin_brute_force_confirmed",
    classification: "Breach",
    severity: "critical",
    reason: `${input.attemptsInWindow} admin login failures from one device in 60s.`,
    confidence: 0.95,
  });
}

/**
 * Unauthorized mutation attempt — anonymous POST / PUT / DELETE to
 * a protected admin route. Bans with high confidence when a device
 * fingerprint is present.
 */
export async function defendUnauthorizedMutation(
  input: RequestDefenderInput,
): Promise<DefendOutcome | null> {
  return run(input, {
    eventType: "unauthorized_mutation_attempt",
    classification: "Breach",
    severity: input.deviceFingerprintHash ? "critical" : "warning",
    reason: "Anonymous mutation request hit a protected admin route.",
    confidence: input.deviceFingerprintHash ? 0.92 : 0.55,
  });
}

/**
 * Repeated probing of sensitive admin paths from one device.
 */
export async function defendAdminRouteProbing(
  input: RequestDefenderInput & { probedRoutes: number },
): Promise<DefendOutcome | null> {
  return run(input, {
    eventType: "admin_route_probe",
    classification: "Breach",
    severity: "critical",
    reason: `${input.probedRoutes} probes for sensitive admin paths from one device.`,
    confidence: 0.92,
  });
}

/**
 * Banned device tried to come back. Always observe — the ban list
 * is enforced elsewhere; this just records the recurrence.
 */
export async function defendBannedDeviceReuse(
  input: RequestDefenderInput,
): Promise<DefendOutcome | null> {
  return run(input, {
    eventType: "banned_device_reuse",
    classification: "Suspicious",
    severity: "warning",
    reason: "Banned device fingerprint observed on a new request.",
    confidence: 0.7,
  });
}

async function run(
  input: RequestDefenderInput,
  shape: {
    eventType: string;
    classification: "Info" | "Suspicious" | "Breach";
    severity: string;
    reason: string;
    confidence: number;
  },
): Promise<DefendOutcome | null> {
  try {
    return await defend(input.prisma, {
      securityEventId: input.securityEventId ?? undefined,
      eventType: shape.eventType,
      classification: shape.classification as "Suspicious" | "Breach" | "Info",
      severity: shape.severity,
      deviceFingerprintHash: input.deviceFingerprintHash ?? undefined,
      ipHash: input.ipHash ?? undefined,
      userAgentHash: input.userAgentHash ?? undefined,
      route: input.route ?? undefined,
      reason: shape.reason,
      confidence: shape.confidence,
    });
  } catch {
    // Fire-and-forget: a security-defender failure must never break
    // a valid request.
    return null;
  }
}
