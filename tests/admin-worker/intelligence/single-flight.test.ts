/**
 * One request in flight to the Python brain at a time.
 *
 * Measured gap: concurrent lanes wrote overlapping requests into the one
 * sequential brain process, and each call's 8 s timeout started at its own
 * write — so calls queued inside the pipe timed out while the brain was busy
 * with someone else's request, and two such timeouts SIGKILLed the brain for
 * everyone (failing a publish gate or a readings refresh mid-flight).
 *
 * Pinned twice: the turn-taking primitive with no process at all, and the
 * bridge against a deliberately slow fake brain (skipped, like the other
 * bridge tests, where no Python is available).
 */
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  __getBrainProcForTest,
  brainQueueStatus,
  brainStatus,
  callBrain,
  probeBrain,
  resetBrainStatus,
  shutdownBrain,
} from "@/lib/admin-worker/intelligence";
import { SingleFlight } from "@/lib/admin-worker/intelligence/single-flight";

describe("SingleFlight", () => {
  it("grants the first caller at once and the next ones in arrival order", async () => {
    const flight = new SingleFlight();
    expect(await flight.acquire(1000)).toBe("granted");
    const order: string[] = [];
    const b = flight.acquire(1000).then((t) => order.push(`b:${t}`));
    const c = flight.acquire(1000).then((t) => order.push(`c:${t}`));
    expect(flight.waiting).toBe(2);
    flight.release();
    await b;
    flight.release();
    await c;
    expect(order).toEqual(["b:granted", "c:granted"]);
    flight.release();
    expect(flight.inFlight).toBe(false);
  });

  it("answers 'busy' when the wait budget runs out, and forgets the caller", async () => {
    const flight = new SingleFlight();
    await flight.acquire(1000);
    const started = Date.now();
    expect(await flight.acquire(30)).toBe("busy");
    expect(Date.now() - started).toBeLessThan(1000);
    expect(flight.waiting).toBe(0);
    expect(await flight.acquire(0)).toBe("busy");
    // The turn still belongs to the first caller until it releases.
    expect(flight.inFlight).toBe(true);
    flight.release();
    expect(flight.inFlight).toBe(false);
  });

  it("turns every waiter away on shutdown, leaving the current turn to finish", async () => {
    const flight = new SingleFlight();
    await flight.acquire(1000);
    const waiting = [flight.acquire(1000), flight.acquire(1000)];
    flight.cancelWaiting();
    expect(await Promise.all(waiting)).toEqual(["cancelled", "cancelled"]);
    expect(flight.inFlight).toBe(true);
    flight.release();
    expect(flight.inFlight).toBe(false);
  });
});

// A fake brain that answers correctly but slowly — the shape of a busy brain.
// Like the real one it answers one request at a time; a request may carry its
// own delay (payload.delayMs) to play a single slow op.
const SLOW_BRAIN = `#!/usr/bin/env python3
import sys, json, os, time
delay = float(os.environ.get("FAKE_BRAIN_DELAY_MS", "0")) / 1000.0
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    req = json.loads(line)
    own = (req.get("payload") or {}).get("delayMs")
    time.sleep(float(own) / 1000.0 if own is not None else delay)
    sys.stdout.write(json.dumps({"ok": True, "result": {"echo": req.get("op")}, "confidence": 0.9,
        "reasoning": "ok", "evidence": [], "sources_used": [], "risk_level": "low",
        "recommended_next_action": "proceed", "safe_to_auto_execute": True, "error": None,
        "id": req.get("id"), "op": req.get("op"), "protocol_version": 1, "elapsed_ms": 0.0}) + "\\n")
    sys.stdout.flush()
`;

let slowBrainPath = "";
let pythonAvailable = false;

beforeAll(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "slowbrain-"));
  slowBrainPath = path.join(dir, "slow_brain.py");
  writeFileSync(slowBrainPath, SLOW_BRAIN);
  chmodSync(slowBrainPath, 0o755);
  process.env.INTELLIGENCE_BRAIN_ENABLED = "1";
  delete process.env.INTELLIGENCE_PYTHON;
  resetBrainStatus();
  const probe = await probeBrain().catch(() => null);
  pythonAvailable = probe != null && probe.protocolVersion === 1;
});

afterEach(() => {
  delete process.env.INTELLIGENCE_PYTHON;
  delete process.env.FAKE_BRAIN_DELAY_MS;
  process.env.INTELLIGENCE_BRAIN_ENABLED = "1";
  resetBrainStatus();
});

afterAll(() => {
  shutdownBrain();
  process.env.INTELLIGENCE_BRAIN_ENABLED = "0";
});

function useSlowBrain(delayMs: number): void {
  process.env.INTELLIGENCE_PYTHON = slowBrainPath;
  process.env.FAKE_BRAIN_DELAY_MS = String(delayMs);
  resetBrainStatus();
}

