/**
 * `envInt` in the Admin Worker loop — the helper that took the worker down.
 *
 * `Number("")` is 0, NOT NaN, so the original guard
 *
 *     const n = Number((process.env[name] ?? "").trim());
 *     return Number.isFinite(n) && n >= 0 ? n : fallback;
 *
 * accepted an UNSET variable and returned 0 instead of the fallback. None of
 * the three variables it reads is set anywhere in this project, so in
 * production every one of them was 0:
 *
 *   - ADMIN_WORKER_DISPATCH_TIMEOUT_MS  → a 0 ms dispatch watchdog. 46 stage
 *     outcomes in 12 hours recorded "dispatch watchdog: stage exceeded 0ms" —
 *     every dispatched stage killed the instant it started, and (the watchdog
 *     cannot cancel the promise) double-counted in the outcome ledger, which is
 *     what pushed SOURCE_FETCH past the LOOPING escalation threshold.
 *   - ADMIN_WORKER_IDLE_BACKOFF_MS / _MAX_MS → a loop that never rested when
 *     idle, a prime suspect for the ledger growing to ~7 M rows / 21 GB.
 *
 * The seven sibling helpers in this package guard with `n > 0` / `n >= 1` and
 * are unaffected; only the loop's copy used `>= 0`.
 */
import { afterEach, describe, expect, it } from "vitest";

import { DISPATCH_WATCHDOG_MS, dispatchTimeoutMs, envInt } from "@/lib/admin-worker/loop";

const KEY = "VIAFIDEI_TEST_ENVINT";
const TIMEOUT_KEY = "ADMIN_WORKER_DISPATCH_TIMEOUT_MS";

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  delete process.env[KEY];
  delete process.env[TIMEOUT_KEY];
});

describe("envInt", () => {
  it("falls back when the variable is UNSET (the bug: Number('') === 0)", () => {
    delete process.env[KEY];
    expect(envInt(KEY, 600_000)).toBe(600_000);
  });

  it("falls back on an empty string", () => {
    setEnv(KEY, "");
    expect(envInt(KEY, 600_000)).toBe(600_000);
  });

  it("falls back on whitespace only", () => {
    setEnv(KEY, "   ");
    expect(envInt(KEY, 600_000)).toBe(600_000);
  });

  it("falls back on a non-numeric value", () => {
    setEnv(KEY, "abc");
    expect(envInt(KEY, 600_000)).toBe(600_000);
  });

  it("falls back on a negative number", () => {
    setEnv(KEY, "-1");
    expect(envInt(KEY, 600_000)).toBe(600_000);
  });

  it('falls back on "0" unless the caller opts in', () => {
    setEnv(KEY, "0");
    expect(envInt(KEY, 600_000)).toBe(600_000);
  });

  it('honours a deliberate "0" when the caller allows it (idle backoff off)', () => {
    setEnv(KEY, "0");
    expect(envInt(KEY, 15_000, { allowZero: true })).toBe(0);
  });

  it("still falls back on an UNSET variable even when zero is allowed", () => {
    delete process.env[KEY];
    expect(envInt(KEY, 15_000, { allowZero: true })).toBe(15_000);
  });

  it("uses a valid positive value", () => {
    setEnv(KEY, "2500");
    expect(envInt(KEY, 600_000)).toBe(2500);
  });

  it("tolerates surrounding whitespace on a valid value", () => {
    setEnv(KEY, " 2500 ");
    expect(envInt(KEY, 600_000)).toBe(2500);
  });
});

describe("dispatch watchdog budget (regression)", () => {
  it("is 10 minutes when ADMIN_WORKER_DISPATCH_TIMEOUT_MS is unset", () => {
    delete process.env[TIMEOUT_KEY];
    expect(dispatchTimeoutMs()).toBe(10 * 60 * 1000);
    expect(dispatchTimeoutMs()).toBe(DISPATCH_WATCHDOG_MS);
  });

  it.each(["", "   ", "abc", "-5", "0"])(
    "never lets a %j value produce a 0 ms watchdog",
    (value) => {
      setEnv(TIMEOUT_KEY, value);
      expect(dispatchTimeoutMs()).toBe(DISPATCH_WATCHDOG_MS);
    },
  );

  it("still honours a real explicit override", () => {
    setEnv(TIMEOUT_KEY, "30000");
    expect(dispatchTimeoutMs()).toBe(30_000);
  });
});
