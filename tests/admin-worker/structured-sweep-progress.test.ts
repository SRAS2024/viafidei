/**
 * The structured ingest must keep walking its corpus — the 2026-10-31 SAINT
 * livelock — and must do it politely. These tests pin:
 *   - a barren page (rows came back, none publishable) still ADVANCES the
 *     cursor, and the page size the enumeration returned is recorded as
 *     `lastPageSize` (the only end-of-corpus evidence self-maintenance reads);
 *   - the per-type page size (`ADMIN_WORKER_STRUCTURED_BATCH_SAINT`) and its
 *     clamp to what the ingestor can hydrate;
 *   - rows are mapped ONE AT A TIME (Wikimedia asks for serial requests);
 *   - a pass that runs out of budget, or keeps failing to reach Wikipedia,
 *     holds its page instead of skipping the rest or calling it barren;
 *   - a lease (an operator booster sweeping the same corpus) makes the worker
 *     step aside, and a booster's own cursor never moves the worker's.
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
vi.mock("@/lib/admin-worker/logs", () => ({ writeAdminWorkerLog: vi.fn(async () => undefined) }));

import type { PrismaClient } from "@prisma/client";

import {
  readStructuredCursor,
  rewindStructuredCursor,
  runStructuredIngest,
  structuredBatchFor,
  WIKIPEDIA_FAILURE_STREAK_LIMIT,
} from "@/lib/admin-worker/structured/ingest";
import { ingestorFor } from "@/lib/admin-worker/structured/ingestors";
import { leaseKey } from "@/lib/admin-worker/structured/lease";
import { runSparql, type SparqlBinding } from "@/lib/admin-worker/structured/wikidata";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import { writeAdminWorkerLog } from "@/lib/admin-worker/logs";

const mockedSparql = vi.mocked(runSparql);
const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);
const mockedPublish = vi.mocked(runPublishOrchestrator);

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
const SAINT_BATCH = "ADMIN_WORKER_STRUCTURED_BATCH_SAINT";
let savedSkip: string | undefined;
let savedBatch: string | undefined;

beforeEach(() => {
  savedSkip = process.env[SKIP];
  savedBatch = process.env[SAINT_BATCH];
  delete process.env[SKIP];
  delete process.env[SAINT_BATCH];
  mockedSparql.mockReset();
  mockedSummary.mockReset();
  mockedSummary.mockResolvedValue(null);
  mockedPublish.mockReset();
  mockedPublish.mockResolvedValue({ kind: "published" } as never);
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
  if (savedBatch === undefined) delete process.env[SAINT_BATCH];
  else process.env[SAINT_BATCH] = savedBatch;
  vi.restoreAllMocks();
});

const WD = "http://www.wikidata.org/entity/";

function pope(qid: string, label: string): SparqlBinding {
  const b: SparqlBinding = {};
  const fields = {
    pope: `${WD}${qid}`,
    popeLabel: label,
    startYear: "1000",
    article: `https://en.wikipedia.org/wiki/Pope_${label.replace(/\s+/g, "_")}`,
  };
  for (const [k, v] of Object.entries(fields)) b[k] = { type: "literal", value: v };
  return b;
}

/** A Prisma double whose memory rows are a plain Map, so passes can chain. */
function makePrisma(memory = new Map<string, Record<string, unknown>>()) {
  const prisma = {
    adminWorkerMemory: {
      findUnique: vi.fn(
        async (args: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
          const v = memory.get(args.where.memoryType_memoryKey.memoryKey);
          return v ? { memoryValue: v, lastUsedAt: null } : null;
        },
      ),
      findMany: vi.fn(async (args: { where: { memoryKey?: { startsWith?: string } } }) => {
        const prefix = args.where.memoryKey?.startsWith;
        return [...memory]
          .filter(([k]) => (prefix ? k.startsWith(prefix) : false))
          .map(([memoryKey, memoryValue]) => ({ memoryKey, memoryValue }));
      }),
      upsert: vi.fn(
        async (args: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          create: { memoryValue: Record<string, unknown> };
        }) => {
          memory.set(args.where.memoryType_memoryKey.memoryKey, args.create.memoryValue);
          return {};
        },
      ),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
    },
    publishedContent: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    contentGoal: { findUnique: vi.fn(async () => null) },
    checklistItem: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "ci1" })),
    },
    adminWorkerLog: { create: vi.fn(async () => ({})) },
  } as unknown as PrismaClient;
  return { prisma, memory };
}

