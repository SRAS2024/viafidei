/**
 * Per-entity rejection memory for the structured ingest (reject-memory.ts).
 *
 * Before: only LIVE rows were skipped before mapping, so every re-sweep
 * re-mapped the same rejected entities (Wikipedia summary + infobox fetches,
 * same verdict) — 40 of 100 saints per page in production. Pinned here:
 *   - a rejection that describes the entity is remembered per (ingestor, QID)
 *     and the entity is not mapped again until its backoff expires;
 *   - the wait doubles per repeat and is capped; transient codes are never
 *     remembered; a publish (or the entity turning up live) clears the memo;
 *   - a page of live rows and deferred rejections is skipped like a live page,
 *     and walking past remembered rejections never counts as a barren page;
 *   - the memory is bounded: TTL prune plus a hard cap, at most once a day.
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
  runPublishOrchestrator: vi.fn(),
}));

import type { PrismaClient } from "@prisma/client";

import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import { runStructuredIngest } from "@/lib/admin-worker/structured/ingest";
import {
  MAX_REJECTION_MEMOS,
  REJECTION_BACKOFF_BASE_MS,
  REJECTION_BACKOFF_MAX_MS,
  REJECTION_MEMORY_TTL_MS,
  isRememberedRejection,
  pruneRejectionMemos,
  recordRejectionOutcomes,
  rejectionBackoffMs,
  rejectionMemoKey,
  resetRejectionMemoryPruneClock,
  type RejectionMemo,
} from "@/lib/admin-worker/structured/reject-memory";
import { runSparql, type SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const mockedSparql = vi.mocked(runSparql);
const mockedPublish = vi.mocked(runPublishOrchestrator);
const DAY = 24 * 60 * 60 * 1000;
const WD = "http://www.wikidata.org/entity/";

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;

// ── An in-memory AdminWorkerMemory + the few other tables the ingest reads ──

interface MemoryRow {
  id: string;
  memoryType: string;
  memoryKey: string;
  memoryValue: unknown;
  lastUsedAt: Date | null;
}

type KeyFilter = { in?: string[]; startsWith?: string };
type MemoryWhere = {
  memoryType?: string;
  memoryKey?: KeyFilter;
  lastUsedAt?: { lt: Date };
  id?: { in: string[] };
};

function matches(row: MemoryRow, where: MemoryWhere): boolean {
  if (where.memoryType && row.memoryType !== where.memoryType) return false;
  if (where.memoryKey?.in && !where.memoryKey.in.includes(row.memoryKey)) return false;
  if (where.memoryKey?.startsWith && !row.memoryKey.startsWith(where.memoryKey.startsWith)) {
    return false;
  }
  if (where.lastUsedAt && !(row.lastUsedAt && row.lastUsedAt < where.lastUsedAt.lt)) return false;
  if (where.id?.in && !where.id.in.includes(row.id)) return false;
  return true;
}

function fakePrisma(live: Array<{ slug: string; title: string; sourceRef?: string | null }> = []) {
  const memory = new Map<string, MemoryRow>();
  let seq = 0;
  const put = (key: string, value: unknown, lastUsedAt: Date | null = new Date()) => {
    const existing = memory.get(key);
    memory.set(key, {
      id: existing?.id ?? `m${++seq}`,
      memoryType: "GENERIC",
      memoryKey: key,
      memoryValue: value,
      lastUsedAt,
    });
  };
  const prisma = {
    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
          const r = memory.get(where.memoryType_memoryKey.memoryKey);
          return r ? { memoryValue: r.memoryValue, lastUsedAt: r.lastUsedAt } : null;
        },
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          create: { memoryValue: unknown };
        }) => {
          put(where.memoryType_memoryKey.memoryKey, create.memoryValue);
          return {};
        },
      ),
      findMany: vi.fn(
        async ({ where, take }: { where: MemoryWhere; take?: number; orderBy?: unknown }) =>
          [...memory.values()]
            .filter((r) => matches(r, where))
            .sort((a, b) => (a.lastUsedAt?.getTime() ?? 0) - (b.lastUsedAt?.getTime() ?? 0))
            .slice(0, take ?? Infinity)
            .map((r) => ({ ...r })),
      ),
      deleteMany: vi.fn(async ({ where }: { where: MemoryWhere }) => {
        let count = 0;
        for (const [key, row] of memory) {
          if (matches(row, where)) {
            memory.delete(key);
            count += 1;
          }
        }
        return { count };
      }),
      createMany: vi.fn(
        async ({
          data,
        }: {
          data: Array<{ memoryKey: string; memoryValue: unknown; lastUsedAt: Date }>;
        }) => {
          for (const d of data) put(d.memoryKey, d.memoryValue, d.lastUsedAt);
          return { count: data.length };
        },
      ),
      count: vi.fn(
        async ({ where }: { where: MemoryWhere }) =>
          [...memory.values()].filter((r) => matches(r, where)).length,
      ),
    },
    publishedContent: {
      findMany: vi.fn(async () => live),
      count: vi.fn(async () => 0),
    },
    checklistItem: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "ci1" })),
    },
    adminWorkerLog: { create: vi.fn(async () => ({})) },
  };
  return { prisma: prisma as unknown as PrismaClient, memory, put, live };
}

function pope(qid: string, label: string, over: Record<string, string | undefined> = {}) {
  const fields: Record<string, string | undefined> = {
    pope: `${WD}${qid}`,
    popeLabel: label,
    startYear: "1000",
    ...over,
  };
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) b[k] = { type: "literal", value: v };
  }
  return b;
}

const memoOf = (memory: Map<string, MemoryRow>, qid: string) =>
  memory.get(rejectionMemoKey("wikidata-popes", qid))?.memoryValue as RejectionMemo | undefined;

beforeEach(() => {
  savedSkip = process.env[SKIP];
  delete process.env[SKIP];
  resetRejectionMemoryPruneClock();
  mockedSparql.mockReset();
  mockedPublish.mockReset();
  mockedPublish.mockImplementation(async (_prisma, input) => {
    if (input.slug === "pope-clement-i") throw new Error("connection reset");
    return {
      kind: "published",
      publishedContentId: `pc-${input.slug}`,
      slug: input.slug,
      route: `/popes/${input.slug}`,
      reason: "ok",
    };
  });
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
  vi.useRealTimers();
});

describe("rejection backoff", () => {
  it("starts at a day, doubles, and caps at thirty days", () => {
    expect(rejectionBackoffMs(1)).toBe(REJECTION_BACKOFF_BASE_MS);
    expect(rejectionBackoffMs(2)).toBe(2 * DAY);
    expect(rejectionBackoffMs(5)).toBe(16 * DAY);
    expect(rejectionBackoffMs(6)).toBe(REJECTION_BACKOFF_MAX_MS);
    expect(rejectionBackoffMs(50)).toBe(REJECTION_BACKOFF_MAX_MS);
  });

  it("never remembers a code that says nothing about the entity", () => {
    for (const code of [
      "wikipedia_fetch_failed",
      "map_threw",
      "duplicate_in_page",
      "publish_threw",
    ] as const) {
      expect(isRememberedRejection(code)).toBe(false);
    }
    expect(isRememberedRejection("feast_uncorroborated")).toBe(true);
    expect(isRememberedRejection("antipope_excluded")).toBe(true);
    expect(isRememberedRejection("publish_rejected")).toBe(true);
  });
});

describe("runStructuredIngest — rejected entities are not re-mapped every sweep", () => {
  const page = () => [
    pope("Q1", "Linus"),
    pope("Q2", "Antipope Felix V"),
    pope("Q3", "Cletus", { startYear: undefined }),
    pope("Q4", "Clement I"),
  ];

  it("remembers entity rejections, defers them until due, then extends the wait", async () => {
    const t0 = Date.parse("2026-10-31T06:00:00Z");
    vi.useFakeTimers({ now: t0, toFake: ["Date"] });
    mockedSparql.mockResolvedValue(page());
    const { prisma, memory, live } = fakePrisma();

    const first = await runStructuredIngest(prisma, { contentType: "POPE", batch: 4 });
    expect(first.published).toBe(1); // Linus
    expect(first.skipReasons).toMatchObject({
      antipope_excluded: 1,
      missing_required_field: 1,
      publish_threw: 1,
    });
    expect(first.rejectionsRemembered).toBe(2);
    expect(memoOf(memory, "Q2")).toMatchObject({
      code: "antipope_excluded",
      attempts: 1,
      nextAttemptAt: t0 + DAY,
    });
    expect(memoOf(memory, "Q3")?.code).toBe("missing_required_field");
    // A thrown publish says nothing about the entity: retried next sweep.
    expect(memoOf(memory, "Q4")).toBeUndefined();

    // Re-sweep an hour later: Linus is live, Felix and Cletus wait, only
    // Clement I is mapped and attempted again.
    live.push({
      slug: "pope-linus",
      title: "Pope Linus",
      sourceRef: `https://www.wikidata.org/wiki/Q1`,
    });
    vi.setSystemTime(t0 + 60 * 60 * 1000);
    mockedPublish.mockClear();
    const second = await runStructuredIngest(prisma, { contentType: "POPE", batch: 4 });
    expect(second.rejectionsDeferred).toBe(2);
    expect(second.alreadyPublished).toBe(1);
    expect(mockedPublish).toHaveBeenCalledTimes(1);
    expect(mockedPublish.mock.calls[0][1].slug).toBe("pope-clement-i");
    expect(second.skipReasons).toEqual({ publish_threw: 1 });

    // A day later the wait is over: mapped again, rejected again, wait doubled.
    vi.setSystemTime(t0 + DAY + 60 * 1000);
    const third = await runStructuredIngest(prisma, { contentType: "POPE", batch: 4 });
    expect(third.rejectionsDeferred).toBe(0);
    expect(memoOf(memory, "Q2")).toMatchObject({
      attempts: 2,
      nextAttemptAt: t0 + DAY + 60 * 1000 + 2 * DAY,
    });
  });

  it("clears the memo once the entity publishes", async () => {
    const t0 = Date.parse("2026-10-31T06:00:00Z");
    vi.useFakeTimers({ now: t0, toFake: ["Date"] });
    const { prisma, memory } = fakePrisma();
    mockedSparql.mockResolvedValue([pope("Q3", "Cletus", { startYear: undefined })]);
    await runStructuredIngest(prisma, { contentType: "POPE", batch: 1 });
    expect(memoOf(memory, "Q3")?.attempts).toBe(1);

    // Wikidata gained the reign start; the retry after the wait publishes.
    vi.setSystemTime(t0 + DAY + 1);
    mockedSparql.mockResolvedValue([pope("Q3", "Cletus")]);
    const res = await runStructuredIngest(prisma, { contentType: "POPE", batch: 1 });
    expect(res.published).toBe(1);
    expect(memoOf(memory, "Q3")).toBeUndefined();
  });

  it("skips a page of live rows and deferred rejections like a live page, without going barren", async () => {
    const t0 = Date.parse("2026-10-31T06:00:00Z");
    vi.useFakeTimers({ now: t0, toFake: ["Date"] });
    const { prisma, put } = fakePrisma([
      { slug: "pope-linus", title: "Pope Linus", sourceRef: `https://www.wikidata.org/wiki/Q1` },
    ]);
    put(rejectionMemoKey("wikidata-popes", "Q2"), {
      code: "antipope_excluded",
      attempts: 1,
      nextAttemptAt: t0 + DAY,
    });
    put("structured-cursor:wikidata-popes", { offset: 0, zeroStreak: 3 });
    mockedSparql
      .mockResolvedValueOnce([pope("Q1", "Linus"), pope("Q2", "Antipope Felix V")])
      .mockResolvedValueOnce([pope("Q5", "Evaristus")]);

    const res = await runStructuredIngest(prisma, { contentType: "POPE", batch: 2 });

    expect(res.pagesSkipped).toBe(1);
    expect(res.rejectionsDeferred).toBe(1);
    expect(res.published).toBe(1);
    expect(mockedPublish).toHaveBeenCalledTimes(1);
  });

  it("a pass that only meets known rejections leaves the empty streak alone", async () => {
    const t0 = Date.parse("2026-10-31T06:00:00Z");
    vi.useFakeTimers({ now: t0, toFake: ["Date"] });
    const { prisma, put, memory } = fakePrisma();
    put(rejectionMemoKey("wikidata-popes", "Q2"), {
      code: "antipope_excluded",
      attempts: 3,
      nextAttemptAt: t0 + DAY,
    });
    put("structured-cursor:wikidata-popes", { offset: 0, zeroStreak: 2 });
    mockedSparql.mockResolvedValue([pope("Q2", "Antipope Felix V")]);

    const res = await runStructuredIngest(prisma, { contentType: "POPE", batch: 5 });

    expect(res.rejectionsDeferred).toBe(1);
    expect(mockedPublish).not.toHaveBeenCalled();
    const cursor = memory.get("structured-cursor:wikidata-popes")?.memoryValue as {
      zeroStreak: number;
    };
    expect(cursor.zeroStreak).toBe(2);
  });
});

describe("recordRejectionOutcomes", () => {
  it("writes with two statements and skips transient codes", async () => {
    const { prisma, memory } = fakePrisma();
    const written = await recordRejectionOutcomes(prisma, "wikidata-saints", {
      rejected: [
        { qid: "Q10", code: "feast_uncorroborated", detail: "x".repeat(500) },
        { qid: "Q11", code: "wikipedia_fetch_failed" },
      ],
      cleared: [],
      prior: new Map(),
      nowMs: 1_000,
    });
    expect(written).toBe(1);
    const memo = memory.get(rejectionMemoKey("wikidata-saints", "Q10"))
      ?.memoryValue as RejectionMemo;
    expect(memo).toMatchObject({ code: "feast_uncorroborated", attempts: 1 });
    expect(memo.detail?.length).toBeLessThanOrEqual(120);
    expect(memory.has(rejectionMemoKey("wikidata-saints", "Q11"))).toBe(false);
    const api = (
      prisma as unknown as { adminWorkerMemory: Record<string, ReturnType<typeof vi.fn>> }
    ).adminWorkerMemory;
    expect(api.deleteMany).toHaveBeenCalledTimes(1);
    expect(api.createMany).toHaveBeenCalledTimes(1);
    expect(api.upsert).not.toHaveBeenCalled();
  });

  it("is a no-op when nothing was rejected or cleared", async () => {
    const { prisma } = fakePrisma();
    expect(
      await recordRejectionOutcomes(prisma, "wikidata-saints", {
        rejected: [],
        cleared: ["Q1"],
        prior: new Map(),
      }),
    ).toBe(0);
    const api = (
      prisma as unknown as { adminWorkerMemory: Record<string, ReturnType<typeof vi.fn>> }
    ).adminWorkerMemory;
    expect(api.deleteMany).not.toHaveBeenCalled();
  });
});

describe("pruneRejectionMemos — the memory stays bounded", () => {
  it("drops memos untouched past the TTL, keeps the rest, and only runs once a day", async () => {
    const now = Date.parse("2026-10-31T06:00:00Z");
    const { prisma, put, memory } = fakePrisma();
    put(rejectionMemoKey("wikidata-saints", "Q1"), {}, new Date(now - REJECTION_MEMORY_TTL_MS - 1));
    put(rejectionMemoKey("wikidata-saints", "Q2"), {}, new Date(now - DAY));
    put("osm-skip:osm:node/1", {}, new Date(now - 2 * REJECTION_MEMORY_TTL_MS));

    expect(await pruneRejectionMemos(prisma, { nowMs: now })).toBe(1);
    expect(memory.has(rejectionMemoKey("wikidata-saints", "Q1"))).toBe(false);
    expect(memory.has(rejectionMemoKey("wikidata-saints", "Q2"))).toBe(true);
    // Other subsystems' memory is never touched.
    expect(memory.has("osm-skip:osm:node/1")).toBe(true);

    put(rejectionMemoKey("wikidata-saints", "Q3"), {}, new Date(now - REJECTION_MEMORY_TTL_MS - 1));
    expect(await pruneRejectionMemos(prisma, { nowMs: now + 60_000 })).toBe(0);
    expect(await pruneRejectionMemos(prisma, { nowMs: now + DAY + 1 })).toBe(1);
  });

  it("enforces the hard cap, dropping the least recently touched first", async () => {
    const now = Date.parse("2026-10-31T06:00:00Z");
    const { prisma, put, memory } = fakePrisma();
    for (let i = 0; i < 5; i += 1) {
      put(rejectionMemoKey("wikidata-saints", `Q${i}`), {}, new Date(now - (5 - i) * 1000));
    }
    expect(await pruneRejectionMemos(prisma, { nowMs: now, force: true, cap: 3 })).toBe(2);
    expect([...memory.keys()].sort()).toEqual([
      rejectionMemoKey("wikidata-saints", "Q2"),
      rejectionMemoKey("wikidata-saints", "Q3"),
      rejectionMemoKey("wikidata-saints", "Q4"),
    ]);
    expect(MAX_REJECTION_MEMOS).toBeGreaterThan(10_000);
  });
});