describe("callBrain — single flight against a slow brain", () => {
  it("concurrent calls each get the full timeout once written, so none times out and nothing is recycled", async () => {
    if (!pythonAvailable) return;
    useSlowBrain(250);
    // Warm the process so spawn time is not part of the measurement.
    expect(await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 3000 })).not.toBeNull();
    const pid = __getBrainProcForTest()?.pid;
    // Four calls at once against a brain that takes 250 ms each. Written all
    // at once (the old bridge), calls 3 and 4 finished at 750 ms and 1 s and
    // timed out at 600 ms — two timeouts, so the brain was SIGKILLed.
    const envs = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        callBrain("iq_metrics", { stats: { i } }, { timeoutMs: 600, queueWaitMs: 5000 }),
      ),
    );
    expect(envs.every((env) => env !== null && env.ok)).toBe(true);
    expect(__getBrainProcForTest()?.pid).toBe(pid);
    expect(brainStatus().status).toBe("up");
  }, 20_000);

  it("a call that cannot get its turn fails fast as busy — not a timeout, no recycle", async () => {
    if (!pythonAvailable) return;
    useSlowBrain(800);
    expect(await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 3000 })).not.toBeNull();
    const pid = __getBrainProcForTest()?.pid;
    const first = callBrain("iq_metrics", { stats: { n: 1 } }, { timeoutMs: 3000 });
    const started = Date.now();
    const second = await callBrain("iq_metrics", { stats: { n: 2 } }, { queueWaitMs: 100 });
    expect(second).toBeNull();
    expect(Date.now() - started).toBeLessThan(700);
    expect(await first).not.toBeNull();
    // Busy is not a fault: same process, still up, and the next call works.
    expect(__getBrainProcForTest()?.pid).toBe(pid);
    expect(brainStatus().status).toBe("up");
    expect(await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 3000 })).not.toBeNull();
    expect(brainQueueStatus()).toEqual({ inFlight: false, waiting: 0 });
  }, 20_000);

  it("one op slower than its timeout does not make the next, normal op time out — and nothing is recycled", async () => {
    if (!pythonAvailable) return;
    useSlowBrain(0);
    expect(await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 3000 })).not.toBeNull();
    const pid = __getBrainProcForTest()?.pid;
    // A takes 1.6 s against a 1 s timeout: null at 1 s, while the brain keeps
    // working on it until 1.6 s.
    expect(await callBrain("iq_metrics", { delayMs: 1600 }, { timeoutMs: 1000 })).toBeNull();
    // The turn is still held for A's late answer...
    expect(brainQueueStatus().inFlight).toBe(true);
    // ...so B is written after it, not behind it in the pipe. Written at once
    // (the old release), B's 400 ms ran out at 1.4 s while the brain was still
    // on A: a second timeout in a row, and the slow-but-healthy brain was
    // SIGKILLed.
    const started = Date.now();
    const b = await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 400, queueWaitMs: 5000 });
    expect(b).not.toBeNull();
    expect(b?.ok).toBe(true);
    // B waited for A's late answer (~0.6 s), not for the cap (a full second).
    expect(Date.now() - started).toBeLessThan(1500);
    expect(__getBrainProcForTest()?.pid).toBe(pid);
    expect(brainStatus().status).toBe("up");
    expect(brainQueueStatus()).toEqual({ inFlight: false, waiting: 0 });
  }, 20_000);

  it("a brain that never answers is still recycled after two real timeouts", async () => {
    if (!pythonAvailable) return;
    useSlowBrain(0);
    expect(await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 3000 })).not.toBeNull();
    const pid = __getBrainProcForTest()?.pid;
    // Stuck for good: no late answer, so the turn is held one more window...
    expect(await callBrain("iq_metrics", { delayMs: 60_000 }, { timeoutMs: 300 })).toBeNull();
    expect(brainQueueStatus().inFlight).toBe(true);
    // ...then the next request gets its own full timeout, and that second
    // timeout recycles the process.
    expect(
      await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 300, queueWaitMs: 5000 }),
    ).toBeNull();
    expect(__getBrainProcForTest()).toBeNull();
    expect(brainQueueStatus()).toEqual({ inFlight: false, waiting: 0 });
    // A fresh process answers the next call.
    expect(await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 3000 })).not.toBeNull();
    expect(__getBrainProcForTest()?.pid).not.toBe(pid);
  }, 20_000);

  it("a turn held for a late answer is freed when the brain is shut down", async () => {
    if (!pythonAvailable) return;
    useSlowBrain(0);
    expect(await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 3000 })).not.toBeNull();
    expect(await callBrain("iq_metrics", { delayMs: 60_000 }, { timeoutMs: 300 })).toBeNull();
    expect(brainQueueStatus().inFlight).toBe(true);
    shutdownBrain();
    expect(brainQueueStatus()).toEqual({ inFlight: false, waiting: 0 });
  }, 20_000);

  it("shutting the brain down turns waiting calls away instead of respawning it for them", async () => {
    if (!pythonAvailable) return;
    useSlowBrain(800);
    expect(await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 3000 })).not.toBeNull();
    const first = callBrain("iq_metrics", { stats: { n: 1 } }, { timeoutMs: 3000 });
    const waiting = callBrain("iq_metrics", { stats: { n: 2 } }, { queueWaitMs: 5000 });
    // Let both calls reach the queue before shutting down.
    await new Promise((resolve) => setTimeout(resolve, 50));
    shutdownBrain();
    expect(await first).toBeNull();
    expect(await waiting).toBeNull();
    expect(__getBrainProcForTest()).toBeNull();
  }, 20_000);
});
