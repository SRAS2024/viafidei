import { logger } from "../observability/logger";

/**
 * Centralised reporting hooks for the two-tier security model:
 *
 *   * Suspicious Activity — warning signs. The admin password failed
 *     more than three times in a row, sustained client tamper probing,
 *     unusual admin-route scanning, etc. Sends a Suspicious Activity
 *     email and writes a SecurityEvent row classified as "Suspicious".
 *     Never includes a ban link.
 *
 *   * Security Breach — active or attempted attack. SQL injection
 *     payloads, brute-force runs, attempts to insert content outside
 *     the content factory, attempts to set publicRenderReady without
 *     strict QA. Sends a Security Breach email (with a signed ban link
 *     when a device credential is available) and writes a SecurityEvent
 *     row classified as "Breach".
 *
 * Both paths:
 *   1. Always log first (logging never throws).
 *   2. Dedup within a short window so a single misbehaving client
 *      cannot flood the admin mailbox.
 *   3. Write the SecurityEvent row and update its flags after the
 *      email + ban-token side effects settle.
 *   4. Dynamic-import the email + db modules so this file stays
 *      edge-safe and can be invoked from middleware.
 */

export type SecurityEventInput = {
  /** Short machine-readable kind (e.g. "client_tamper", "admin_unauth_attempt"). */
  kind: string;
  /** Human-readable summary mailed to the admin. */
  summary: string;
  ipAddress?: string;
  userAgent?: string;
  route?: string;
  /** Raw device credential cookie — fingerprinted before persistence. */
  deviceCredential?: string;
  city?: string;
  region?: string;
  country?: string;
  attemptedAccountOrRoute?: string;
  recommendedAction?: string;
  httpMethod?: string;
  attemptedAction?: string;
  accountId?: string;
  adminAccount?: boolean;
  requestId?: string;
  detail?: Record<string, string>;
};

let recentDedup = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

function dedupKey(ev: SecurityEventInput, classification: string): string {
  // Dedup by classification + kind + ip + route over a 5-minute window
  // so a single misbehaving client doesn't flood the admin mailbox
  // during sustained probing. Suspicious and Breach events for the
  // same kind get separate dedup keys so a Suspicious -> Breach
  // escalation still gets through.
  return `${classification}|${ev.kind}|${ev.ipAddress ?? ""}|${ev.route ?? ""}`;
}

function shouldDedup(ev: SecurityEventInput, classification: string): boolean {
  const key = dedupKey(ev, classification);
  const last = recentDedup.get(key);
  const now = Date.now();
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  recentDedup.set(key, now);
  // Periodically rotate the dedup map so it can't grow unbounded.
  if (recentDedup.size > 1000) {
    const cutoff = now - DEDUP_WINDOW_MS;
    const next = new Map<string, number>();
    for (const [k, t] of recentDedup.entries()) {
      if (t >= cutoff) next.set(k, t);
    }
    recentDedup = next;
  }
  return false;
}

/** For tests — wipe the in-memory dedup window. */
export function _resetSecurityEventDedupForTests(): void {
  recentDedup = new Map();
}

/**
 * Report a Suspicious Activity event. Use this for *warning signs* —
 * never for confirmed attacks. The admin gets an email that
 * explicitly says no device has been banned and that this is a
 * warning, not a breach.
 */
export async function reportSuspiciousActivity(ev: SecurityEventInput): Promise<void> {
  logger.warn("security.suspicious_activity", {
    kind: ev.kind,
    summary: ev.summary,
    route: ev.route,
    ipAddress: ev.ipAddress,
    userAgent: ev.userAgent,
    detail: ev.detail,
  });
  if (shouldDedup(ev, "Suspicious")) return;
  try {
    const [{ recordSecurityEvent, updateSecurityEventFlags }, { recordError }, { sendSuspiciousActivityAlert }] =
      await Promise.all([
        import("./security-event-store"),
        import("../data/error-log"),
        import("../email"),
      ]);
    const row = await recordSecurityEvent({
      eventType: ev.kind,
      classification: "Suspicious",
      severity: "warning",
      ipAddress: ev.ipAddress ?? null,
      userAgent: ev.userAgent ?? null,
      deviceCredential: ev.deviceCredential ?? null,
      city: ev.city ?? null,
      region: ev.region ?? null,
      country: ev.country ?? null,
      targetRoute: ev.route ?? null,
      httpMethod: ev.httpMethod ?? null,
      attemptedAction: ev.attemptedAction ?? null,
      accountId: ev.accountId ?? null,
      adminAccount: ev.adminAccount ?? false,
      requestId: ev.requestId ?? null,
    });
    await recordError({
      source: "security",
      kind: ev.kind,
      message: ev.summary,
      route: ev.route,
      severity: "warn",
      context: {
        classification: "Suspicious",
        ipAddress: ev.ipAddress,
        userAgent: ev.userAgent,
        ...ev.detail,
      },
    }).catch(() => undefined);
    const sendResult = await sendSuspiciousActivityAlert({
      kind: ev.kind,
      summary: ev.summary,
      ipAddress: ev.ipAddress,
      userAgent: ev.userAgent,
      route: ev.route,
      city: ev.city,
      region: ev.region,
      country: ev.country,
      attemptedAccountOrRoute: ev.attemptedAccountOrRoute,
      recommendedAction: ev.recommendedAction,
      detail: ev.detail,
    }).catch(() => null);
    if (sendResult && sendResult.ok && sendResult.delivery === "sent") {
      await updateSecurityEventFlags(row.id, { emailSent: true }).catch(() => undefined);
    }
  } catch {
    // Best-effort — never throw from the security sink.
  }
}

