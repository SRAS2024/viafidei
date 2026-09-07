/**
 * The in-process brain mutex serialises the supplementary brain callers that
 * run OUTSIDE the `intelligence` lane (awareness, self-model, custody). The
 * resident brain answers one request at a time and the bridge does not queue,
 * so without this a second caller sat in the Python loop with its timeout
 * already running. Pins: strict ordering, release on throw, and that the
 * schema-awareness pass really takes the mutex around its brain call.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  heldDuringAnalyze: null as boolean | null,
  analyzeSchema: vi.fn(),
}));

vi.mock("@/lib/admin-worker/intelligence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/intelligence")>();
  return {
    ...actual,
    isBrainEnabled: () => true,
    analyzeSchema: h.analyzeSchema,
  };
});
vi.mock("@/lib/admin-worker/intelligence/store", () => ({
  recordBrainCall: vi.fn(async () => undefined),
  recordDeveloperRequests: vi.fn(async () => ({ created: 0, bumped: 0 })),
}));

import { brainMutexState, withBrainMutex } from "@/lib/admin-worker/brain-mutex";
import { resetAwarenessThrottle, runSchemaAwareness } from "@/lib/admin-worker/awareness";

const tick = () => new Promise<void>((r) => setTimeout(r, 2));

beforeEach(() => {
  resetAwarenessThrottle();
  h.heldDuringAnalyze = null;
  h.analyzeSchema.mockReset();
});

describe("withBrainMutex", () => {
  it("runs holders strictly one after another, in arrival order", async () => {
    const events: string[] = [];
    const a = withBrainMutex(async () => {
      events.push("a:start");
      await tick();
      await tick();
      events.push("a:end");
      return "a";
    });
    const b = withBrainMutex(async () => {
      events.push("b:start");
      await tick();
      events.push("b:end");
      return "b";
    });
    const c = withBrainMutex(async () => {
      events.push("c:start");
      events.push("c:end");
      return "c";
    });
    expect(await Promise.all([a, b, c])).toEqual(["a", "b", "c"]);
    // No holder starts before the previous one has finished.
    expect(events).toEqual(["a:start", "a:end", "b:start", "b:end", "c:start", "c:end"]);
    expect(brainMutexState()).toEqual({ held: false, waiting: 0 });
  });

  it("releases the mutex when a holder throws, so the next caller still runs", async () => {
    const failing = withBrainMutex(async () => {
      await tick();
      throw new Error("brain exploded");
    });
    const next = withBrainMutex(async () => "ran");
    await expect(failing).rejects.toThrow("brain exploded");
    expect(await next).toBe("ran");
    expect(brainMutexState().held).toBe(false);
  });

  it("reports occupancy while a holder is inside", async () => {
    let seen: { held: boolean; waiting: number } | null = null;
    const p = withBrainMutex(async () => {
      seen = brainMutexState();
    });
    const q = withBrainMutex(async () => undefined);
    await Promise.all([p, q]);
    expect(seen).toEqual({ held: true, waiting: 1 });
  });
});

describe("schema awareness takes the brain mutex around its brain call", () => {
  it("analyzeSchema is invoked while the mutex is held", async () => {
    h.analyzeSchema.mockImplementation(async () => {
      h.heldDuringAnalyze = brainMutexState().held;
      return {
        ok: true,
        result: { findings: { model_count: 3 }, developer_requests: [] },
      };
    });
    const prisma = { adminWorkerLog: { create: vi.fn(async () => ({})) } };
    const r = await runSchemaAwareness(prisma as never);
    expect(r.ran).toBe(true);
    expect(h.analyzeSchema).toHaveBeenCalledTimes(1);
    expect(h.heldDuringAnalyze).toBe(true);
    // …and it is released afterwards.
    expect(brainMutexState().held).toBe(false);
  });
});
