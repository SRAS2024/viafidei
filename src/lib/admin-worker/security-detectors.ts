/**
 * Explicit security detectors layered on top of the security
 * defender. Spec section 14 lists 10 categories of threat the
 * defender must detect; this module provides the deterministic
 * checks that turn raw request context into a defender input.
 *
 * Token-free by design (no AI APIs, no fingerprint state outside of
 * the request) so each detector is testable in isolation.
 */

import type { PrismaClient } from "@prisma/client";

import {
  deviceCredentialFingerprint,
  ipFingerprint,
  userAgentFingerprint,
} from "@/lib/security/hash";
import { defend, type DefendInput } from "./security-defender";

export type SecurityDetectorKind =
  | "brute_force_login"
  | "repeated_failed_admin_logins"
  | "successful_brute_force_signs"
  | "unauthorized_admin_route_access"
  | "unauthorized_mutation_attempts"
  | "bypass_admin_authentication"
  | "set_public_flag_outside_worker"
  | "manipulate_internal_content_routes"
  | "suspicious_request_burst"
  | "banned_device_reuse";

/** Severity rating per detector. Tunable in one place. */
export const DETECTOR_SEVERITY: Record<SecurityDetectorKind, string> = {
  brute_force_login: "critical",
  repeated_failed_admin_logins: "warning",
  successful_brute_force_signs: "critical",
  unauthorized_admin_route_access: "warning",
  unauthorized_mutation_attempts: "error",
  bypass_admin_authentication: "critical",
  set_public_flag_outside_worker: "critical",
  manipulate_internal_content_routes: "error",
  suspicious_request_burst: "warning",
  banned_device_reuse: "critical",
};

/** Classification per detector (Suspicious / Breach). */
export const DETECTOR_CLASSIFICATION: Record<SecurityDetectorKind, "Suspicious" | "Breach"> = {
  brute_force_login: "Breach",
  repeated_failed_admin_logins: "Suspicious",
  successful_brute_force_signs: "Breach",
  unauthorized_admin_route_access: "Suspicious",
  unauthorized_mutation_attempts: "Breach",
  bypass_admin_authentication: "Breach",
  set_public_flag_outside_worker: "Breach",
  manipulate_internal_content_routes: "Breach",
  suspicious_request_burst: "Suspicious",
  banned_device_reuse: "Breach",
};

export interface DetectorContext {
  ipAddress?: string;
  deviceCredential?: string;
  userAgent?: string;
  route?: string;
  reason: string;
}

/**
 * Detect that a device flagged as banned re-attempted a request.
 * Returns true when the device is in the BannedDevice table — the
 * caller has already let the request through middleware (which
 * normally blocks bans), so this detector fires when there is an
 * attempt to bypass the ban (eg. via a fresh device credential).
 */
export async function detectBannedDeviceReuse(
  prisma: PrismaClient,
  context: DetectorContext,
): Promise<boolean> {
  if (!context.deviceCredential) return false;
  const hash = deviceCredentialFingerprint(context.deviceCredential);
  if (!hash) return false;
  const banned = await prisma.bannedDevice
    .findUnique({ where: { deviceCredentialHash: hash } })
    .catch(() => null);
  return banned?.active === true;
}

/**
 * Detect an attempt to flip an internal public-render flag from
 * outside the worker. The Admin Worker controls every
 * PublishedContent.isPublished transition; any other writer is a
 * breach.
 */
export function detectSetPublicFlagOutsideWorker(opts: {
  route: string;
  actor: string | null;
  bodyKeys: ReadonlyArray<string>;
}): boolean {
  if (opts.actor === "admin_worker") return false;
  if (opts.bodyKeys.includes("isPublished") || opts.bodyKeys.includes("publicRenderReady")) {
    return true;
  }
  return false;
}

/**
 * Detect a mutation attempt against an internal-only route (eg. the
 * /api/internal/* tree) that did not come from the worker.
 */
export function detectInternalRouteManipulation(opts: {
  route: string;
  method: string;
  actor: string | null;
}): boolean {
  if (!opts.route.startsWith("/api/internal/")) return false;
  if (opts.method === "GET" || opts.method === "HEAD") return false;
  return opts.actor !== "admin_worker";
}

/**
 * Burst detector. The caller supplies the recent request count for
 * a (route, ip) pair; the threshold is deliberately conservative so
 * normal admin navigation does not trigger.
 */
export function detectSuspiciousBurst(opts: {
  route: string;
  recentRequestsInLastMinute: number;
}): boolean {
  // Admin routes: 30 requests / minute is the operator floor.
  if (opts.route.startsWith("/admin") || opts.route.startsWith("/api/admin")) {
    return opts.recentRequestsInLastMinute > 30;
  }
  return opts.recentRequestsInLastMinute > 120;
}

/**
 * High-level helper. Given a detector kind + context, build a
 * DefendInput and call `defend()` so the defender records the action
 * with consistent severity + classification.
 */
export async function fireDetector(
  prisma: PrismaClient,
  kind: SecurityDetectorKind,
  context: DetectorContext,
  opts: { passId?: string; securityEventId?: string; confidence?: number } = {},
) {
  const input: DefendInput = {
    securityEventId: opts.securityEventId,
    passId: opts.passId,
    eventType: kind,
    classification: DETECTOR_CLASSIFICATION[kind],
    severity: DETECTOR_SEVERITY[kind],
    deviceFingerprintHash: deviceCredentialFingerprint(context.deviceCredential) ?? undefined,
    ipHash: ipFingerprint(context.ipAddress) ?? undefined,
    userAgentHash: userAgentFingerprint(context.userAgent) ?? undefined,
    route: context.route,
    reason: context.reason,
    confidence: opts.confidence ?? defaultConfidenceFor(kind),
  };
  return defend(prisma, input);
}

function defaultConfidenceFor(kind: SecurityDetectorKind): number {
  switch (kind) {
    case "brute_force_login":
    case "successful_brute_force_signs":
    case "banned_device_reuse":
      return 0.95;
    case "set_public_flag_outside_worker":
    case "bypass_admin_authentication":
      return 0.9;
    case "unauthorized_mutation_attempts":
    case "manipulate_internal_content_routes":
      return 0.85;
    default:
      return 0.6;
  }
}
