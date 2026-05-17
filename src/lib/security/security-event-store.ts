/**
 * Durable SecurityEvent + BannedDevice store. Two-tier security
 * audit trail backing the Suspicious Activity / Security Breach
 * email split and the banned-device middleware enforcement.
 *
 * The store deliberately writes only HMAC fingerprints (IP, device
 * credential, user agent) — raw values never land in the database.
 * Geo / route / user-agent text fields are kept in plaintext for
 * the admin UI, but the comparison keys are fingerprints.
 */

import { prisma } from "../db/client";
import {
  deviceCredentialFingerprint,
  ipFingerprint,
  userAgentFingerprint,
} from "./hash";

export type SecurityEventClassification = "Suspicious" | "Breach";

export type SecurityEventSeverity = "info" | "warning" | "error" | "critical";

export type RecordSecurityEventInput = {
  eventType: string;
  classification: SecurityEventClassification;
  severity: SecurityEventSeverity;
  ipAddress?: string | null;
  deviceCredential?: string | null;
  userAgent?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  targetRoute?: string | null;
  httpMethod?: string | null;
  attemptedAction?: string | null;
  accountId?: string | null;
  adminAccount?: boolean;
  requestId?: string | null;
  automaticActionTaken?: string | null;
  emailSent?: boolean;
  banTokenIssued?: boolean;
};

export type SecurityEventRow = {
  id: string;
  eventType: string;
  classification: SecurityEventClassification;
  severity: SecurityEventSeverity;
  ipAddressHash: string | null;
  deviceCredentialHash: string | null;
  userAgentHash: string | null;
  userAgent: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  targetRoute: string | null;
  httpMethod: string | null;
  attemptedAction: string | null;
  accountId: string | null;
  adminAccount: boolean;
  requestId: string | null;
  automaticActionTaken: string | null;
  emailSent: boolean;
  banTokenIssued: boolean;
  createdAt: Date;
};

/** Strict allow-list of classifications. Guard against typos. */
export function isClassification(value: string): value is SecurityEventClassification {
  return value === "Suspicious" || value === "Breach";
}

/**
 * Insert a SecurityEvent row. Caller passes raw IP / device
 * credential / user agent — this helper fingerprints them before
 * writing. Returns the inserted row so the caller can wire up
 * downstream actions (email send, ban token issuance).
 */
export async function recordSecurityEvent(
  input: RecordSecurityEventInput,
): Promise<SecurityEventRow> {
  const row = await prisma.securityEvent.create({
    data: {
      eventType: input.eventType,
      classification: input.classification,
      severity: input.severity,
      ipAddressHash: ipFingerprint(input.ipAddress),
      deviceCredentialHash: deviceCredentialFingerprint(input.deviceCredential),
      userAgentHash: userAgentFingerprint(input.userAgent),
      userAgent: input.userAgent ?? null,
      city: input.city ?? null,
      region: input.region ?? null,
      country: input.country ?? null,
      targetRoute: input.targetRoute ?? null,
      httpMethod: input.httpMethod ?? null,
      attemptedAction: input.attemptedAction ?? null,
      accountId: input.accountId ?? null,
      adminAccount: input.adminAccount ?? false,
      requestId: input.requestId ?? null,
      automaticActionTaken: input.automaticActionTaken ?? null,
      emailSent: input.emailSent ?? false,
      banTokenIssued: input.banTokenIssued ?? false,
    },
  });
  return row as SecurityEventRow;
}

/**
 * Mark a SecurityEvent as having had its email delivered / ban
 * token issued. Used by the emitter once the side effect lands.
 */
export async function updateSecurityEventFlags(
  id: string,
  flags: { emailSent?: boolean; banTokenIssued?: boolean; automaticActionTaken?: string | null },
): Promise<void> {
  await prisma.securityEvent.update({
    where: { id },
    data: {
      ...(flags.emailSent !== undefined ? { emailSent: flags.emailSent } : {}),
      ...(flags.banTokenIssued !== undefined ? { banTokenIssued: flags.banTokenIssued } : {}),
      ...(flags.automaticActionTaken !== undefined
        ? { automaticActionTaken: flags.automaticActionTaken }
        : {}),
    },
  });
}

/**
 * List recent events for the admin security dashboard.
 */
export async function listRecentSecurityEvents(
  limit = 50,
): Promise<SecurityEventRow[]> {
  const rows = await prisma.securityEvent.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
  });
  return rows as SecurityEventRow[];
}

// ─── BannedDevice ────────────────────────────────────────────────────

export type BanDeviceInput = {
  /** Raw device credential — will be fingerprinted before writing. */
  deviceCredential: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  banReason: string;
  securityEventId?: string | null;
  /** "signed_ban_link" when an admin clicked the ban link; "system" otherwise. */
  createdBy: string;
};

export type BannedDeviceRow = {
  id: string;
  deviceCredentialHash: string;
  ipAddressHash: string | null;
  userAgentHash: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  banReason: string;
  securityEventId: string | null;
  createdBy: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Idempotently ban a device. If a row already exists for the same
 * device fingerprint, we update `lastSeenAt` and keep it active.
 * Returns the resulting row.
 */
export async function banDevice(input: BanDeviceInput): Promise<BannedDeviceRow> {
  const deviceHash = deviceCredentialFingerprint(input.deviceCredential);
  if (!deviceHash) {
    throw new Error("banDevice: empty device credential cannot be fingerprinted");
  }
  const now = new Date();
  const existing = await prisma.bannedDevice.findUnique({
    where: { deviceCredentialHash: deviceHash },
  });
  if (existing) {
    const row = await prisma.bannedDevice.update({
      where: { id: existing.id },
      data: { lastSeenAt: now, active: true },
    });
    return row as BannedDeviceRow;
  }
  const row = await prisma.bannedDevice.create({
    data: {
      deviceCredentialHash: deviceHash,
      ipAddressHash: ipFingerprint(input.ipAddress),
      userAgentHash: userAgentFingerprint(input.userAgent),
      firstSeenAt: now,
      lastSeenAt: now,
      banReason: input.banReason,
      securityEventId: input.securityEventId ?? null,
      createdBy: input.createdBy,
      active: true,
    },
  });
  return row as BannedDeviceRow;
}

/**
 * Test whether a request's device credential matches an active ban.
 * Middleware calls this on every request before page rendering.
 *
 * The "no admin unban" rule is enforced at the API layer — this
 * function has no write side and no "unban" peer. Re-activation
 * would require a database-level INSERT, which the admin app does
 * not expose.
 */
export async function isDeviceBanned(deviceCredential: string | null | undefined): Promise<boolean> {
  const hash = deviceCredentialFingerprint(deviceCredential);
  if (!hash) return false;
  const row = await prisma.bannedDevice.findUnique({
    where: { deviceCredentialHash: hash },
    select: { active: true },
  });
  return Boolean(row?.active);
}

/**
 * Touch the lastSeenAt on a banned device so the admin page can
 * show "still attempting access" without changing the ban state.
 */
export async function recordBannedDeviceHit(deviceCredential: string): Promise<void> {
  const hash = deviceCredentialFingerprint(deviceCredential);
  if (!hash) return;
  await prisma.bannedDevice
    .updateMany({
      where: { deviceCredentialHash: hash, active: true },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => undefined);
}

export async function listBannedDevices(limit = 100): Promise<BannedDeviceRow[]> {
  const rows = await prisma.bannedDevice.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
  });
  return rows as BannedDeviceRow[];
}
