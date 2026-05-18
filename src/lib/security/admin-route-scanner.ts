/**
 * Admin-route scan detector.
 *
 * The spec lists these as Suspicious Activity (not Security Breach) signals:
 *   * protected-route inspection
 *   * debug-endpoint probing
 *   * unusual admin-route scanning
 *
 * This module tracks per-(IP + device-credential) hits on
 * unauthenticated /admin/* and /api/admin/* paths. A single hit
 * (e.g. a typo'd URL) is benign. Sustained scanning — more than
 * `SUSTAINED_THRESHOLD` distinct admin paths within `WINDOW_MS` —
 * escalates to Suspicious Activity.
 *
 * The detector lives in process memory because admin scans are
 * rare and we trade durability for zero-cost reads. A restart
 * resets the window — an attacker who pauses long enough for a
 * restart is already at a lower attack rate.
 *
 * Distinct-path tracking matters: a refresh-hammered single URL
 * is rate-limited but isn't "scanning" — we don't want to alert
 * on it. Only when MANY different admin URLs are probed does it
 * count as a scan signal.
 */

import { ipFingerprint, deviceCredentialFingerprint } from "./hash";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const SUSTAINED_THRESHOLD = 5; // > 5 distinct admin paths within the window = suspicious

type ScannerEntry = {
  paths: Set<string>;
  firstSeenAt: number;
  lastSeenAt: number;
};

const scanners = new Map<string, ScannerEntry>();

function counterKey(args: {
  ipAddress: string | null | undefined;
  deviceCredential: string | null | undefined;
}): string {
  const ip = ipFingerprint(args.ipAddress) ?? "no-ip";
  const dev = deviceCredentialFingerprint(args.deviceCredential) ?? "no-dev";
  return `${ip}|${dev}`;
}

export type ScanClassification = "benign" | "suspicious";

export type RecordScanResult = {
  classification: ScanClassification;
  distinctPaths: number;
  windowMs: number;
};

/**
 * Record an unauthenticated probe of a protected admin path.
 * Returns the classification AFTER this hit lands. Callers are
 * the unified gate (when requireAdmin returns null on /admin/*
 * or /api/admin/* routes) and the global 404 handler when
 * /api/admin/debug, /api/admin/_internal etc. are requested but
 * don't exist.
 */
export function recordAdminScan(args: {
  ipAddress?: string | null;
  deviceCredential?: string | null;
  path: string;
  now?: number;
}): RecordScanResult {
  const now = args.now ?? Date.now();
  const key = counterKey({
    ipAddress: args.ipAddress ?? null,
    deviceCredential: args.deviceCredential ?? null,
  });
  const entry = scanners.get(key);
  if (!entry || now - entry.lastSeenAt > WINDOW_MS) {
    const fresh: ScannerEntry = {
      paths: new Set([args.path]),
      firstSeenAt: now,
      lastSeenAt: now,
    };
    scanners.set(key, fresh);
    return { classification: "benign", distinctPaths: 1, windowMs: WINDOW_MS };
  }
  entry.paths.add(args.path);
  entry.lastSeenAt = now;
  scanners.set(key, entry);
  if (entry.paths.size > SUSTAINED_THRESHOLD) {
    return {
      classification: "suspicious",
      distinctPaths: entry.paths.size,
      windowMs: WINDOW_MS,
    };
  }
  return {
    classification: "benign",
    distinctPaths: entry.paths.size,
    windowMs: WINDOW_MS,
  };
}

/** Test helper — wipe every counter. */
export function _resetAdminScanCountersForTests(): void {
  scanners.clear();
}

export function _readAdminScanCounterForTests(args: {
  ipAddress?: string | null;
  deviceCredential?: string | null;
}): number {
  const key = counterKey({
    ipAddress: args.ipAddress ?? null,
    deviceCredential: args.deviceCredential ?? null,
  });
  return scanners.get(key)?.paths.size ?? 0;
}

export const SUSTAINED_ADMIN_SCAN_THRESHOLD = SUSTAINED_THRESHOLD;
export const ADMIN_SCAN_WINDOW_MS = WINDOW_MS;
