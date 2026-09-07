/**
 * The structured saint repair sweep re-derives status / type / title / feast
 * for ALREADY-PUBLISHED Wikidata saints through the same QID-based rules the
 * ingest now uses. These tests pin its safety contract: curated rows are never
 * touched, corrections go through the protected-update gate, an unpublish
 * happens ONLY on proof of non-Catholic veneration (and leaves a log + a
 * review row to restore from), doubt is left alone, a source failure holds
 * the cursor, and the cursor walks the corpus across passes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikidata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/structured/wikidata")>();
  return { ...actual, runSparql: vi.fn() };
});
vi.mock("@/lib/admin-worker/structured/wikipedia-infobox", () => ({
  fetchArticleInfobox: vi.fn(async () => ({})),
}));
vi.mock("@/lib/admin-worker/content-protection", () => ({
  applyProtectedContentUpdate: vi.fn(async () => ({ applied: true, kind: "enrich", reason: "" })),
}));
vi.mock("@/lib/admin-worker/human-review", () => ({
  fileHumanReview: vi.fn(async () => ({ id: "hr1" })),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import {
  SAINT_REPAIR_CURSOR_KEY,
  publishedSaintQid,
  runStructuredSaintRepair,
} from "@/lib/admin-worker/structured/saint-repair";
import { runSparql, type SparqlBinding } from "@/lib/admin-worker/structured/wikidata";
import { fetchArticleInfobox } from "@/lib/admin-worker/structured/wikipedia-infobox";
import { applyProtectedContentUpdate } from "@/lib/admin-worker/content-protection";
import { fileHumanReview } from "@/lib/admin-worker/human-review";
import { writeAdminWorkerLog } from "@/lib/admin-worker/logs";

const mockedSparql = vi.mocked(runSparql);
const mockedInfobox = vi.mocked(fetchArticleInfobox);
const mockedUpdate = vi.mocked(applyProtectedContentUpdate);
const mockedReview = vi.mocked(fileHumanReview);
const mockedLog = vi.mocked(writeAdminWorkerLog);

beforeEach(() => {
  mockedSparql.mockReset();
  mockedInfobox.mockReset();
  mockedInfobox.mockResolvedValue({});
  mockedUpdate.mockReset();
  mockedUpdate.mockResolvedValue({ applied: true, kind: "enrich", reason: "" } as never);
  mockedReview.mockReset();
  mockedReview.mockResolvedValue({ id: "hr1" });
  mockedLog.mockReset();
  mockedLog.mockResolvedValue(undefined as never);
});
afterEach(() => vi.restoreAllMocks());

const WD = "http://www.wikidata.org/entity/";

function binding(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = { type: "literal", value: v };
  return b;
}

interface Row {
  id: string;
  slug: string;
  title: string;
  payload: Record<string, unknown>;
  sourceRef: string | null;
}

function saintRow(id: string, qid: string | null, payload: Record<string, unknown>): Row {
  return {
    id,
    slug: `saint-${id}`,
    title: String(payload.title ?? payload.canonicalName ?? id),
    payload: {
      canonicalName: id,
      feastDay: "01-01",
      feastMonth: 1,
      feastDayOfMonth: 1,
      saintType: "other",
      canonizationStatus: "canonized",
      citations: qid ? [`https://www.wikidata.org/wiki/${qid}`, `https://en.wikipedia.org/wiki/${id}`] : [],
      ...payload,
    },
    sourceRef: qid ? `https://www.wikidata.org/wiki/${qid}` : null,
  };
}

function makePrisma(rows: Row[], cursor: Record<string, unknown> | null = null) {
  const update = vi.fn(async () => ({}));
  const upsert = vi.fn(async () => ({}));
  const prisma = {
    adminWorkerMemory: {
      findUnique: vi.fn(async (args: { where: { memoryType_memoryKey: { memoryKey: string } } }) =>
        args.where.memoryType_memoryKey.memoryKey === SAINT_REPAIR_CURSOR_KEY && cursor
          ? { memoryValue: cursor }
          : null,
      ),
      upsert,
    },
    publishedContent: {
      findMany: vi.fn(async (args: { where: { id?: { gt: string } }; take: number }) =>
        rows
          .filter((r) => !args.where.id || r.id > args.where.id.gt)
          .slice(0, args.take),
      ),
      update,
    },
  } as unknown as PrismaClient;
  return { prisma, update, upsert };
}

describe("publishedSaintQid", () => {
  it("reads the QID from sourceRef, then the payload, then the citations; null for curated", () => {
    expect(publishedSaintQid({ sourceRef: "https://www.wikidata.org/wiki/Q7", payload: {} })).toBe("Q7");
    expect(publishedSaintQid({ sourceRef: null, payload: { wikidataQid: "Q8" } })).toBe("Q8");
    expect(
      publishedSaintQid({ payload: { citations: ["https://x.example", "https://www.wikidata.org/wiki/Q9"] } }),
    ).toBe("Q9");
    expect(publishedSaintQid({ sourceRef: null, payload: { citations: ["https://x.example"] } })).toBeNull();
  });
});

describe("runStructuredSaintRepair", () => {
  it("corrects type / title through the protected gate, unpublishes only on PROOF, leaves doubt alone", async () => {
    const rows: Row[] = [
      // Curated (no QID) — never examined.
      saintRow("a-joseph", null, { title: "Saint Joseph" }),
      // Orthodox-only generic saint published as Catholic by the old label mapping.
      saintRow("b-nicodemus", "Q100", { canonicalName: "Nicodemus the Hagiorite" }),
      // Patrick: mislabelled "apostle" from prose, bare title.
      saintRow("c-patrick", "Q200", {
        canonicalName: "Patrick",
        saintType: "apostle",
        biography: 'Saint Patrick was a bishop known as the "Apostle of Ireland".',
      }),
      // Correct already → no-op.
      saintRow("d-rose", "Q300", { canonicalName: "Rose of Lima", title: "Saint Rose of Lima", saintType: "religious" }),
      // Generic status, no religion → doubt → untouched.
      saintRow("e-doubt", "Q400", { canonicalName: "Someone" }),
      // Not answered by Wikidata at all → unresolved.
      saintRow("f-gone", "Q500", { canonicalName: "Gone" }),
    ];
    mockedSparql.mockResolvedValue([
      binding({ s: `${WD}Q100`, label: "Nicodemus the Hagiorite", statuses: `${WD}Q43115`, religions: `${WD}Q3333484`, religionLabels: "Eastern Orthodoxy" }),
      binding({ s: `${WD}Q200`, label: "Patrick", statuses: `${WD}Q3464126`, positions: `${WD}Q29182`, died: "0461-03-17T00:00:00Z" }),
      binding({ s: `${WD}Q300`, label: "Rose of Lima", statuses: `${WD}Q3464126`, occupations: `${WD}Q191808` }),
      binding({ s: `${WD}Q400`, label: "Someone", statuses: `${WD}Q43115` }),
    ]);
    mockedUpdate.mockImplementation((async (_p: unknown, input: { contentId: string }) =>
      input.contentId === "d-rose"
        ? { applied: false, kind: "noop", reason: "no change" }
        : { applied: true, kind: "enrich", reason: "" }) as never);
    const { prisma, update, upsert } = makePrisma(rows);

    const out = await runStructuredSaintRepair(prisma, { limit: 25 });

    expect(out).toMatchObject({
      examined: 5,
      unpublished: 1,
      repaired: 1,
      unchanged: 1,
      unresolved: 2,
      completed: true,
      sourceFailure: null,
    });
    // One batched query, by QID.
    expect(mockedSparql).toHaveBeenCalledTimes(1);
    expect(mockedSparql.mock.calls[0][0]).toContain("VALUES ?s { wd:Q100 wd:Q200 wd:Q300 wd:Q400 wd:Q500 }");

    // Unpublish: flag only (never delete), plus a WARN log and a review row.
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({
      where: { id: "b-nicodemus" },
      data: { isPublished: false },
    });
    expect(mockedReview).toHaveBeenCalledTimes(1);
    expect(mockedReview.mock.calls[0][1]).toMatchObject({ alwaysQueue: true, contentType: "SAINT" });
    expect(mockedLog.mock.calls.some((c) => c[1].eventName === "structured_saint_unpublished")).toBe(true);

    // Patrick corrected: bishop (P39), honorific title, QID recorded.
    const patrick = mockedUpdate.mock.calls.find((c) => c[1].contentId === "c-patrick")![1];
    expect(patrick.proposedPayload).toMatchObject({
      saintType: "bishop",
      title: "Saint Patrick",
      wikidataQid: "Q200",
      canonizationStatus: "canonized",
    });
    expect(patrick.proposedTitle).toBe("Saint Patrick");
    expect(patrick.allowReplace).toBe(true);
    // Doubt (Q400) and the curated row were never sent to the gate.
    expect(mockedUpdate.mock.calls.map((c) => c[1].contentId).sort()).toEqual(["c-patrick", "d-rose"]);

    // Sweep complete → cursor wrapped and counted.
    const cursorArg = upsert.mock.calls[0][0] as { create: { memoryValue: { lastId: string | null; sweeps: number } } };
    expect(cursorArg.create.memoryValue).toMatchObject({ lastId: null, sweeps: 1 });
  });

  it("re-checks a multi-feast saint against the infobox-first rule", async () => {
    const rows = [
      saintRow("a-aquinas", "Q9438", {
        canonicalName: "Thomas Aquinas",
        title: "Saint Thomas Aquinas",
        saintType: "doctor_of_the_church",
        feastDay: "03-07",
        feastMonth: 3,
        feastDayOfMonth: 7,
      }),
    ];
    mockedSparql.mockResolvedValue([
      binding({ s: `${WD}Q9438`, label: "Thomas Aquinas", statuses: `${WD}Q3464126`, awards: `${WD}Q192499`, feasts: "7 March||28 January" }),
    ]);
    mockedInfobox.mockResolvedValue({ feast_day: "28 January; 7 March (pre-1969 calendar)" });
    const { prisma } = makePrisma(rows);

    const out = await runStructuredSaintRepair(prisma);

    expect(out.repaired).toBe(1);
    expect(mockedUpdate.mock.calls[0][1].proposedPayload).toMatchObject({
      feastDay: "01-28",
      feastMonth: 1,
      feastDayOfMonth: 28,
    });
  });

  it("holds the cursor and changes nothing when the structured source fails", async () => {
    mockedSparql.mockResolvedValue(null);
    const { prisma, update, upsert } = makePrisma([saintRow("a", "Q1", {})], { lastId: "0", sweeps: 2 });

    const out = await runStructuredSaintRepair(prisma);

    expect(out.sourceFailure).toBe("sparql");
    expect(out.examined).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
    // Only the cool-down may be persisted — never the cursor.
    for (const call of upsert.mock.calls as Array<[{ where: { memoryType_memoryKey: { memoryKey: string } } }]>) {
      expect(call[0].where.memoryType_memoryKey.memoryKey).not.toBe(SAINT_REPAIR_CURSOR_KEY);
    }
  });

  it("walks the corpus across passes with a bounded batch", async () => {
    const rows = Array.from({ length: 6 }, (_, i) => saintRow(`r${i}`, `Q${i}`, { canonicalName: `S${i}` }));
    mockedSparql.mockImplementation(async (q: string) => {
      const qids = [...q.matchAll(/wd:(Q\d+)/g)].map((m) => m[1]);
      return qids.map((qid) => binding({ s: `${WD}${qid}`, label: `S${qid.slice(1)}`, statuses: `${WD}Q3464126` }));
    });
    const { prisma, upsert } = makePrisma(rows);

    const first = await runStructuredSaintRepair(prisma, { limit: 2 });

    expect(first.examined).toBe(2);
    expect(first.completed).toBe(false);
    const cursorArg = upsert.mock.calls[0][0] as { create: { memoryValue: { lastId: string | null } } };
    expect(cursorArg.create.memoryValue.lastId).toBe("r1");

    const second = await runStructuredSaintRepair(makePrisma(rows, { lastId: "r1", sweeps: 0 }).prisma, { limit: 2 });
    expect(second.examined).toBe(2);
    expect(mockedSparql.mock.calls[1][0]).toContain("wd:Q2 wd:Q3");
  });
});