/**
 * Report a Security Breach event. Use this for *active or attempted
 * attacks* — script injection, brute force, attempts to bypass the
 * content factory, unauthorized admin mutations. The admin email
 * includes a single-use, signed ban link when a device credential
 * is available.
 */
export async function reportSecurityBreach(ev: SecurityEventInput): Promise<void> {
  logger.warn("security.breach", {
    kind: ev.kind,
    summary: ev.summary,
    route: ev.route,
    ipAddress: ev.ipAddress,
    userAgent: ev.userAgent,
    detail: ev.detail,
  });
  if (shouldDedup(ev, "Breach")) return;
  try {
    const [{ recordSecurityEvent, updateSecurityEventFlags }, { recordError }, { sendSecurityBreachAlert }, banTokenModule] =
      await Promise.all([
        import("./security-event-store"),
        import("../data/error-log"),
        import("../email"),
        import("./ban-token"),
      ]);
    const row = await recordSecurityEvent({
      eventType: ev.kind,
      classification: "Breach",
      severity: "error",
      ipAddress: ev.ipAddress ?? null,
      userAgent: ev.userAgent ?? null,
      deviceCredential: ev.deviceCredential ?? null,
      city: ev.city ?? null,
      region: ev.region ?? null,
      country: ev.country ?? null,
      targetRoute: ev.route ?? null,
      httpMethod: ev.httpMethod ?? null,
      attemptedAction: ev.attemptedAction ?? null,
      accountId: ev.accountId ?? null,
      adminAccount: ev.adminAccount ?? false,
      requestId: ev.requestId ?? null,
    });
    await recordError({
      source: "security",
      kind: ev.kind,
      message: ev.summary,
      route: ev.route,
      severity: "error",
      context: {
        classification: "Breach",
        ipAddress: ev.ipAddress,
        userAgent: ev.userAgent,
        ...ev.detail,
      },
    }).catch(() => undefined);
    // Mint a signed ban link only when we have a device credential.
    let banDeviceUrl: string | undefined;
    if (ev.deviceCredential) {
      try {
        banDeviceUrl = banTokenModule.buildSignedBanUrl({
          securityEventId: row.id,
          deviceCredential: ev.deviceCredential,
        });
        await updateSecurityEventFlags(row.id, { banTokenIssued: true }).catch(() => undefined);
      } catch {
        // Fall through with no ban link.
      }
    }
    const sendResult = await sendSecurityBreachAlert({
      kind: ev.kind,
      summary: ev.summary,
      ipAddress: ev.ipAddress,
      userAgent: ev.userAgent,
      route: ev.route,
      banDeviceUrl,
      detail: ev.detail,
    }).catch(() => null);
    if (sendResult && sendResult.ok && sendResult.delivery === "sent") {
      await updateSecurityEventFlags(row.id, { emailSent: true }).catch(() => undefined);
    }
  } catch {
    // Best-effort — never throw from the security sink.
  }
}

/**
 * Backwards-compatible alias for callers that still use the generic
 * `reportSecurityEvent` name. Defaults to Breach (matches the
 * previous behavior, which only had one tier). New callers should
 * pick `reportSuspiciousActivity` or `reportSecurityBreach`
 * explicitly.
 */
export async function reportSecurityEvent(ev: SecurityEventInput): Promise<void> {
  return reportSecurityBreach(ev);
}
