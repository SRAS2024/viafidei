/**
 * Supervisor: an intended stop (switch OFF / lease lost) must NOT be restarted
 * (audit LIVE-5) — previously the loop returning was always treated as a
 * crash, so an OFF switch left the process (and its Python brain) alive
 * forever, re-checking every <=60s.
 */
import { describe, expect, it } from "vitest";

import { loopStopReason, runLoopSupervised } from "@/lib/admin-worker/worker-supervisor";

describe("runLoopSupervised — intended stops", () => {
  it("returns without restarting when the loop reports stopReason", async () => {
    let calls = 0;
    const logs: string[] = [];
    const result = await runLoopSupervised({
      workerId: "w",
      oneShot: false,
      maxPasses: Infinity,
      runLoop: async () => {
        calls += 1;
        return { passes: 3, built: 0, published: 0, failed: 0, stopReason: "switch_off" };
      },
      isShuttingDown: () => false,
      sleepImpl: async () => undefined,
      log: (m) => logs.push(m),
      maxRestarts: 5,
    });
    expect(calls).toBe(1);
    expect(result.stopReason).toBe("switch_off");
    expect(logs.join("\n")).toMatch(/stopped on purpose/);
  });

  it("still restarts a loop that returns WITHOUT a stopReason (unexpected return)", async () => {
    let calls = 0;
    const result = await runLoopSupervised({
      workerId: "w",
      oneShot: false,
      maxPasses: Infinity,
      runLoop: async () => {
        calls += 1;
        return { passes: 1, built: 0, published: 0, failed: 0 };
      },
      isShuttingDown: () => false,
      sleepImpl: async () => undefined,
      maxRestarts: 2,
    });
    expect(calls).toBe(3); // initial + 2 restarts
    expect(result.stopReason).toBeNull();
  });

  it("loopStopReason only honours a non-empty string", () => {
    expect(loopStopReason({ stopReason: "lease_lost" })).toBe("lease_lost");
    expect(loopStopReason({ stopReason: "" })).toBeNull();
    expect(loopStopReason({ passes: 1 })).toBeNull();
    expect(loopStopReason(undefined)).toBeNull();
  });
});
