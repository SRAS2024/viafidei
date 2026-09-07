/**
 * Degraded-mode log throttling (audit BRAIN-7): the "brain unavailable" WARN
 * used to be written on EVERY pass — tens of thousands of identical rows over
 * a weekend. Now: first occurrence, then one row per 15-minute window carrying
 * the number of suppressed repeats.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetBrainEventThrottleForTest,
  pythonFinalSelector,
} from "@/lib/admin-worker/final-brain";
import type { BrainDecision, WorldState } from "@/lib/admin-worker/brain";

beforeEach(() => {
  process.env.INTELLIGENCE_BRAIN_ENABLED = "0"; // disabled → "python_brain_unavailable"
  __resetBrainEventThrottleForTest();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("degraded-mode log throttle", () => {
  it("logs the first occurrence, suppresses repeats, then reports the count after the window", async () => {
    const create = vi.fn(async () => ({ id: "l" }));
    const prisma = { adminWorkerLog: { create } } as never;
    const selector = pythonFinalSelector(prisma);
    const input = {
      world: {} as WorldState,
      decision: { rankedAlternatives: [] } as unknown as BrainDecision,
      passId: "p",
    };

    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    expect(await selector(input)).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);

    now += 60_000;
    await selector(input);
    now += 60_000;
    await selector(input);
    expect(create).toHaveBeenCalledTimes(1); // suppressed within the window

    now += 15 * 60_000;
    await selector(input);
    expect(create).toHaveBeenCalledTimes(2);
    const second = (create.mock.calls[1] as unknown[])[0] as {
      data: { message: string; safeMetadata: { suppressedRepeats: number } };
    };
    // 4th occurrence = the 3rd repeat since the first row; 2 rows were swallowed.
    expect(second.data.message).toMatch(/repeated 3×/);
    expect(second.data.safeMetadata.suppressedRepeats).toBe(2);
  });
});