/** `count` rows whose labels are bare QIDs: every one rejects, without any fetch. */
function barrenPage(start: number, count: number): SparqlBinding[] {
  return Array.from({ length: count }, (_, i) => pope(`Q${start + i}`, `Q${start + i}`));
}

describe("barren pages advance the cursor (the SAINT livelock)", () => {
  it("walks through consecutive barren pages and records each page's size", async () => {
    const { prisma, memory } = makePrisma();
    mockedSparql
      .mockResolvedValueOnce(barrenPage(1, 3))
      .mockResolvedValueOnce(barrenPage(4, 3))
      .mockResolvedValueOnce(barrenPage(7, 3));

    for (let pass = 0; pass < 3; pass += 1) {
      await runStructuredIngest(prisma, { contentType: "POPE", batch: 3 });
    }

    const cursor = memory.get("structured-cursor:wikidata-popes")!;
    expect(cursor.offset).toBe(9); // never rewound, never stuck
    expect(cursor.zeroStreak).toBe(3); // the dampener still counts barren pages…
    expect(cursor.lastPageSize).toBe(3); // …but the page was FULL: not the end
  });

  it("records a short last page and wraps with a rest, as before", async () => {
    const { prisma, memory } = makePrisma(
      new Map([["structured-cursor:wikidata-popes", { offset: 6, zeroStreak: 2 }]]),
    );
    mockedSparql.mockResolvedValueOnce(barrenPage(7, 1));

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 3 });

    expect(out.endOfCorpus).toBe(true);
    expect(out.nextOffset).toBe(0);
    const cursor = memory.get("structured-cursor:wikidata-popes")!;
    expect(cursor.offset).toBe(0);
    expect(cursor.lastPageSize).toBe(1);
    expect(cursor.exhaustedUntil as number).toBeGreaterThan(Date.now());
  });
});

describe("page size", () => {
  it("lets SAINT have its own page size, clamped to the hydration ceiling", () => {
    const saint = ingestorFor("SAINT")!;
    const pope = ingestorFor("POPE")!;
    process.env[SAINT_BATCH] = "150";
    expect(structuredBatchFor(saint)).toBe(150);
    // Another type is untouched by SAINT's variable.
    expect(structuredBatchFor(pope)).toBe(structuredBatchFor(pope, undefined));
    expect(structuredBatchFor(pope)).not.toBe(150);
    process.env[SAINT_BATCH] = "5000";
    expect(structuredBatchFor(saint)).toBe(200);
    // An explicit batch wins, and is clamped the same way.
    expect(structuredBatchFor(saint, 40)).toBe(40);
    expect(structuredBatchFor(saint, 999)).toBe(200);
  });
});

describe("serial mapping", () => {
  it("never has two Wikipedia fetches in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    mockedSummary.mockImplementation(async (url: string) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return { extract: "A pope.", url, lang: "en" };
    });
    mockedSparql.mockResolvedValueOnce(
      Array.from({ length: 6 }, (_, i) => pope(`Q${100 + i}`, `Fresh ${i}`)),
    );
    const { prisma } = makePrisma();

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 6 });

    expect(out.published).toBe(6);
    expect(mockedSummary).toHaveBeenCalledTimes(6);
    expect(peak).toBe(1);
  });

  it("stops fetching once the publish limit is reached", async () => {
    mockedSummary.mockImplementation(async (url: string) => ({
      extract: "A pope.",
      url,
      lang: "en",
    }));
    mockedSparql.mockResolvedValueOnce(
      Array.from({ length: 6 }, (_, i) => pope(`Q${200 + i}`, `Fresh ${i}`)),
    );
    const { prisma, memory } = makePrisma();

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 6, limit: 2 });

    expect(out.published).toBe(2);
    // The old concurrent mapper fetched all six and threw four away.
    expect(mockedSummary).toHaveBeenCalledTimes(2);
    expect(memory.get("structured-cursor:wikidata-popes")!.offset).toBe(0); // page held
  });
});

