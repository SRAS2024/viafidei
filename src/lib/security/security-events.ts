import { logger } from "../observability/logger";

/**
 * Centralised reporting hook for security events. We use this both
 * from server-side detectors (rate-limit blowouts on admin endpoints,
 * failed auth bursts, malformed-admin-request probes) and from the
 * client-side tamper-detection ping (browser-inspector / devtools
 * abuse, attempted client-side state mutation).
 *
 * Each event:
 *   1. Writes a row to ErrorLog with severity = "error" so it shows up
 *      in the next monthly Error Report PDF.
 *   2. Fires a Security Breach admin email — the requirement is that
 *      these are surfaced to the operator immediately, not aggregated.
 *
 * Both writes are dynamic-imported so this module stays edge-safe and
 * can be invoked from middleware without dragging the Prisma client
 * into the edge bundle.
 */
export type SecurityEventInput = {
  /** Short machine-readable kind (e.g. "client_tamper", "admin_unauth_attempt"). */
  kind: string;
  /** Human-readable summary mailed to the admin. */
  summary: string;
  ipAddress?: string;
  userAgent?: string;
  route?: string;
  detail?: Record<string, string>;
};

let recentDedup = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

function dedupKey(ev: SecurityEventInput): string {
  // We coarsely dedup by kind + ip + route over a 5-minute window so a
  // single misbehaving client doesn't flood the admin mailbox during
  // sustained probing.
  return `${ev.kind}|${ev.ipAddress ?? ""}|${ev.route ?? ""}`;
}

function shouldDedup(ev: SecurityEventInput): boolean {
  const key = dedupKey(ev);
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

export async function reportSecurityEvent(ev: SecurityEventInput): Promise<void> {
  // Always log the event first; logging never throws.
  logger.warn("security.event", {
    kind: ev.kind,
    summary: ev.summary,
    route: ev.route,
    ipAddress: ev.ipAddress,
    userAgent: ev.userAgent,
    detail: ev.detail,
  });
  if (shouldDedup(ev)) return;
  try {
    const [{ recordError }, { reportSecurityBreach }] = await Promise.all([
      import("../data/error-log"),
      import("../data/admin-notifications"),
    ]);
    await recordError({
      source: "security",
      kind: ev.kind,
      message: ev.summary,
      route: ev.route,
      severity: "error",
      context: {
        ipAddress: ev.ipAddress,
        userAgent: ev.userAgent,
        ...ev.detail,
      },
    });
    await reportSecurityBreach({
      kind: ev.kind,
      summary: ev.summary,
      ipAddress: ev.ipAddress,
      userAgent: ev.userAgent,
      route: ev.route,
      detail: ev.detail,
    });
  } catch {
    // Best-effort — never throw from the security sink.
  }
}
