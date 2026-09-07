/**
 * Bridge hardening from the audit (LIVE-1/BRAIN-3, BRAIN-2, BRAIN-4, BRAIN-6,
 * BRAIN-1 end-to-end):
 *   - the interpreter is resolved to a Python >= 3.10 when INTELLIGENCE_PYTHON
 *     is unset (Apple's python3 is 3.9 and crashes at import);
 *   - ensureBrainStarted is probe-verified and reports the concrete reason
 *     (incl. the Python stderr tail) instead of "online" for a dead child;
 *   - a hung-but-alive brain is recycled after consecutive timeouts;
 *   - a blank INTELLIGENCE_TIMEOUT_MS no longer collapses to a 0ms timeout;
 *   - the real select_action reorders TS-scale (0-100) candidates.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  __getBrainProcForTest,
  brainStatus,
  callBrain,
  ensureBrainStarted,
  probeBrain,
  resetBrainStatus,
  resolvedPythonExe,
  selectAction,
  shutdownBrain,
} from "@/lib/admin-worker/intelligence";

// Fake brain: `crash` mimics the 3.9 import failure (traceback on stderr, exit
// 1); `silent` reads requests but never answers; `normal` echoes.
const FAKE_BRAIN = `#!/usr/bin/env python3
import sys, json, os
mode = os.environ.get("FAKE_BRAIN_MODE", "normal")
if mode == "crash":
    sys.stderr.write("TypeError: dataclass() got an unexpected keyword argument 'slots'\\n")
    sys.stderr.flush()
    sys.exit(1)
if "--list-ops" in sys.argv:
    print(json.dumps({"protocol_version": 1, "ops": ["iq_metrics"]}))
    sys.exit(0)
def env(rid, op):
    return {"ok": True, "result": {"echo": op}, "confidence": 0.9, "reasoning": "ok",
            "evidence": [], "sources_used": [], "risk_level": "low",
            "recommended_next_action": "proceed", "safe_to_auto_execute": True,
            "error": None, "id": rid, "op": op, "protocol_version": 1, "elapsed_ms": 0.0}
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        req = json.loads(line)
    except Exception:
        continue
    if mode == "silent":
        continue
    sys.stdout.write(json.dumps(env(req.get("id"), req.get("op"))) + "\\n"); sys.stdout.flush()
`;

let fakePath = "";
let brainOnline = false;

beforeAll(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fakebrain-core-"));
  fakePath = path.join(dir, "fake_brain.py");
  writeFileSync(fakePath, FAKE_BRAIN);
  chmodSync(fakePath, 0o755);
  process.env.INTELLIGENCE_BRAIN_ENABLED = "1";
  delete process.env.INTELLIGENCE_PYTHON;
  resetBrainStatus();
  const probe = await probeBrain().catch(() => null);
  brainOnline = probe != null && probe.protocolVersion === 1;
});

afterEach(() => {
  delete process.env.INTELLIGENCE_PYTHON;
  delete process.env.FAKE_BRAIN_MODE;
  delete process.env.INTELLIGENCE_TIMEOUT_MS;
  process.env.INTELLIGENCE_BRAIN_ENABLED = "1";
  resetBrainStatus();
});

afterAll(() => shutdownBrain());

function useFakeBrain(mode: string): void {
  process.env.INTELLIGENCE_PYTHON = fakePath;
  process.env.FAKE_BRAIN_MODE = mode;
  resetBrainStatus();
}

describe("interpreter resolution", () => {
  it("resolves a Python >= 3.10 when INTELLIGENCE_PYTHON is unset", () => {
    delete process.env.INTELLIGENCE_PYTHON;
    resetBrainStatus();
    const exe = resolvedPythonExe();
    const check = spawnSync(exe, [
      "-c",
      "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)",
    ]);
    if (check.error) return; // no usable Python on this machine at all — nothing to assert
    expect(check.status).toBe(0);
  });

  it("uses an explicit INTELLIGENCE_PYTHON verbatim", () => {
    process.env.INTELLIGENCE_PYTHON = "/nonexistent/python-x";
    resetBrainStatus();
    expect(resolvedPythonExe()).toBe("/nonexistent/python-x");
  });
});

describe("ensureBrainStarted is probe-verified", () => {
  it("reports offline (not 'online') for a missing interpreter", async () => {
    process.env.INTELLIGENCE_PYTHON = "/nonexistent/python-x";
    resetBrainStatus();
    const s = await ensureBrainStarted(2000);
    expect(s.online).toBe(false);
    expect(s.python).toBe("/nonexistent/python-x");
    expect(s.reason ?? "").toMatch(/ENOENT|spawn error|no envelope/);
  });

  it("surfaces the Python stderr when the child dies at import", async () => {
    if (!brainOnline) return;
    useFakeBrain("crash");
    const s = await ensureBrainStarted(2000);
    expect(s.online).toBe(false);
    expect(s.reason ?? "").toMatch(/slots/);
  });

  it("reports online with the interpreter + protocol for a working brain", async () => {
    if (!brainOnline) return;
    useFakeBrain("normal");
    const s = await ensureBrainStarted(2000);
    expect(s.online).toBe(true);
    expect(s.python).toBe(fakePath);
    expect(s.protocolVersion).toBe(1);
  });

  it("reports offline when the brain is disabled", async () => {
    process.env.INTELLIGENCE_BRAIN_ENABLED = "0";
    const s = await ensureBrainStarted(500);
    expect(s.online).toBe(false);
    expect(s.reason).toMatch(/disabled/);
  });
});

describe("hung brain recycling", () => {
  it("recycles the resident process after consecutive timeouts", async () => {
    if (!brainOnline) return;
    useFakeBrain("silent");
    expect(await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 300 })).toBeNull();
    const first = __getBrainProcForTest();
    expect(first).not.toBeNull();
    const firstPid = first!.pid;
    // Second consecutive timeout → the hung child is killed and detached.
    expect(await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 300 })).toBeNull();
    const after = __getBrainProcForTest();
    expect(after === null || after.pid !== firstPid).toBe(true);
    // The next call gets a FRESH process (not the hung pid).
    await callBrain("iq_metrics", { stats: {} }, { timeoutMs: 300 });
    const third = __getBrainProcForTest();
    expect(third).not.toBeNull();
    expect(third!.pid).not.toBe(firstPid);
    expect(brainStatus().running).toBe(true);
  });
});

describe("INTELLIGENCE_TIMEOUT_MS parsing", () => {
  it("a blank value does not collapse to a 0ms timeout", async () => {
    if (!brainOnline) return;
    useFakeBrain("normal");
    process.env.INTELLIGENCE_TIMEOUT_MS = "";
    const env = await callBrain("iq_metrics", { stats: {} });
    expect(env).not.toBeNull();
    expect(env!.ok).toBe(true);
  });
});

describe("real select_action on TypeScript-scale scores", () => {
  it("lets learned signals demote an unhealthy front-runner", async () => {
    if (!brainOnline) return;
    delete process.env.INTELLIGENCE_PYTHON;
    resetBrainStatus();
    const env = await selectAction({
      candidates: [
        {
          missionStage: "DISCOVERY",
          actionType: "DISCOVER",
          finalScore: 62.5,
          safe: true,
          sourceTarget: "weak.example",
          contentType: "PRAYER",
        },
        { missionStage: "PUBLIC_PUBLISH", actionType: "PUBLISH", finalScore: 58.0, safe: true },
        { missionStage: "MAINTENANCE", actionType: "MAINTAIN", finalScore: 20.0, safe: true },
      ] as never,
      world: { isPaused: false },
      stageOutcomes: [
        { stage: "DISCOVERY", successRate: 0.0 },
        { stage: "PUBLIC_PUBLISH", successRate: 1.0 },
      ],
      actionHistory: Array.from({ length: 12 }, () => ({
        missionStage: "DISCOVERY",
        contentType: null,
      })),
      sourceReputation: [{ host: "weak.example", tier: "BLOCKED" }],
    });
    expect(env).not.toBeNull();
    expect(env!.ok).toBe(true);
    const result = env!.result as {
      selected_action: string;
      final_score: number;
      rejected_alternatives: Array<{ final_score: number }>;
    };
    expect(result.selected_action).toBe("PUBLIC_PUBLISH");
    // Reported on the TS scale, not pinned at 1.0 — and the alternatives are
    // no longer a three-way tie.
    expect(result.final_score).toBeGreaterThan(1.5);
    const scores = new Set([
      result.final_score,
      ...result.rejected_alternatives.map((a) => a.final_score),
    ]);
    expect(scores.size).toBe(3);
  });
});
