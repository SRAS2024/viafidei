/**
 * Cursor + live-index behaviour of the structured-ingest orchestrator. These
 * tests pin the rules that keep a multi-thousand-row corpus walkable:
 *   - a source FAILURE (runSparql → null) never moves the cursor and never
 *     reads as "end of corpus" (it used to reset the sweep to offset 0);
 *   - already-live rows are recognised from the SPARQL row alone and cost no
 *     Wikipedia fetch; a page that is entirely live is skipped to the next;
 *   - the empty-pass streak only grows on a genuinely BARREN page, never on a
 *     page that is merely already published;
 *   - a corpus smaller than one page rests (`exhaustedUntil`) instead of
 *     re-fetching every pass;
 *   - a DIFFERENT entity sharing a live label publishes under a
 *     QID-disambiguated slug rather than being dropped or merged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikidata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/structured/wikidata")>();
  return {
    ...actual,
    runSparql: vi.fn(),
    lastSparqlFailure: vi.fn(() => ({
      at: Date.now(),
      kind: "throttled",
      status: 429,
      cooldownUntil: null,
    })),
  };
});
vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));

import type { PrismaClient } from "@prisma/client";

import {
  MAX_SKIP_PAGES_PER_PASS,
  RESWEEP_INTERVAL_MS,
  runStructuredIngest,
} from "@/lib/admin-worker/structured/ingest";
import { runSparql, type SparqlBinding } from "@/lib/admin-worker/structured/wikidata";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";

const mockedSparql = vi.mocked(runSparql);
const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);
const mockedPublish = vi.mocked(runPublishOrchestrator);

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;

beforeEach(() => {
  savedSkip = process.env[SKIP];
  delete process.env[SKIP]; // the POPE mapper would call Wikipedia if allowed to
  mockedSparql.mockReset();
  mockedSummary.mockReset();
  mockedSummary.mockResolvedValue(null);
  mockedPublish.mockReset();
  mockedPublish.mockResolvedValue({ kind: "published" } as never);
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
  vi.restoreAllMocks();
});

const WD = "http://www.wikidata.org/entity/";

function pope(qid: string, label: string, over: Record<string, string> = {}): SparqlBinding {
  const b: SparqlBinding = {};
  const fields = {
    pope: `${WD}${qid}`,
    popeLabel: label,
    startYear: "1000",
    article: `https://en.wikipedia.org/wiki/Pope_${label.replace(/\s+/g, "_")}`,
    ...over,
  };
  for (const [k, v] of Object.entries(fields)) b[k] = { type: "literal", value: v };
  return b;
}

interface LiveRow {
  slug: string;
  title: string;
  sourceRef?: string | null;
}

function makePrisma(opts: { live?: LiveRow[]; cursor?: Record<string, unknown> } = {}) {
  const upsert = vi.fn(async () => ({}));
  const logCreate = vi.fn(async () => ({}));
  const prisma = {
    adminWorkerMemory: {
      findUnique: vi.fn(async (args: { where: { memoryType_memoryKey: { memoryKey: string } } }) =>
        args.where.memoryType_memoryKey.memoryKey.startsWith("structured-cursor:") && opts.cursor
          ? { memoryValue: opts.cursor, lastUsedAt: null }
          : null,
      ),
      upsert,
    },
    publishedContent: {
      findMany: vi.fn(async () => opts.live ?? []),
      count: vi.fn(async () => 0),
    },
    checklistItem: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "ci1" })),
    },
    adminWorkerLog: { create: logCreate },
  } as unknown as PrismaClient;
  return { prisma, upsert, logCreate };
}

/** The cursor state the pass persisted (last upsert). */
function persisted(upsert: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const calls = upsert.mock.calls as Array<[{ create: { memoryValue: Record<string, unknown> } }]>;
  return calls[calls.length - 1][0].create.memoryValue;
}

describe("runStructuredIngest — source failure holds the cursor", () => {
  it("keeps the offset, counts the failure, and never treats null as end of corpus", async () => {
    mockedSparql.mockResolvedValue(null);
    const { prisma, upsert, logCreate } = makePrisma({
      cursor: { offset: 3800, zeroStreak: 2, failures: 1 },
    });

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 50 });

    expect(out.sourceFailure).toBe("throttled (HTTP 429)");
    expect(out.exhausted).toBe(false);
    expect(out.fetched).toBe(0);
    expect(mockedPublish).not.toHaveBeenCalled();
    const state = persisted(upsert);
    expect(state.offset).toBe(3800); // NOT 0
    expect(state.zeroStreak).toBe(2); // a failure is not an empty page
    expect(state.failures).toBe(2);
    expect(state.exhaustedUntil ?? null).toBeNull(); // no rest scheduled: a failure is not "end of corpus"
    expect(logCreate).toHaveBeenCalledTimes(1); // one WARN, actionable
  });

  it("holds the cursor at the last GOOD page when a later page in the same pass fails", async () => {
    // Page 1 (offset 0) entirely live → skipped; page 2 (offset 2) fails.
    mockedSparql
      .mockResolvedValueOnce([pope("Q1", "Linus"), pope("Q2", "Cletus")])
      .mockResolvedValueOnce(null);
    const { prisma, upsert } = makePrisma({
      live: [
        { slug: "pope-linus", title: "Pope Linus", sourceRef: "https://www.wikidata.org/wiki/Q1" },
        {
          slug: "pope-cletus",
          title: "Pope Cletus",
          sourceRef: "https://www.wikidata.org/wiki/Q2",
        },
      ],
    });

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 2 });

    expect(out.pagesSkipped).toBe(1);
    expect(out.alreadyPublished).toBe(2);
    expect(out.sourceFailure).not.toBeNull();
    expect(persisted(upsert).offset).toBe(2);
  });
});