describe("a page that cannot be finished is held, not skipped", () => {
  it("holds the page when the pass budget is spent, without calling it barren", async () => {
    mockedSparql.mockResolvedValueOnce(barrenPage(1, 3));
    const { prisma, memory } = makePrisma(
      new Map([["structured-cursor:wikidata-popes", { offset: 30, zeroStreak: 1 }]]),
    );

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 3, budgetMs: 0 });

    expect(out.pageHeld).toBe(true);
    expect(out.pageHeldReason).toBe("budget");
    expect(out.skipped).toBe(0); // nothing mapped
    const cursor = memory.get("structured-cursor:wikidata-popes")!;
    expect(cursor.offset).toBe(30);
    expect(cursor.zeroStreak).toBe(1);
  });

  it("holds the page when Wikipedia keeps failing", async () => {
    // A pope without a summary still publishes (the summary is optional for
    // POPE), so use the SAINT mapper's hard dependency on the article instead:
    // simulate it with a mapper whose summary read got no answer (a 503 /
    // timeout lands in the row's read ledger) and that reports
    // `wikipedia_fetch_failed`.
    const popeIngestor = ingestorFor("POPE")!;
    const spy = vi.spyOn(popeIngestor, "map").mockImplementation(async (_row, ctx) => {
      ctx.reads?.unread.push("https://en.wikipedia.org/api/rest_v1/page/summary/Down");
      return { rejected: true, code: "wikipedia_fetch_failed" };
    });
    const rows = Array.from({ length: 10 }, (_, i) => pope(`Q${300 + i}`, `Down ${i}`));
    mockedSparql.mockResolvedValueOnce(rows);
    const { prisma, memory } = makePrisma(
      new Map([["structured-cursor:wikidata-popes", { offset: 40, zeroStreak: 0 }]]),
    );

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 10 });

    expect(spy).toHaveBeenCalledTimes(WIKIPEDIA_FAILURE_STREAK_LIMIT);
    expect(out.pageHeld).toBe(true);
    expect(out.pageHeldReason).toBe("source_failures");
    const cursor = memory.get("structured-cursor:wikidata-popes")!;
    expect(cursor.offset).toBe(40);
    expect(cursor.zeroStreak).toBe(0);
  });

  it("walks past dead articles that ANSWERED: a 404 is not an outage", async () => {
    // A REST summary that answered 404 (a dead sitelink) or came back empty also
    // ends in `wikipedia_fetch_failed`, a code never remembered. Counting it as
    // an outage held any page with five of them in a row on every pass, for
    // ever: the cursor livelock again, by another road.
    const popeIngestor = ingestorFor("POPE")!;
    const spy = vi
      .spyOn(popeIngestor, "map")
      .mockResolvedValue({ rejected: true, code: "wikipedia_fetch_failed" });
    const rows = Array.from({ length: 10 }, (_, i) => pope(`Q${400 + i}`, `Gone ${i}`));
    mockedSparql.mockResolvedValueOnce(rows);
    const { prisma, memory } = makePrisma(
      new Map([["structured-cursor:wikidata-popes", { offset: 40, zeroStreak: 0 }]]),
    );

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 10 });

    expect(spy).toHaveBeenCalledTimes(10);
    expect(out.pageHeld).toBe(false);
    expect(out.skipReasons).toEqual({ wikipedia_fetch_failed: 10 });
    expect(memory.get("structured-cursor:wikidata-popes")!.offset).toBe(50);
  });
});

