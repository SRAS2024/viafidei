/**
 * The local host never gives up on a worker while the switch is ON.
 *
 * Measured gap: the sixth consecutive crash — after 2+4+6+8+10 s of backoff,
 * about 30 s of trouble — set the runtime to "failed", and a switch that was
 * merely still ON never restarted a failed runtime. Any fault that outlived
 * half a minute stopped all content work until an operator re-armed it, while
 * the phone and the site showed the switch ON.
 *
 * Pinned: the capped exponential backoff, the degraded threshold, the env
 * knobs, and that scripts/local-worker-host.ts applies them (no give-up path,
 * restarts re-read the switch, an OFF cancels a pending restart, a spawn
 * failure retries instead of wedging).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  degradedReason,
  formatDelay,
  RESTART_BACKOFF_BASE_MS,
  RESTART_BACKOFF_MAX_MS,
  RESTART_DEGRADED_AFTER,
  RESTART_HEALTHY_UPTIME_MS,
  restartBackoffFromEnv,
  restartDegraded,
  restartDelayMs,
} from "@/lib/admin-worker/restart-backoff";

const DEFAULTS = restartBackoffFromEnv({});

describe("restartDelayMs", () => {
  it("doubles from 2 s and caps at 5 min", () => {
    const delays = Array.from({ length: 12 }, (_, i) => restartDelayMs(i + 1, DEFAULTS));
    expect(delays).toEqual([
      2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 128_000, 256_000, 300_000, 300_000, 300_000,
      300_000,
    ]);
  });

  it("stays finite and capped however long the streak", () => {
    expect(restartDelayMs(10_000, DEFAULTS)).toBe(RESTART_BACKOFF_MAX_MS);
    expect(restartDelayMs(0, DEFAULTS)).toBe(RESTART_BACKOFF_BASE_MS);
  });

  it("is never a hot loop: a day of a worker that dies on every launch is a few hundred attempts", () => {
    let elapsed = 0;
    let attempts = 0;
    while (elapsed < 24 * 60 * 60 * 1000) {
      attempts += 1;
      elapsed += restartDelayMs(attempts, DEFAULTS);
    }
    expect(attempts).toBeLessThan(300);
  });
});

describe("restartBackoffFromEnv", () => {
  it("defaults when unset, blank, zero or not a number", () => {
    for (const raw of [undefined, "", "  ", "0", "-5", "soon"]) {
      expect(
        restartBackoffFromEnv({
          VIAFIDEI_WORKER_RESTART_BASE_MS: raw,
          VIAFIDEI_WORKER_RESTART_MAX_MS: raw,
          VIAFIDEI_WORKER_HEALTHY_UPTIME_MS: raw,
        }),
      ).toEqual({
        baseMs: RESTART_BACKOFF_BASE_MS,
        maxMs: RESTART_BACKOFF_MAX_MS,
        healthyUptimeMs: RESTART_HEALTHY_UPTIME_MS,
      });
    }
  });

  it("honours explicit values, and never lets the cap fall below the first delay", () => {
    expect(
      restartBackoffFromEnv({
        VIAFIDEI_WORKER_RESTART_BASE_MS: "5000",
        VIAFIDEI_WORKER_RESTART_MAX_MS: "60000",
        VIAFIDEI_WORKER_HEALTHY_UPTIME_MS: "30000",
      }),
    ).toEqual({ baseMs: 5_000, maxMs: 60_000, healthyUptimeMs: 30_000 });
    expect(
      restartBackoffFromEnv({
        VIAFIDEI_WORKER_RESTART_BASE_MS: "10000",
        VIAFIDEI_WORKER_RESTART_MAX_MS: "1000",
      }).maxMs,
    ).toBe(10_000);
  });
});

describe("degraded, not given up", () => {
  it("turns degraded exactly where the host used to give up", () => {
    expect(restartDegraded(RESTART_DEGRADED_AFTER)).toBe(false);
    expect(restartDegraded(RESTART_DEGRADED_AFTER + 1)).toBe(true);
  });

  it("tells the operator it keeps retrying, and when, without asking for a re-arm", () => {
    const reason = degradedReason({ consecutive: 7, code: 1, signal: null, nextDelayMs: 128_000 });
    expect(reason).toContain("7 times in a row");
    expect(reason).toContain("keeps retrying while the switch is ON");
    expect(reason).toContain("2 min");
    expect(reason).not.toMatch(/giving up|switch the Admin Worker off and on/i);
  });

  it("formats short and long delays for a log line", () => {
    expect(formatDelay(2_000)).toBe("2s");
    expect(formatDelay(64_000)).toBe("64s");
    expect(formatDelay(300_000)).toBe("5 min");
  });
});

describe("scripts/local-worker-host.ts applies it", () => {
  const src = readFileSync(join(process.cwd(), "scripts/local-worker-host.ts"), "utf8");
  const between = (from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to));

  it("has no give-up path left", () => {
    expect(src).not.toContain("MAX_CONSECUTIVE_RESTARTS");
    expect(src).not.toContain("local_worker_gave_up");
    expect(src).not.toMatch(/Giving up/);
  });

  it("restarts a crash with the capped backoff and reports degraded past the old limit", () => {
    const crash = between("async function restartAfterCrash(", "function holdLifecycle(");
    expect(crash).toContain("restartDelayMs(host.restarts, RESTART_BACKOFF)");
    expect(crash).toContain("restartDegraded(host.restarts)");
    expect(crash).toContain("scheduleRestart(delayMs);");
    expect(crash).not.toContain("startWorkerChild(");
  });

  it("re-reads the switch when an armed restart fires, instead of starting blindly", () => {
    const arm = between("function scheduleRestart(", "function cancelScheduledRestart(");
    expect(arm).toContain("void resumeIfSwitchOn();");
    expect(arm).not.toContain("startWorkerChild(");
  });

  it("cancels an armed restart on every stop, so OFF during a backoff wins", () => {
    const stop = between("async function stopWorkerChild(", "async function withDbBudget(");
    expect(stop).toContain("cancelScheduledRestart()");
    expect(src).toContain("restartScheduled: restartTimer !== null,");
  });

  it("retries a worker that could not even be spawned instead of wedging on a dead child", () => {
    const failure = between("function onSpawnFailure(", "function startWorkerChild(");
    expect(failure).toContain("host.child = null;");
    expect(failure).toContain("restartAfterCrash(");
    expect(src).toContain("if (host.child === child && child.pid == null) {");
  });

  it("shows the retry plan on the status payload", () => {
    expect(src).toContain("degraded: host.degraded,");
    expect(src).toMatch(/nextAttemptAt: host\.nextRestartAt/);
  });
});