describe("runStructuredIngest — already-live rows cost no Wikipedia traffic", () => {
  it("recognises live rows from the SPARQL row (QID / slug / name) BEFORE mapping", async () => {
    mockedSparql.mockResolvedValue([
      pope("Q1", "Linus"),
      pope("Q2", "Cletus"),
      pope("Q3", "Clement I"),
    ]);
    const { prisma } = makePrisma({
      live: [
        { slug: "pope-linus", title: "Pope Linus", sourceRef: "https://www.wikidata.org/wiki/Q1" },
        // Curated row (no QID) under a different slug convention: name match.
        { slug: "pope-saint-cletus", title: "Pope Saint Cletus", sourceRef: null },
      ],
    });

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 3 });

    expect(out.alreadyPublished).toBe(2);
    expect(out.published).toBe(1);
    // Only Clement I was mapped → exactly one summary fetch.
    expect(mockedSummary).toHaveBeenCalledTimes(1);
    expect(String(mockedSummary.mock.calls[0][0])).toContain("Clement_I");
  });

  it("skips straight through entirely-live pages to the first page with work", async () => {
    const live: LiveRow[] = [];
    const pages: SparqlBinding[][] = [];
    for (let p = 0; p < 3; p += 1) {
      const rows = [pope(`Q${p}0`, `Live ${p}0`), pope(`Q${p}1`, `Live ${p}1`)];
      pages.push(rows);
      for (const r of rows) {
        const qid = String(r.pope?.value).replace(WD, "");
        live.push({
          slug: `pope-${String(r.popeLabel?.value).toLowerCase().replace(/\s+/g, "-")}`,
          title: `Pope ${r.popeLabel?.value}`,
          sourceRef: `https://www.wikidata.org/wiki/${qid}`,
        });
      }
    }
    pages.push([pope("Q99", "Fresh"), pope("Q98", "Also Fresh")]);
    for (const page of pages) mockedSparql.mockResolvedValueOnce(page);
    const { prisma, upsert } = makePrisma({ live });

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 2 });

    expect(out.pagesSkipped).toBe(3);
    expect(out.alreadyPublished).toBe(6);
    expect(out.published).toBe(2);
    expect(mockedSparql).toHaveBeenCalledTimes(4);
    expect(mockedSummary).toHaveBeenCalledTimes(2); // only the fresh rows
    expect(persisted(upsert).offset).toBe(8);
  });

  it("bounds the skip-through to MAX_SKIP_PAGES_PER_PASS and keeps walking next pass", async () => {
    const liveRow = pope("Q1", "Linus");
    mockedSparql.mockResolvedValue([liveRow]);
    const { prisma, upsert } = makePrisma({
      live: [
        { slug: "pope-linus", title: "Pope Linus", sourceRef: "https://www.wikidata.org/wiki/Q1" },
      ],
    });

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 1 });

    expect(mockedSparql).toHaveBeenCalledTimes(MAX_SKIP_PAGES_PER_PASS);
    expect(out.pagesSkipped).toBe(MAX_SKIP_PAGES_PER_PASS);
    expect(persisted(upsert).offset).toBe(MAX_SKIP_PAGES_PER_PASS);
    expect(persisted(upsert).zeroStreak).toBe(0); // live pages are healthy, not barren
  });
});

describe("runStructuredIngest — empty-pass streak", () => {
  it("does NOT grow on a page that is merely already live", async () => {
    mockedSparql.mockResolvedValue([pope("Q1", "Linus")]);
    const { prisma, upsert } = makePrisma({
      live: [
        { slug: "pope-linus", title: "Pope Linus", sourceRef: "https://www.wikidata.org/wiki/Q1" },
      ],
      cursor: { offset: 0, zeroStreak: 3 },
    });

    await runStructuredIngest(prisma, { contentType: "POPE", batch: 5 });

    expect(persisted(upsert).zeroStreak).toBe(3);
  });

  it("grows only on a genuinely BARREN page (fetched, nothing live, nothing publishable)", async () => {
    mockedSparql.mockResolvedValue([pope("Q1", "Q1")]); // unusable label → unmappable
    const { prisma, upsert } = makePrisma({ cursor: { offset: 0, zeroStreak: 3 } });

    await runStructuredIngest(prisma, { contentType: "POPE", batch: 5 });

    expect(persisted(upsert).zeroStreak).toBe(4);
  });

  it("resets when the pass publishes", async () => {
    mockedSparql.mockResolvedValue([pope("Q9", "Fresh")]);
    const { prisma, upsert } = makePrisma({ cursor: { offset: 0, zeroStreak: 3 } });

    await runStructuredIngest(prisma, { contentType: "POPE", batch: 5 });

    expect(persisted(upsert).zeroStreak).toBe(0);
  });
});

