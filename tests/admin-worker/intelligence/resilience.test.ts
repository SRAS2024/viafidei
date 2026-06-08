import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  brainStatus,
  callBrain,
  iqMetrics,
  probeBrain,
  resetBrainStatus,
  shutdownBrain,
} from "@/lib/admin-worker/intelligence";
import type { BrainOp } from "@/lib/admin-worker/intelligence/contracts";

/**
 * Resilience / chaos tests for the TypeScript ↔ Python bridge (spec:
 * "replayability & resilience — timeout, process death, malformed output,
 * protocol mismatch, recovery, circuit breakers").
 *
 * The contract is: whatever the brain does, the bridge degrades to `null`
 * (fail-open) rather than throwing or hanging. A `null` final-decision puts the
 * worker into safe degraded mode; supplementary callers simply skip. These
 * tests drive a deliberately misbehaving "fake brain" (via INTELLIGENCE_PYTHON)
 * to exercise the hostile paths deterministically, plus the real brain to prove
 * process death/recovery and concurrent multiplexing.
 */

// A configurable fake brain. It ignores the `-m intelligence` args and behaves
// per FAKE_BRAIN_MODE so we can simulate protocol mismatch, malformed output,
// silence (timeout), and immediate crash (circuit breaker) on demand.
const FAKE_BRAIN = `#!/usr/bin/env python3
import sys, json, os
mode = os.environ.get("FAKE_BRAIN_MODE", "normal")
if mode == "crash":
    sys.exit(1)
if "--list-ops" in sys.argv:
    print(json.dumps({"protocol_version": 1, "ops": ["iq_metrics"]}))
    sys.exit(0)
def env(rid, op, proto=1):
    return {"ok": True, "result": {"echo": op}, "confidence": 0.9, "reasoning": "ok",
            "evidence": [], "sources_used": [], "risk_level": "low",
            "recommended_next_action": "proceed", "safe_to_auto_execute": True,
            "error": None, "id": rid, "op": op, "protocol_version": proto, "elapsed_ms": 0.0}
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        req = json.loads(line)
    except Exception:
        continue
    rid, op = req.get("id"), req.get("op")
    if mode == "silent":
        continue  # read but never respond -> client times out
    if mode == "malformed":
        sys.stdout.write("this is not json at all\\n"); sys.stdout.flush(); continue
    if mode == "protocol":
        sys.stdout.write(json.dumps(env(rid, op, proto=999)) + "\\n"); sys.stdout.flush(); continue
    sys.stdout.write(json.dumps(env(rid, op)) + "\\n"); sys.stdout.flush()
`;

let fakePath = "";
let brainOnline = false;

beforeAll(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fakebrain-"));
  fakePath = path.join(dir, "fake_brain.py");
  writeFileSync(fakePath, FAKE_BRAIN);
  chmodSync(fakePath, 0o755);

  // Probe the REAL brain once (so the real-process tests can skip when there
  // is no python3 here). This uses the default interpreter, not the fake.
  process.env.INTELLIGENCE_BRAIN_ENABLED = "1";
  delete process.env.INTELLIGENCE_PYTHON;
  delete process.env.FAKE_BRAIN_MODE;
  resetBrainStatus();
  const probe = await probeBrain().catch(() => null);
  brainOnline = probe != null && probe.protocolVersion === 1;
});

afterEach(() => {
  // Always restore the real interpreter + clean state between tests.
  delete process.env.INTELLIGENCE_PYTHON;
  delete process.env.FAKE_BRAIN_MODE;
  process.env.INTELLIGENCE_BRAIN_ENABLED = "1";
  resetBrainStatus();
});

afterAll(() => {
  shutdownBrain();
});

/** Point the bridge at the fake brain in a given mode. */
function useFakeBrain(mode: string): void {
  process.env.INTELLIGENCE_PYTHON = fakePath;
  process.env.FAKE_BRAIN_MODE = mode;
  resetBrainStatus();
}

describe("bridge resilience — fake brain", () => {
  it("sanity: the fake brain answers a normal request", async () => {
    if (!brainOnline) return; // no python3 -> can't run the fake either
    useFakeBrain("normal");
    const env = await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 2000 });
    expect(env).not.toBeNull();
    expect(env!.ok).toBe(true);
  });

  it("protocol mismatch → null and marks the brain down", async () => {
    if (!brainOnline) return;
    useFakeBrain("protocol");
    const env = await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 2000 });
    expect(env).toBeNull();
    expect(brainStatus().status).toBe("down");
    expect(brainStatus().reason ?? "").toMatch(/protocol mismatch/i);
  });

  it("malformed (non-JSON) output → null (noise ignored, call times out)", async () => {
    if (!brainOnline) return;
    useFakeBrain("malformed");
    const env = await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 400 });
    expect(env).toBeNull();
  });

  it("silent brain (no response) → null via timeout, no hang", async () => {
    if (!brainOnline) return;
    useFakeBrain("silent");
    const start = Date.now();
    const env = await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 400 });
    expect(env).toBeNull();
    expect(Date.now() - start).toBeLessThan(3000); // it returned, it didn't hang
  });

  it("circuit breaker → after repeated crashes the brain is marked down", async () => {
    if (!brainOnline) return;
    useFakeBrain("crash");
    let lastEnv = null;
    for (let i = 0; i < 7; i++) {
      lastEnv = await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 300 });
    }
    expect(lastEnv).toBeNull();
    expect(brainStatus().status).toBe("down");
  });
});

describe("bridge resilience — real brain", () => {
  it("op-level error round-trips as a validated error envelope (transport survives)", async () => {
    if (!brainOnline) return;
    const env = await callBrain("totally_unknown_op" as BrainOp, {}, { timeoutMs: 4000 });
    // The brain answers a structured error envelope; the bridge validates it and
    // returns it (non-null) with ok=false — the process is unharmed.
    expect(env).not.toBeNull();
    expect(env!.ok).toBe(false);
    expect(env!.error ?? "").toMatch(/unknown op/i);
    expect(env!.safeToAutoExecute).toBe(false);
    expect(brainStatus().status).toBe("up"); // transport is healthy
  });

  it("process death + recovery: a killed brain auto-restarts on the next call", async () => {
    if (!brainOnline) return;
    const first = await iqMetrics({ duplicatesPrevented: 1, duplicateCandidates: 2 });
    expect(first).not.toBeNull();
    expect(brainStatus().running).toBe(true);

    shutdownBrain(); // simulate process death
    expect(brainStatus().running).toBe(false);

    const second = await iqMetrics({ duplicatesPrevented: 1, duplicateCandidates: 2 });
    expect(second).not.toBeNull(); // recovered without a manual restart
    expect(brainStatus().running).toBe(true);
  });

  it("concurrent multiplexing: parallel calls each get their own answer by id", async () => {
    if (!brainOnline) return;
    const calls = Array.from({ length: 12 }, (_, i) =>
      callBrain("iq_metrics", { stats: { duplicatesPrevented: i } }, { timeoutMs: 5000 }),
    );
    const envs = await Promise.all(calls);
    expect(envs.every((e) => e != null && e.ok)).toBe(true);
    expect(envs).toHaveLength(12);
  });
});
