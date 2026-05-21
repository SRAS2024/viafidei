/**
 * Canonical security event types.
 *
 * `SecurityEvent.eventType` is a free-text column, but every value the
 * app writes should come from this table so the Developer Audit report,
 * the admin security page, and the tests all agree on the vocabulary.
 *
 * The types draw a clear line between three kinds of signal:
 *   • benign audit  — a valid admin signed in or acted (no email);
 *   • suspicious     — a warning sign (Suspicious Activity email);
 *   • breach         — an active / attempted attack (Security Breach
 *                      or Brute Force email).
 */
export const SECURITY_EVENT = {
  /** A valid admin signed in successfully — benign audit, no email. */
  adminLoginSuccess: "admin_login_success",
  /** A single failed admin password attempt — benign audit, no email. */
  adminLoginFailed: "admin_login_failed",
  /** Three or more failed attempts in a row — Suspicious Activity email. */
  adminFailedLoginThresholdReached: "admin_failed_login_threshold_reached",
  /** An important action by a valid authenticated admin — no email. */
  authenticatedAdminAction: "authenticated_admin_action",
  /** An admin route reached without a valid admin session. */
  unauthenticatedAdminRouteAccess: "unauthenticated_admin_route_access",
  /** An attempt to perform an admin mutation without authorization. */
  unauthorizedAdminMutation: "unauthorized_admin_mutation",
  /** A warning sign — Suspicious Activity email. */
  suspiciousActivity: "suspicious_activity",
  /** An active or attempted attack — Security Breach email. */
  securityBreach: "security_breach",
} as const;

export type SecurityEventType = (typeof SECURITY_EVENT)[keyof typeof SECURITY_EVENT];