describe("runStructuredIngest — small corpus rests instead of re-sweeping every pass", () => {
  it("wraps to 0 with a rest period at the end of the corpus", async () => {
    mockedSparql.mockResolvedValue([pope("Q1", "Linus")]); // 1 row < batch 50
    const { prisma, upsert } = makePrisma({
      live: [
        { slug: "pope-linus", title: "Pope Linus", sourceRef: "https://www.wikidata.org/wiki/Q1" },
      ],
      cursor: { offset: 100, zeroStreak: 0 },
    });
    const before = Date.now();

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 50 });

    expect(out.exhausted).toBe(true);
    const state = persisted(upsert);
    expect(state.offset).toBe(0);
    expect(state.lastFullSweepAt as number).toBeGreaterThanOrEqual(before);
    expect(state.exhaustedUntil as number).toBeGreaterThanOrEqual(before + RESWEEP_INTERVAL_MS);
  });

  it("issues no query at all while the corpus is resting", async () => {
    mockedSparql.mockResolvedValue([]);
    const { prisma } = makePrisma({
      cursor: { offset: 0, zeroStreak: 0, exhaustedUntil: Date.now() + 60 * 60 * 1000 },
    });

    const out = await runStructuredIngest(prisma, { contentType: "POPE" });

    expect(mockedSparql).not.toHaveBeenCalled();
    expect(out.fetched).toBe(0);
  });
});

describe("runStructuredIngest — label collisions between DIFFERENT entities", () => {
  it("publishes a distinct entity sharing a live label under a QID-disambiguated slug", async () => {
    mockedSparql.mockResolvedValue([pope("Q2", "Felix")]);
    const { prisma } = makePrisma({
      live: [
        { slug: "pope-felix", title: "Pope Felix", sourceRef: "https://www.wikidata.org/wiki/Q1" },
      ],
    });

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 5 });

    expect(out.alreadyPublished).toBe(0);
    expect(out.published).toBe(1);
    const arg = mockedPublish.mock.calls[0][1] as { slug: string; payload: { slug: string } };
    expect(arg.slug).toBe("pope-felix-q2");
    expect(arg.payload.slug).toBe("pope-felix-q2");
  });

  it("still treats the SAME entity (by QID) as live even under a different slug", async () => {
    mockedSparql.mockResolvedValue([pope("Q1", "Felix")]);
    const { prisma } = makePrisma({
      live: [
        {
          slug: "pope-felix-i",
          title: "Pope Felix I",
          sourceRef: "https://www.wikidata.org/wiki/Q1",
        },
      ],
    });

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 5 });

    expect(out.alreadyPublished).toBe(1);
    expect(mockedPublish).not.toHaveBeenCalled();
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it("disambiguates within one batch too, rather than dropping the second entity", async () => {
    mockedSparql.mockResolvedValue([pope("Q1", "Felix"), pope("Q2", "Felix")]);
    const { prisma } = makePrisma();

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 5 });

    expect(out.published).toBe(2);
    const args = mockedPublish.mock.calls.map(
      (c) => c[1] as { slug: string; payload: { slug: string } },
    );
    expect(args.map((a) => a.slug).sort()).toEqual(["pope-felix", "pope-felix-q2"]);
    // The payload's own slug is what the schema validates and what the page
    // links itself by — it must move with the disambiguated slug, not keep
    // pointing at the other entity's page.
    expect(args.map((a) => a.payload.slug).sort()).toEqual(["pope-felix", "pope-felix-q2"]);
  });

  it("does not hand a queued checklist item for a DIFFERENT person this entity's payload", async () => {
    mockedSparql.mockResolvedValue([pope("Q2", "John")]);
    const { prisma } = makePrisma();
    const findFirst = vi.mocked(prisma.checklistItem.findFirst);
    findFirst.mockImplementation((async (args: { where: { canonicalSlug: string } }) =>
      args.where.canonicalSlug === "pope-john"
        ? { id: "other-john", canonicalName: "Pope John XXIII" }
        : null) as never);

    await runStructuredIngest(prisma, { contentType: "POPE", batch: 5 });

    const arg = mockedPublish.mock.calls[0][1] as { slug: string; contentId: string };
    expect(arg.slug).toBe("pope-john-q2");
    expect(arg.contentId).toBe("ci1"); // a fresh item, not "other-john"
  });
});
