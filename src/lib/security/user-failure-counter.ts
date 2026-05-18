/**
 * In-memory consecutive-user-login-failure counter, keyed by email
 * + IP + device credential. Mirrors the admin counter but with
 * a higher threshold because legitimate users mistype passwords
 * more often than admins.
 *
 *   * Less than `SUSPICIOUS_THRESHOLD` failures within the window:
 *     benign (no email).
 *   * More than `SUSTAINED_THRESHOLD` failures: Suspicious Activity
 *     (heads-up to admin that a user account may be under attack).
 *   * More than `BREACH_THRESHOLD` failures: Security Breach
 *     (active brute-force pattern against an account).
 *
 * Counters reset on a successful user login. The window is 15 min.
 *
 * Spec requirement: "Security Breach should trigger if someone
 * attempts brute force attacks against an account."
 */

import { ipFingerprint, deviceCredentialFingerprint } from "./hash";

const WINDOW_MS = 15 * 60 * 1000;
const SUSTAINED_THRESHOLD = 5; // > 5 consecutive failures = Suspicious
const BREACH_THRESHOLD = 20; // > 20 consecutive failures = Breach (brute force)

type CounterEntry = { count: number; firstFailAt: number; lastFailAt: number };

const counters = new Map<string, CounterEntry>();

function counterKey(args: {
  email: string | null | undefined;
  ipAddress: string | null | undefined;
  deviceCredential: string | null | undefined;
}): string {
  const ip = ipFingerprint(args.ipAddress) ?? "no-ip";
  const dev = deviceCredentialFingerprint(args.deviceCredential) ?? "no-dev";
  const email = args.email?.trim().toLowerCase() ?? "no-email";
  return `${email}|${ip}|${dev}`;
}

export type UserFailureClassification = "below_threshold" | "suspicious" | "breach";

export type RecordUserFailureResult = {
  classification: UserFailureClassification;
  count: number;
  windowMs: number;
};

export function recordUserPasswordFailure(args: {
  email?: string | null;
  ipAddress?: string | null;
  deviceCredential?: string | null;
  now?: number;
}): RecordUserFailureResult {
  const now = args.now ?? Date.now();
  const key = counterKey({
    email: args.email ?? null,
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
  if (entry.count > SUSTAINED_THRESHOLD) {
    return { classification: "suspicious", count: entry.count, windowMs: WINDOW_MS };
  }
  return { classification: "below_threshold", count: entry.count, windowMs: WINDOW_MS };
}

export function resetUserPasswordFailureCounter(args: {
  email?: string | null;
  ipAddress?: string | null;
  deviceCredential?: string | null;
}): void {
  const key = counterKey({
    email: args.email ?? null,
    ipAddress: args.ipAddress ?? null,
    deviceCredential: args.deviceCredential ?? null,
  });
  counters.delete(key);
}

export function _resetAllUserFailureCountersForTests(): void {
  counters.clear();
}

export const SUSPICIOUS_USER_FAILURE_THRESHOLD = SUSTAINED_THRESHOLD;
export const BREACH_USER_FAILURE_THRESHOLD = BREACH_THRESHOLD;
