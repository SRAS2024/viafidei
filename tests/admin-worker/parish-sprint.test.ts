/**
 * Parish sprint scheduler: parishes grow in bounded sprints, then stand down for
 * a cooldown during which the worker grows other content types — unless every
 * other goal is met (then parishes run continuously) or PARISH is met (idle).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";
import { evaluateParishSprint, recordParishSprintProgress } from "@/lib/admin-worker/parish-sprint";

const ENV = ["ADMIN_WORKER_PARISH_SPRINT_SIZE", "ADMIN_WORKER_PARISH_SPRINT_COOLDOWN_MS"];
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {};
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

function makePrisma(opts: {
  parishGap: number;
  otherGaps: number[];
  memory: { sprintPublished: number; cooldownUntil: number | null } | null;
  onUpsert?: (v: unknown) => void;
}): PrismaClient {
  return {
    contentGoal: {
      findUnique: vi.fn(async () => ({ gapCount: opts.parishGap })),
      findMany: vi.fn(async () => opts.otherGaps.map((gapCount) => ({ gapCount }))),
    },
    adminWorkerMemory: {
      findUnique: vi.fn(async () => (opts.memory ? { memoryValue: opts.memory } : null)),
      upsert: vi.fn(async (args: { update?: { memoryValue?: unknown } }) => {
        opts.onUpsert?.(args.update?.memoryValue);
        return {};
      }),
    },
  } as unknown as PrismaClient;
}

describe("evaluateParishSprint", () => {
  it("is ACTIVE during a sprint with no cooldown and other goals unmet", async () => {
    const d = await evaluateParishSprint(
      makePrisma({
        parishGap: 199000,
        otherGaps: [5, 10],
        memory: { sprintPublished: 200, cooldownUntil: null },
      }),
    );
    expect(d.active).toBe(true);
    expect(d.allOthersMet).toBe(false);
  });

  it("is INACTIVE during the cooldown window while other goals are unmet", async () => {
    const future = Date.now() + 3 * 24 * 60 * 60 * 1000;
    const d = await evaluateParishSprint(
      makePrisma({
        parishGap: 199000,
        otherGaps: [5],
        memory: { sprintPublished: 0, cooldownUntil: future },
      }),
    );
    expect(d.active).toBe(false);
    expect(d.reason).toMatch(/cooldown/i);
  });

  it("OVERRIDES the cooldown to focus PARISH when every other goal is met", async () => {
    const future = Date.now() + 3 * 24 * 60 * 60 * 1000;
    const d = await evaluateParishSprint(
      makePrisma({
        parishGap: 199000,
        otherGaps: [0, 0, 0],
        memory: { sprintPublished: 0, cooldownUntil: future },
      }),
    );
    expect(d.active).toBe(true);
    expect(d.allOthersMet).toBe(true);
  });

  it("is INACTIVE (idle) when the PARISH goal itself is met", async () => {
    const d = await evaluateParishSprint(
      makePrisma({ parishGap: 0, otherGaps: [5], memory: null }),
    );
    expect(d.active).toBe(false);
    expect(d.reason).toMatch(/met/i);
  });
});

describe("recordParishSprintProgress", () => {
  it("starts the cooldown once the sprint size is reached", async () => {
    process.env.ADMIN_WORKER_PARISH_SPRINT_SIZE = "100";
    let written: { sprintPublished: number; cooldownUntil: number | null } | undefined;
    const prisma = makePrisma({
      parishGap: 199000,
      otherGaps: [5],
      memory: { sprintPublished: 90, cooldownUntil: null },
      onUpsert: (v) => {
        written = v as typeof written;
      },
    });
    await recordParishSprintProgress(prisma, 20); // 90 + 20 = 110 >= 100
    expect(written?.sprintPublished).toBe(0);
    expect(written?.cooldownUntil).toBeTypeOf("number");
  });

  it("accumulates within a sprint without a cooldown when below the size", async () => {
    process.env.ADMIN_WORKER_PARISH_SPRINT_SIZE = "10000";
    let written: { sprintPublished: number; cooldownUntil: number | null } | undefined;
    const prisma = makePrisma({
      parishGap: 199000,
      otherGaps: [5],
      memory: { sprintPublished: 100, cooldownUntil: null },
      onUpsert: (v) => {
        written = v as typeof written;
      },
    });
    await recordParishSprintProgress(prisma, 20);
    expect(written?.sprintPublished).toBe(120);
    expect(written?.cooldownUntil).toBeNull();
  });
});
