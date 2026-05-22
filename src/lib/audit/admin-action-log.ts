/**
 * Durable admin action log.
 *
 * Records one row per *important* admin action or sensitive admin page
 * visit. It is distinct from `AdminAuditLog` (which captures
 * content-entity before/after values): this table captures the request
 * itself — who, what route, what method, what result — plus the
 * device / IP / user-agent HMAC fingerprints, so:
 *
 *   • the Developer Audit report can show "Admin Navigation and
 *     Actions" for any selected period, and
 *   • suspicious-activity detection can trust a valid authenticated
 *     admin instead of paging the operator for normal navigation.
 *
 * Two guards keep the table honest:
 *   • only HMAC fingerprints are stored — never a raw IP / device /
 *     user-agent value;
 *   • a short in-memory rate window collapses repeated identical
 *     actions so low-value UI churn cannot spam the log.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { deviceCredentialFingerprint, ipFingerprint, userAgentFingerprint } from "../security/hash";

/** Action types that are always worth a durable row. */
export const ADMIN_ACTION = {
  loginSuccess: "admin_login_success",
  loginFailed: "admin_login_failed",
  logout: "admin_logout",
  diagnosticsRun: "diagnostics_run",
  developerReport: "developer_audit_report",
  reportDownloaded: "report_downloaded",
  contentCleanup: "content_cleanup_triggered",
  ingestionTriggered: "ingestion_triggered",
  queueRepair: "queue_repair_triggered",
  sourceJobRepair: "source_job_repair_triggered",
  sourceQualityReset: "source_quality_reset",
  settingsChanged: "settings_changed",
  contentEdited: "content_edited",
  contentPublished: "content_published",
  contentDeleted: "content_deleted",
  sensitivePageView: "sensitive_page_view",
} as const;

export type AdminActionInput = {
  adminUserId?: string | null;
  adminUsername: string;
  actionType: string;
  route?: string | null;
  method?: string | null;
  /** "success" | "failure" | "skipped" | … */
  result: string;
  /** Raw device credential cookie — fingerprinted before persistence. */
  deviceCredential?: string | null;
  /** Raw client IP — hashed before persistence. */
  ipAddress?: string | null;
  /** Raw user-agent — hashed before persistence. */
  userAgent?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AdminActionLogRecord = {
  id: string;
  adminUserId: string | null;
  adminUsername: string;
  actionType: string;
  route: string | null;
  method: string | null;
  result: string;
  deviceFingerprint: string | null;
  ipHash: string | null;
  userAgentHash: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  createdAt: Date;
  metadataJson: unknown;
};

// In-memory rate window — collapse repeated identical actions so the
// log records meaningful activity, not every small UI click.
const RATE_WINDOW_MS = 60 * 1000;
let recentWrites = new Map<string, number>();

function rateKey(input: AdminActionInput): string {
  return `${input.adminUsername}|${input.actionType}|${input.route ?? ""}|${input.result}`;
}

/** Test helper — clear the in-memory rate window. */
export function _resetAdminActionRateWindowForTests(): void {
  recentWrites = new Map();
}

/**
 * Write an admin action row. Best-effort: a failed write is logged and
 * swallowed so it can never break the request it is attached to.
 * Returns the new row id, or null when the write was rate-limited or
 * failed.
 */
export async function writeAdminActionLog(input: AdminActionInput): Promise<string | null> {
  const now = Date.now();
  const key = rateKey(input);
  const last = recentWrites.get(key);
  if (last && now - last < RATE_WINDOW_MS) {
    return null;
  }
  recentWrites.set(key, now);
  if (recentWrites.size > 500) {
    const cutoff = now - RATE_WINDOW_MS;
    const next = new Map<string, number>();
    for (const [k, t] of recentWrites.entries()) {
      if (t >= cutoff) next.set(k, t);
    }
    recentWrites = next;
  }

  try {
    const row = await prisma.adminActionLog.create({
      data: {
        adminUserId: input.adminUserId ?? null,
        adminUsername: input.adminUsername,
        actionType: input.actionType,
        route: input.route ?? null,
        method: input.method ?? null,
        result: input.result,
        deviceFingerprint: deviceCredentialFingerprint(input.deviceCredential),
        ipHash: ipFingerprint(input.ipAddress),
        userAgentHash: userAgentFingerprint(input.userAgent),
        city: input.city ?? null,
        region: input.region ?? null,
        country: input.country ?? null,
        metadataJson: (input.metadata ?? undefined) as never,
      },
    });
    return row?.id ?? null;
  } catch (error) {
    logger.warn("admin.action_log.write_failed", {
      actionType: input.actionType,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Read every admin action recorded inside the time window. */
export async function readAdminActionLogsInRange(
  startAt: Date,
  endAt: Date,
): Promise<AdminActionLogRecord[]> {
  const rows = await prisma.adminActionLog.findMany({
    where: { createdAt: { gte: startAt, lte: endAt } },
    orderBy: { createdAt: "asc" },
  });
  return rows as AdminActionLogRecord[];
}

/**
 * Has this device been seen on a prior admin action? Used by the
 * Admin Log In email to tell the operator whether the sign-in came
 * from a recognised device.
 */
export async function hasKnownAdminDevice(
  deviceCredential: string | null | undefined,
): Promise<boolean> {
  const fingerprint = deviceCredentialFingerprint(deviceCredential);
  if (!fingerprint) return false;
  try {
    const prior = await prisma.adminActionLog.findFirst({
      where: { deviceFingerprint: fingerprint },
      select: { id: true },
    });
    return Boolean(prior);
  } catch {
    return false;
  }
}

/** Earliest admin action timestamp, or null when none recorded. */
export async function earliestAdminActionAt(): Promise<Date | null> {
  try {
    const row = await prisma.adminActionLog.findFirst({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  } catch {
    return null;
  }
}
