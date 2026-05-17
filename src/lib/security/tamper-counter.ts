/**
 * In-memory tamper-probe counter. The spec requires:
 *
 *   * Simply opening devtools should NOT trigger any alert.
 *   * SUSTAINED dev-tool probing (repeated client tamper events,
 *     protected-route inspection, debug-endpoint probing, unusual
 *     admin-route scanning) WITHIN A SHORT WINDOW should escalate
 *     to a Suspicious Activity event.
 *
 * The counter is keyed by IP + device credential and tracks how
 * many tamper-class events have been observed within the window.
 * After more than three events, the next event is classified as
 * "suspicious". A single isolated event is "benign".
 *
 * Counters live in process memory because tamper bursts are rare
 * and we trade durability for zero-cost reads. A restart resets the
 * window, which is fine — an attacker who pauses long enough for a
 * restart is already at a lower attack rate.
 */

import { ipFingerprint, deviceCredentialFingerprint } from "./hash";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const SUSTAINED_THRESHOLD = 3; // > 3 events within the window = suspicious

type CounterEntry = { count: number; firstSeenAt: number; lastSeenAt: number };

const counters = new Map<string, CounterEntry>();

function counterKey(args: {
  ipAddress: string | null | undefined;
  deviceCredential: string | null | undefined;
}): string {
  const ip = ipFingerprint(args.ipAddress) ?? "no-ip";
  const dev = deviceCredentialFingerprint(args.deviceCredential) ?? "no-dev";
  return `${ip}|${dev}`;
}

export type TamperClassification = "benign" | "suspicious";

export type RecordTamperResult = {
  classification: TamperClassification;
  count: number;
  windowMs: number;
};

export function recordTamperEvent(args: {
  ipAddress?: string | null;
  deviceCredential?: string | null;
  now?: number;
}): RecordTamperResult {
  const now = args.now ?? Date.now();
  const key = counterKey({
    ipAddress: args.ipAddress ?? null,
    deviceCredential: args.deviceCredential ?? null,
  });
  const entry = counters.get(key);
  if (!entry || now - entry.lastSeenAt > WINDOW_MS) {
    counters.set(key, { count: 1, firstSeenAt: now, lastSeenAt: now });
    return { classification: "benign", count: 1, windowMs: WINDOW_MS };
  }
  entry.count += 1;
  entry.lastSeenAt = now;
  counters.set(key, entry);
  if (entry.count > SUSTAINED_THRESHOLD) {
    return { classification: "suspicious", count: entry.count, windowMs: WINDOW_MS };
  }
  return { classification: "benign", count: entry.count, windowMs: WINDOW_MS };
}

export function _resetTamperCountersForTests(): void {
  counters.clear();
}

export function _readTamperCounterForTests(args: {
  ipAddress?: string | null;
  deviceCredential?: string | null;
}): number {
  const key = counterKey({
    ipAddress: args.ipAddress ?? null,
    deviceCredential: args.deviceCredential ?? null,
  });
  return counters.get(key)?.count ?? 0;
}

export const SUSTAINED_TAMPER_THRESHOLD = SUSTAINED_THRESHOLD;
export const TAMPER_WINDOW_MS = WINDOW_MS;