describe("leases and booster cursors", () => {
  it("steps aside while another process holds the ingestor's lease", async () => {
    const { prisma } = makePrisma(
      new Map([
        [
          leaseKey("wikidata-popes"),
          { holder: "booster:test", until: Date.now() + 60_000 } as Record<string, unknown>,
        ],
      ]),
    );

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 3 });

    expect(out.leasedTo).toBe("booster:test");
    expect(mockedSparql).not.toHaveBeenCalled();
  });

  it("lets the lease holder run, on its own cursor, without moving the worker's", async () => {
    mockedSparql.mockResolvedValueOnce(barrenPage(1, 3));
    const { prisma, memory } = makePrisma(
      new Map([
        [
          leaseKey("wikidata-popes"),
          { holder: "booster:test", until: Date.now() + 60_000 } as Record<string, unknown>,
        ],
        ["structured-cursor:wikidata-popes", { offset: 120, zeroStreak: 0 }],
      ]),
    );

    const out = await runStructuredIngest(prisma, {
      contentType: "POPE",
      batch: 3,
      leaseHolder: "booster:test",
      cursorId: "wikidata-popes@booster",
    });

    expect(out.leasedTo).toBeNull();
    expect(memory.get("structured-cursor:wikidata-popes@booster")!.offset).toBe(3);
    expect(memory.get("structured-cursor:wikidata-popes")!.offset).toBe(120);
  });

  it("names the booster cursor in a failed pass's log row, so it never reads as the worker", async () => {
    // sweep.ts warns that the worker ignores the lease when it finds a row
    // starting "Structured-knowledge ingest (<ingestor>):" — a booster's own
    // source-failure row must not look like that.
    mockedSparql.mockResolvedValueOnce(null);
    const { prisma } = makePrisma();
    const log = vi.mocked(writeAdminWorkerLog);
    log.mockClear();

    const out = await runStructuredIngest(prisma, {
      contentType: "POPE",
      batch: 3,
      cursorId: "wikidata-popes@booster",
    });

    expect(out.sourceFailure).not.toBeNull();
    const messages = log.mock.calls.map((c) => c[1].message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(
      /^Structured-knowledge ingest \(wikidata-popes via wikidata-popes@booster\): /,
    );
  });

  it("is never PICKED while leased, so the lane serves the other ingestors", async () => {
    mockedSparql.mockResolvedValue([]);
    // Every type is equally far from its goal, so the registry order decides —
    // POPE first. Leasing it must hand the pass to the next one.
    const { prisma } = makePrisma(
      new Map([
        [
          leaseKey("wikidata-popes"),
          { holder: "booster:test", until: Date.now() + 60_000 } as Record<string, unknown>,
        ],
      ]),
    );
    const unleased = await runStructuredIngest(makePrisma().prisma, { batch: 3 });
    expect(unleased.ingestorId).toBe("wikidata-popes");

    const out = await runStructuredIngest(prisma, { batch: 3 });

    expect(out.ingestorId).not.toBe("wikidata-popes");
    expect(out.leasedTo).toBeNull();
  });

  it("ignores an expired lease", async () => {
    mockedSparql.mockResolvedValueOnce(barrenPage(1, 3));
    const { prisma } = makePrisma(
      new Map([
        [
          leaseKey("wikidata-popes"),
          { holder: "booster:test", until: Date.now() - 1 } as Record<string, unknown>,
        ],
      ]),
    );

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 3 });

    expect(out.leasedTo).toBeNull();
    expect(mockedSparql).toHaveBeenCalled();
  });
});

describe("booster cursor helpers", () => {
  it("says when a cursor is resting, without reading a page", async () => {
    const until = Date.now() + 60_000;
    const { prisma } = makePrisma(
      new Map([["structured-cursor:wikidata-popes@booster", { offset: 0, exhaustedUntil: until }]]),
    );

    const out = await runStructuredIngest(prisma, {
      contentType: "POPE",
      batch: 3,
      cursorId: "wikidata-popes@booster",
    });

    expect(out.restingUntil).toBe(until);
    expect(mockedSparql).not.toHaveBeenCalled();
  });

  it("rewinds a booster cursor, or only wakes it, and never moves the worker's", async () => {
    const until = Date.now() + 60_000;
    const { prisma, memory } = makePrisma(
      new Map([
        [
          "structured-cursor:wikidata-popes@booster",
          { offset: 600, exhaustedUntil: until, failures: 12, lastPageSize: 3 },
        ],
        ["structured-cursor:wikidata-popes", { offset: 90 }],
      ]),
    );

    await rewindStructuredCursor(prisma, "wikidata-popes@booster", { keepOffset: true });
    expect(await readStructuredCursor(prisma, "wikidata-popes@booster")).toMatchObject({
      offset: 600,
      exhaustedUntil: null,
    });
    expect(memory.get("structured-cursor:wikidata-popes@booster")!.failures).toBe(0);

    await rewindStructuredCursor(prisma, "wikidata-popes@booster");
    expect(await readStructuredCursor(prisma, "wikidata-popes@booster")).toMatchObject({
      offset: 0,
      exhaustedUntil: null,
      lastPageSize: null,
    });

    await expect(rewindStructuredCursor(prisma, "wikidata-popes")).rejects.toThrow(/own cursor/);
    expect(memory.get("structured-cursor:wikidata-popes")!.offset).toBe(90);
  });
});
