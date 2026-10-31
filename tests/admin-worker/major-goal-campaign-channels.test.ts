/**
 * Major-goal campaign: channel weighting and the SURGE time box.
 *
 * Before: the campaign target was the largest absolute web-type gap ≥ 1000,
 * which in practice meant SAINT forever (10,000 target), and during SURGE the
 * mission target returned SAINT before any rotation — although SAINT grows
 * mainly from the Wikidata lane while PRAYER (248/1000) and NOVENA (31/100) can
 * only grow from the web. Pinned here:
 *   - a type whose structured ingestor published within the last day counts
 *     only a fraction of its gap; once that channel goes quiet the full gap
 *     counts again;
 *   - one type campaigns for at most MAX_SURGE hours, then cools down while
 *     the next goal (or the normal rotation) gets the pipeline — recorded only
 *     by the loop's own evaluation, applied read-only everywhere else;
 *   - the structured lane stamps `lastPublishedAt`, which is what the
 *     productivity read sees.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikidata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/structured/wikidata")>();
  return { ...actual, runSparql: vi.fn() };
});
vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));

import type { PrismaClient } from "@prisma/client";

import { evaluateMajorGoalCampaign } from "@/lib/admin-worker/major-goal-campaign";
import {
  STRUCTURED_PRODUCTIVE_WINDOW_MS,
  productiveStructuredTypes,
  runStructuredIngest,
} from "@/lib/admin-worker/structured/ingest";
import { runSparql, type SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse("2026-10-31T06:00:00Z");

type Goal = { contentType: string; gapCount: number; desiredTarget: number; priority: number };

const SAINT: Goal = { contentType: "SAINT", gapCount: 7_203, desiredTarget: 10_000, priority: 20 };
const CHURCH_DOCUMENT: Goal = {
  contentType: "CHURCH_DOCUMENT",
  gapCount: 4_500,
  desiredTarget: 5_000,
  priority: 80,
};
const PRAYER: Goal = { contentType: "PRAYER", gapCount: 752, desiredTarget: 1_000, priority: 10 };

function fakePrisma(goals: Goal[], opts: { saintPublishedAt?: number | null } = {}) {
  const memory = new Map<string, unknown>();
  if (opts.saintPublishedAt !== undefined) {
    memory.set("structured-cursor:wikidata-saints", {
      offset: 400,
      zeroStreak: 0,
      lastPublishedAt: opts.saintPublishedAt,
    });
  }
  const logs: Array<{ eventName: string }> = [];
  const upsert = vi.fn(
    async ({
      where,
      create,
    }: {
      where: { memoryType_memoryKey: { memoryKey: string } };
      create: { memoryValue: unknown };
    }) => {
      memory.set(where.memoryType_memoryKey.memoryKey, create.memoryValue);
      return {};
    },
  );
  const prisma = {
    contentGoal: {
      findMany: async ({ where }: { where: { gapCount: { gte: number } } }) =>
        goals.filter((g) => g.gapCount >= where.gapCount.gte),
    },
    adminWorkerPackageArtifact: { count: async () => 0 },
    adminWorkerMemory: {
      findUnique: async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
        const v = memory.get(where.memoryType_memoryKey.memoryKey);
        return v ? { memoryValue: v } : null;
      },
      findMany: async ({ where }: { where: { memoryKey: { in: string[] } } }) =>
        where.memoryKey.in
          .filter((k) => memory.has(k))
          .map((k) => ({ memoryKey: k, memoryValue: memory.get(k) })),
      upsert,
    },
    adminWorkerLog: {
      create: async ({ data }: { data: { eventName: string } }) => {
        logs.push(data);
        return {};
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, memory, logs, upsert };
}

beforeEach(() => {
  for (const k of [
    "ADMIN_WORKER_CAMPAIGN_MIN_GAP",
    "ADMIN_WORKER_CAMPAIGN_STRUCTURED_WEIGHT",
    "ADMIN_WORKER_CAMPAIGN_MAX_SURGE_HOURS",
    "ADMIN_WORKER_CAMPAIGN_COOLDOWN_HOURS",
  ]) {
    delete process.env[k];
  }
});

describe("campaign target — weighted by the channel that can close the gap", () => {
  it("does not surge the web pipeline on a type its structured ingestor is growing", async () => {
    // SAINT's 7,203 gap counts as ~720 while Wikidata publishes saints: below
    // the 1,000 campaign threshold, so the normal rotation runs instead.
    const { prisma } = fakePrisma([SAINT, PRAYER], { saintPublishedAt: T0 - HOUR });
    const s = await evaluateMajorGoalCampaign(prisma, { nowMs: T0 });
    expect(s.phase).toBe("NORMAL");
    expect(s.majorType).toBeNull();
  });

  it("prefers a web-only gap over a bigger one the structured lane is closing", async () => {
    const { prisma } = fakePrisma([SAINT, CHURCH_DOCUMENT], { saintPublishedAt: T0 - HOUR });
    const s = await evaluateMajorGoalCampaign(prisma, { nowMs: T0 });
    expect(s.phase).toBe("SURGE");
    expect(s.majorType).toBe("CHURCH_DOCUMENT");
    expect(s.weightedGap).toBe(4_500);
  });

  it("counts the full gap again once the structured channel has gone quiet", async () => {
    const quiet = T0 - STRUCTURED_PRODUCTIVE_WINDOW_MS - HOUR;
    const { prisma } = fakePrisma([SAINT, CHURCH_DOCUMENT], { saintPublishedAt: quiet });
    const s = await evaluateMajorGoalCampaign(prisma, { nowMs: T0 });
    expect(s.majorType).toBe("SAINT");
    expect(s.weightedGap).toBe(7_203);
  });

  it("the discount is tunable", async () => {
    process.env.ADMIN_WORKER_CAMPAIGN_STRUCTURED_WEIGHT = "1";
    const { prisma } = fakePrisma([SAINT, CHURCH_DOCUMENT], { saintPublishedAt: T0 - HOUR });
    expect((await evaluateMajorGoalCampaign(prisma, { nowMs: T0 })).majorType).toBe("SAINT");
  });
});

describe("campaign time box", () => {
  it("cools a type down after its run and hands the pipeline to the next goal", async () => {
    const { prisma, logs } = fakePrisma([SAINT, CHURCH_DOCUMENT]);

    const start = await evaluateMajorGoalCampaign(prisma, { record: true, nowMs: T0 });
    expect(start.majorType).toBe("SAINT");

    const midway = await evaluateMajorGoalCampaign(prisma, { record: true, nowMs: T0 + 5 * HOUR });
    expect(midway.majorType).toBe("SAINT");

    const capped = await evaluateMajorGoalCampaign(prisma, {
      record: true,
      nowMs: T0 + 6 * HOUR + 1,
    });
    expect(capped.majorType).toBe("CHURCH_DOCUMENT");
    expect(capped.coolingDown).toEqual(["SAINT"]);
    expect(logs.filter((l) => l.eventName === "major_goal_campaign_capped")).toHaveLength(1);

    // Still cooling an hour later; no second cap log.
    const later = await evaluateMajorGoalCampaign(prisma, { record: true, nowMs: T0 + 7 * HOUR });
    expect(later.majorType).toBe("CHURCH_DOCUMENT");
    expect(logs.filter((l) => l.eventName === "major_goal_campaign_capped")).toHaveLength(1);

    // CHURCH_DOCUMENT's own run ends six hours after it began; SAINT is back.
    const back = await evaluateMajorGoalCampaign(prisma, {
      record: true,
      nowMs: T0 + 12 * HOUR + 2,
    });
    expect(back.majorType).toBe("SAINT");
    expect(back.coolingDown).toEqual(["CHURCH_DOCUMENT"]);
  });

  it("goes NORMAL while the only campaign-sized goal cools down", async () => {
    const { prisma } = fakePrisma([SAINT, PRAYER]);
    await evaluateMajorGoalCampaign(prisma, { record: true, nowMs: T0 });
    const s = await evaluateMajorGoalCampaign(prisma, { record: true, nowMs: T0 + 6 * HOUR });
    expect(s.phase).toBe("NORMAL");
    expect(s.coolingDown).toEqual(["SAINT"]);
    const resumed = await evaluateMajorGoalCampaign(prisma, {
      record: true,
      nowMs: T0 + 12 * HOUR + 1,
    });
    expect(resumed.majorType).toBe("SAINT");
  });

  it("only the recording caller writes; others apply the same cap read-only", async () => {
    const { prisma, upsert } = fakePrisma([SAINT, CHURCH_DOCUMENT]);
    await evaluateMajorGoalCampaign(prisma, { record: true, nowMs: T0 });
    expect(upsert).toHaveBeenCalledTimes(1);

    // Same state on the next pass: nothing to write.
    await evaluateMajorGoalCampaign(prisma, { record: true, nowMs: T0 + HOUR });
    expect(upsert).toHaveBeenCalledTimes(1);

    // A read-only caller past the cap sees the hand-over without persisting it.
    const view = await evaluateMajorGoalCampaign(prisma, { nowMs: T0 + 6 * HOUR + 1 });
    expect(view.majorType).toBe("CHURCH_DOCUMENT");
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("the run length is tunable", async () => {
    process.env.ADMIN_WORKER_CAMPAIGN_MAX_SURGE_HOURS = "2";
    const { prisma } = fakePrisma([SAINT, CHURCH_DOCUMENT]);
    await evaluateMajorGoalCampaign(prisma, { record: true, nowMs: T0 });
    const s = await evaluateMajorGoalCampaign(prisma, { record: true, nowMs: T0 + 2 * HOUR });
    expect(s.majorType).toBe("CHURCH_DOCUMENT");
  });
});

describe("productiveStructuredTypes", () => {
  it("lists the types whose ingestor published within the window", async () => {
    const { prisma, memory } = fakePrisma([], { saintPublishedAt: T0 - HOUR });
    memory.set("structured-cursor:wikidata-popes", {
      offset: 0,
      lastPublishedAt: T0 - STRUCTURED_PRODUCTIVE_WINDOW_MS - 1,
    });
    memory.set("structured-cursor:wikidata-doctors", { offset: 0, lastPublishedAt: null });
    expect([...(await productiveStructuredTypes(prisma, T0))]).toEqual(["SAINT"]);
  });

  it("is fail-open: an unreadable memory discounts nothing", async () => {
    const prisma = {
      adminWorkerMemory: {
        findMany: async () => {
          throw new Error("P2024");
        },
      },
    } as unknown as PrismaClient;
    expect((await productiveStructuredTypes(prisma, T0)).size).toBe(0);
  });
});

describe("the structured lane stamps lastPublishedAt", () => {
  const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
  let savedSkip: string | undefined;
  beforeEach(() => {
    savedSkip = process.env[SKIP];
    delete process.env[SKIP];
  });
  afterEach(() => {
    if (savedSkip === undefined) delete process.env[SKIP];
    else process.env[SKIP] = savedSkip;
  });

  function pope(qid: string, label: string): SparqlBinding {
    return {
      pope: { type: "uri", value: `http://www.wikidata.org/entity/${qid}` },
      popeLabel: { type: "literal", value: label },
      startYear: { type: "literal", value: "1000" },
    };
  }

  function cursorPrisma(previous?: Record<string, unknown>) {
    const saved: Array<Record<string, unknown>> = [];
    const prisma = {
      adminWorkerMemory: {
        findUnique: async ({
          where,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
        }) =>
          where.memoryType_memoryKey.memoryKey === "structured-cursor:wikidata-popes" && previous
            ? { memoryValue: previous }
            : null,
        upsert: async ({ create }: { create: { memoryValue: Record<string, unknown> } }) => {
          saved.push(create.memoryValue);
          return {};
        },
      },
      publishedContent: { findMany: async () => [], count: async () => 0 },
      checklistItem: { findFirst: async () => null, create: async () => ({ id: "ci" }) },
      adminWorkerLog: { create: async () => ({}) },
    } as unknown as PrismaClient;
    return { prisma, saved };
  }

  it("on a run that published, and keeps the previous stamp otherwise", async () => {
    vi.mocked(runSparql).mockResolvedValueOnce([pope("Q1", "Linus")]);
    const before = Date.now();
    const published = cursorPrisma();
    await runStructuredIngest(published.prisma, { contentType: "POPE", batch: 5 });
    const stamp = published.saved.at(-1)?.lastPublishedAt as number;
    expect(stamp).toBeGreaterThanOrEqual(before);

    vi.mocked(runSparql).mockResolvedValueOnce([]);
    const idle = cursorPrisma({ offset: 0, lastPublishedAt: 12345 });
    await runStructuredIngest(idle.prisma, { contentType: "POPE", batch: 5 });
    expect(idle.saved.at(-1)?.lastPublishedAt).toBe(12345);
  });
});

afterEach(() => {
  vi.mocked(runSparql).mockReset();
});
