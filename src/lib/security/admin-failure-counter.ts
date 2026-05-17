/**
 * In-memory consecutive-admin-password-failure counter, keyed by
 * account + IP + device credential. Used to fire a Suspicious
 * Activity email after MORE THAN three consecutive failures (i.e.
 * the 4th failure in a row), and to escalate to a Security Breach
 * after a much higher burst (default 15 within the window) — at
 * which point we treat it as a brute-force attempt.
 *
 * Counters reset on a successful admin login, which is the only
 * happy-path signal.
 *
 * The counter lives in the process memory rather than the DB
 * because admin password failures are extremely rare under normal
 * operation; we trade durability for zero-cost reads. A restart
 * resets the window, which is fine — an attacker who pauses long
 * enough for a restart is already at a lower attack rate.
 */

import { ipFingerprint, deviceCredentialFingerprint } from "./hash";

const WINDOW_MS = 15 * 60 * 1000;
const SUSPICIOUS_THRESHOLD = 3; // > 3 consecutive failures triggers Suspicious
const BREACH_THRESHOLD = 15; // > 15 consecutive failures triggers Breach

type CounterEntry = { count: number; firstFailAt: number; lastFailAt: number };

const counters = new Map<string, CounterEntry>();

function counterKey(args: {
  account: string | null | undefined;
  ipAddress: string | null | undefined;
  deviceCredential: string | null | undefined;
}): string {
  // Hash everything so the in-memory key doesn't leak raw IPs.
  const ip = ipFingerprint(args.ipAddress) ?? "no-ip";
  const dev = deviceCredentialFingerprint(args.deviceCredential) ?? "no-dev";
  const account = args.account?.trim().toLowerCase() ?? "no-account";
  return `${account}|${ip}|${dev}`;
}

export type FailureClassification = "below_threshold" | "suspicious" | "breach";

export type RecordFailureResult = {
  classification: FailureClassification;
  count: number;
  windowMs: number;
};

export function recordAdminPasswordFailure(args: {
  account?: string | null;
  ipAddress?: string | null;
  deviceCredential?: string | null;
  now?: number;
}): RecordFailureResult {
  const now = args.now ?? Date.now();
  const key = counterKey({
    account: args.account ?? null,
    ipAddress: args.ipAddress ?? null,
    deviceCredential: args.deviceCredential ?? null,
  });
  const entry = counters.get(key);
  if (!entry || now - entry.lastFailAt > WINDOW_MS) {
    counters.set(key, { count: 1, firstFailAt: now, lastFailAt: now });
    return { classification: "below_threshold", count: 1, windowMs: WINDOW_MS };
  }
  entry.count += 1;
  entry.lastFailAt = now;
  counters.set(key, entry);
  if (entry.count > BREACH_THRESHOLD) {
    return { classification: "breach", count: entry.count, windowMs: WINDOW_MS };
  }
  if (entry.count > SUSPICIOUS_THRESHOLD) {
    return { classification: "suspicious", count: entry.count, windowMs: WINDOW_MS };
  }
  return { classification: "below_threshold", count: entry.count, windowMs: WINDOW_MS };
}

/** Reset the counter after a valid admin login. */
export function resetAdminPasswordFailureCounter(args: {
  account?: string | null;
  ipAddress?: string | null;
  deviceCredential?: string | null;
}): void {
  const key = counterKey({
    account: args.account ?? null,
    ipAddress: args.ipAddress ?? null,
    deviceCredential: args.deviceCredential ?? null,
  });
  counters.delete(key);
}

/** Test helper — wipe every counter. */
export function _resetAllAdminFailureCountersForTests(): void {
  counters.clear();
}

/**
 * Test helper — read the current counter value. Returns 0 for
 * unknown keys.
 */
export function _readAdminFailureCounterForTests(args: {
  account?: string | null;
  ipAddress?: string | null;
  deviceCredential?: string | null;
}): number {
  const key = counterKey({
    account: args.account ?? null,
    ipAddress: args.ipAddress ?? null,
    deviceCredential: args.deviceCredential ?? null,
  });
  return counters.get(key)?.count ?? 0;
}

export const SUSPICIOUS_FAILURE_THRESHOLD = SUSPICIOUS_THRESHOLD;
export const BREACH_FAILURE_THRESHOLD = BREACH_THRESHOLD;
