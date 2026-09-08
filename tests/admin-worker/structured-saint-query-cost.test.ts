/**
 * The SAINT ingest is two-phase, and an unusable source is loud.
 *
 * Background (measured against the live Query Service, then pinned here so it
 * can never regress): the SAINT ingestor used to ask WDQS for ONE query that
 * enumerated the whole Catholic-saint corpus, computed 14 OPTIONAL patterns
 * with GROUP_CONCAT aggregation per row, sorted the entire result, and only
 * then applied LIMIT/OFFSET. WDQS has to materialise and sort everything before
 * it can honour the offset, and it enforces its own 60s execution cap, so that
 * query returned HTTP 504 after ~65s at EVERY offset — 311 consecutive failures
 * and nothing published for hours, while the client's own 55s timeout never
 * even came into play. The same enumeration, stripped to entity ids, answered
 * in ~2.5s.
 *
 * So the shape is now: a cheap ordered ENUMERATION of entity ids, then a
 * HYDRATION query bound with `VALUES ?s { wd:Q… }` that does the expensive work
 * over a bounded page. These tests pin both halves — including the doctrinal
 * requirement that all THREE enumeration branches survive the split, since the
 * branches are what define "a Catholic saint" — and the escalation + back-off
 * that keeps a dead source from failing silently ever again.
 *
 * Every test here is OFFLINE: `runSparql` and the Wikipedia clients are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikidata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/structured/wikidata")>();
  return {
    ...actual,
    runSparql: vi.fn(),
    lastSparqlFailure: vi.fn(() => ({
      at: Date.now(),
      kind: "timeout" as const,
      status: 504,
      // null so the persisted cool-down never leaks into the next test.
      cooldownUntil: null,
    })),
  };
});
vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-worker/structured/wikipedia-infobox", () => ({
  fetchArticleInfobox: vi.fn(async () => ({})),
}));
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));
vi.mock("@/lib/admin-worker/escalation", () => ({
  escalateStructuredSourceUnusable: vi.fn(async () => ({
    ran: true,
    escalated: true,
    emailed: true,
    deduped: false,
    resolved: 0,
    deferredForUpgrade: false,
    cooldown: false,
  })),
}));

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import {
  MAX_CONSECUTIVE_SOURCE_FAILURES,
  UNUSABLE_SOURCE_RETRY_MS,
  runStructuredIngest,
} from "@/lib/admin-worker/structured/ingest";
import {
  SAINT_ENUMERATION_BRANCHES,
  SAINT_HYDRATE_MAX_ENTITIES,
  ingestorFor,
  saintHydrationSparql,
} from "@/lib/admin-worker/structured/ingestors";
import { parseSaintFacts } from "@/lib/admin-worker/structured/saint-facts";
import {
  resetSparqlGateForTests,
  runSparql,
  type SparqlBinding,
} from "@/lib/admin-worker/structured/wikidata";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import { escalateStructuredSourceUnusable } from "@/lib/admin-worker/escalation";

const mockedSparql = vi.mocked(runSparql);
const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);
const mockedEscalate = vi.mocked(escalateStructuredSourceUnusable);

const saint = ingestorFor("SAINT")!;
const WD = "http://www.wikidata.org/entity/";
const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;

beforeEach(() => {
  savedSkip = process.env[SKIP];
  delete process.env[SKIP];
  resetSparqlGateForTests({ minSpacingMs: 0 });
  mockedSparql.mockReset();
  mockedSummary.mockReset();
  mockedSummary.mockResolvedValue(null);
  mockedEscalate.mockClear();
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
  resetSparqlGateForTests();
  vi.restoreAllMocks();
});

/** An ENUMERATION row: the entity id and nothing else. */
function enumRow(qid: string): SparqlBinding {
  return { s: { type: "uri", value: `${WD}${qid}` } };
}

/** A HYDRATION row, in the shape `parseSaintFacts` consumes. */
function hydratedRow(qid: string, over: Record<string, string> = {}): SparqlBinding {
  const b: SparqlBinding = { s: { type: "uri", value: `${WD}${qid}` } };
  const fields: Record<string, string> = {
    label: `Saint ${qid}`,
    statuses: `${WD}Q3464126`,
    feasts: "23 August",
    art: `https://en.wikipedia.org/wiki/${qid}`,
    ...over,
  };
  for (const [k, v] of Object.entries(fields)) b[k] = { type: "literal", value: v };
  return b;
}

describe("SAINT enumeration query — cheap, ordered, and doctrinally complete", () => {
  const query = saint.sparql(40, 2400);

  it("projects ONLY entity ids: no aggregates, no OPTIONAL fact patterns", () => {
    expect(query).toMatch(/^SELECT DISTINCT \?s WHERE \{/);
    expect(query).not.toContain("GROUP_CONCAT");
    expect(query).not.toContain("SAMPLE(");
    expect(query).not.toContain("OPTIONAL");
    // The killer combination: sorting per-row aggregates before OFFSET.
    expect(query).not.toContain("GROUP BY");
  });

  it("is deterministically ordered and pages with LIMIT/OFFSET", () => {
    expect(query).toContain("ORDER BY ?s");
    expect(query).toContain("LIMIT 40 OFFSET 2400");
    // DISTINCT is load-bearing: branches 1 and 2 overlap and P841 multiplies
    // rows for a multi-feast saint, so without it a page would repeat entities
    // and the offset would silently skip saints.
    expect(query).toContain("SELECT DISTINCT ?s");
  });

  it("keeps ALL THREE Catholic-saint branches — the definition, not a filter", () => {
    // 1. a Catholic-specific P411 status item
    expect(query).toContain("?s wdt:P411 ?catholicStatus");
    expect(query).toContain("wd:Q3464126"); // Catholic saint
    expect(query).toContain("wd:Q2369287"); // blessed
    expect(query).toContain("wd:Q869974"); // Servant of God
    // 2. the GENERIC saint item, but only with a Catholic religion
    expect(query).toContain("?s wdt:P411 wd:Q43115 . ?s wdt:P140 ?catholicRel");
    // 3. a Catholic religion + feast day and NO P411 at all
    expect(query).toContain("FILTER NOT EXISTS { ?s wdt:P411 [] }");
    expect((query.match(/UNION/g) ?? []).length).toBe(2);
    // Common to every branch: a feast day, and an English label.
    expect(query).toContain("?s wdt:P841 ?anyFeast");
    expect(query).toContain('FILTER(LANG(?sEnumLabel) = "en")');
    expect(query).toContain(SAINT_ENUMERATION_BRANCHES);
  });

  it("does NOT widen the corpus: only Catholic religions qualify a generic saint", () => {
    // Q9592 Catholic Church, Q1841 Catholicism, Q49376 Latin Church — and no
    // Orthodox / Anglican / Coptic body anywhere in the enumeration.
    expect(query).toContain("wd:Q9592 wd:Q1841 wd:Q49376");
    for (const nonCatholic of ["Q3333484", "Q35032", "Q6423963", "Q198998"]) {
      expect(query).not.toContain(nonCatholic);
    }
  });
});

describe("SAINT hydration query — bounded by VALUES, not by the corpus", () => {
  it("binds exactly the enumerated entities and keeps the full projection", () => {
    const query = saint.hydrate!([enumRow("Q170145"), enumRow("Q989"), enumRow("Q8018")])!;
    expect(query).toContain("VALUES ?s { wd:Q170145 wd:Q989 wd:Q8018 }");
    // The row shape the mapper consumes is unchanged: every fact still arrives
    // as the complete GROUP_CONCAT set, never a random SAMPLE of one value.
    for (const col of [
      "?feasts",
      "?statuses",
      "?religions",
      "?religionLabels",
      "?positions",
      "?occupations",
      "?awards",
      "?altArts",
    ]) {
      expect(query).toContain(`AS ${col}`);
      expect(query).toMatch(new RegExp(`GROUP_CONCAT\\(DISTINCT [^)]*\\) AS \\${col}`));
    }
    expect(query).toContain("GROUP BY ?s");
    // Paging belongs to the enumeration; hydration takes the page it is given.
    expect(query).not.toContain("LIMIT");
    expect(query).not.toContain("OFFSET");
  });

  it("carries NO enumeration branch: the entity set is already decided", () => {
    const query = saint.hydrate!([enumRow("Q170145")])!;
    expect(query).not.toContain("UNION");
    expect(query).not.toContain("FILTER NOT EXISTS { ?s wdt:P411 [] }");
  });

  it("asks EXISTS for the boolean-only facts instead of joining them", () => {
    // These two are read as booleans, never as lists. Joined as OPTIONALs they
    // multiplied into the per-entity cross product that made John Paul II
    // (11 founded organisations x 7 episcopal sees x 29 awards x …) time out
    // at 65s even as the ONLY bound entity.
    const query = saint.hydrate!([enumRow("Q989")])!;
    expect(query).toContain("BIND(EXISTS { ?s wdt:P39 ?seeItem . ?seeItem wdt:P279* wd:Q29182 }");
    expect(query).toContain("BIND(EXISTS { ?foundedOrg wdt:P112 ?s }");
    expect(query).not.toContain("OPTIONAL { ?s wdt:P39 ?bishopSee");
    expect(query).not.toContain("OPTIONAL { ?founded wdt:P112 ?s");
  });

  it("dedups, drops non-entities, and returns null for an empty page", () => {
    expect(saint.hydrate!([])).toBeNull();
    expect(saintHydrationSparql([])).toBeNull();
    expect(saintHydrationSparql(["not-an-entity"])).toBeNull();
    const query = saintHydrationSparql([`${WD}Q1`, `${WD}Q1`, `${WD}Q2`])!;
    expect(query).toContain("VALUES ?s { wd:Q1 wd:Q2 }");
  });
});

describe("SAINT facts still parse from a hydrated row", () => {
  it("reads the EXISTS booleans correctly (the literal 'false' is FALSE)", () => {
    const bool = (v: string) => ({ type: "literal", value: v });
    const row: SparqlBinding = {
      ...hydratedRow("Q1"),
      bishopSee: bool("true"),
      founded: bool("false"),
    };
    const facts = parseSaintFacts(row)!;
    expect(facts.bishopSee).toBe(true);
    expect(facts.founded).toBe(false);
  });

  it("still reads the older bound-URI form as true (the repair sweep's rows)", () => {
    const row: SparqlBinding = {
      ...hydratedRow("Q1"),
      bishopSee: { type: "uri", value: `${WD}Q132745127` },
    };
    expect(parseSaintFacts(row)!.bishopSee).toBe(true);
  });

  it("maps a hydrated row to a SCHEMA-VALID SAINT, unchanged by the split", async () => {
    mockedSummary.mockResolvedValue({
      extract:
        "Saint Rose of Lima was a Peruvian member of the Third Order of Saint Dominic, the " +
        "first person born in the Americas to be canonized; her feast day is 23 August.",
      url: "https://en.wikipedia.org/wiki/Rose_of_Lima",
    });
    const entry = await saint.map(
      hydratedRow("Q170145", {
        label: "Rose of Lima",
        art: "https://en.wikipedia.org/wiki/Rose_of_Lima",
        founded: "false",
        bishopSee: "false",
      }),
      {} as Record<string, never>,
    );
    expect(entry).not.toBeNull();
    expect(entry!.slug).toBe("saint-rose-of-lima");
    expect(entry!.payload.feastDay).toBe("08-23");
    expect(entry!.payload.canonizationStatus).toBe("canonized");
    expect(validatePayload("SAINT", entry!.payload).ok).toBe(true);
  });
});

/* ── Orchestration: the two phases, and how the page is paged ───────────── */

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
    contentGoal: { findUnique: vi.fn(async () => null) },
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

describe("runStructuredIngest — two-phase SAINT page", () => {
  it("enumerates first, then hydrates exactly the enumerated entities", async () => {
    mockedSparql
      .mockResolvedValueOnce([enumRow("Q1"), enumRow("Q2")])
      .mockResolvedValueOnce([hydratedRow("Q1"), hydratedRow("Q2")]);
    const { prisma } = makePrisma();

    await runStructuredIngest(prisma, { contentType: "SAINT", batch: 2 });

    expect(mockedSparql).toHaveBeenCalledTimes(2);
    const [enumQuery, hydrateQuery] = mockedSparql.mock.calls.map((c) => String(c[0]));
    expect(enumQuery).toContain("SELECT DISTINCT ?s");
    expect(enumQuery).toContain("LIMIT 2 OFFSET 0");
    expect(hydrateQuery).toContain("VALUES ?s { wd:Q1 wd:Q2 }");
    expect(hydrateQuery).toContain("GROUP_CONCAT");
  });

  it("advances the cursor by the ENUMERATED page size, not the hydrated row count", async () => {
    // A full page enumerated, but one entity hydrates to nothing (edited between
    // the two calls). Reading that as a short page would wrap the cursor to 0
    // and re-sweep thousands of already-live saints.
    mockedSparql
      .mockResolvedValueOnce([enumRow("Q1"), enumRow("Q2")])
      .mockResolvedValueOnce([hydratedRow("Q1")]);
    const { prisma, upsert } = makePrisma({ cursor: { offset: 400 } });

    const out = await runStructuredIngest(prisma, { contentType: "SAINT", batch: 2 });

    expect(out.exhausted).toBe(false);
    const state = persisted(upsert);
    expect(state.offset).toBe(402);
    expect(state.exhaustedUntil ?? null).toBeNull();
  });

  it("treats a short ENUMERATION as the end of the corpus and rests", async () => {
    mockedSparql.mockResolvedValueOnce([enumRow("Q1")]).mockResolvedValueOnce([hydratedRow("Q1")]);
    const { prisma, upsert } = makePrisma({ cursor: { offset: 4700 } });

    await runStructuredIngest(prisma, { contentType: "SAINT", batch: 100 });

    const state = persisted(upsert);
    expect(state.offset).toBe(0);
    expect(state.exhaustedUntil as number).toBeGreaterThan(Date.now());
  });

  it("does not hydrate an empty enumeration, and never calls it end-of-source", async () => {
    mockedSparql.mockResolvedValueOnce([]);
    const { prisma } = makePrisma({ cursor: { offset: 4759 } });

    const out = await runStructuredIngest(prisma, { contentType: "SAINT", batch: 100 });

    expect(mockedSparql).toHaveBeenCalledTimes(1);
    expect(out.sourceFailure).toBeNull();
  });

  it("counts a FAILED hydration as a source failure and holds the cursor", async () => {
    mockedSparql.mockResolvedValueOnce([enumRow("Q1"), enumRow("Q2")]).mockResolvedValueOnce(null);
    const { prisma, upsert } = makePrisma({ cursor: { offset: 900, failures: 2 } });

    const out = await runStructuredIngest(prisma, { contentType: "SAINT", batch: 2 });

    expect(out.sourceFailure).toBe("timeout (HTTP 504)");
    expect(out.exhausted).toBe(false);
    const state = persisted(upsert);
    expect(state.offset).toBe(900);
    expect(state.failures).toBe(3);
  });

  it("never enumerates a page wider than hydration can bind", async () => {
    // The cursor advances by the ENUMERATED size, so enumerating 250 entities
    // into a hydration that binds only SAINT_HYDRATE_MAX_ENTITIES would step
    // over the remainder and lose those saints for good — silently, looking
    // exactly like a successful page. The batch is clamped instead.
    mockedSparql.mockResolvedValue([]);
    const { prisma } = makePrisma();

    await runStructuredIngest(prisma, { contentType: "SAINT", batch: 250 });

    expect(String(mockedSparql.mock.calls[0][0])).toContain(
      `LIMIT ${SAINT_HYDRATE_MAX_ENTITIES} OFFSET 0`,
    );
  });
});

/* ── An unusable source is escalated and backed off ─────────────────────── */

describe("runStructuredIngest — a source that always fails becomes visible", () => {
  it("does NOT escalate below the consecutive-failure threshold", async () => {
    mockedSparql.mockResolvedValue(null);
    const { prisma, upsert } = makePrisma({
      cursor: { offset: 0, failures: MAX_CONSECUTIVE_SOURCE_FAILURES - 2 },
    });

    const out = await runStructuredIngest(prisma, { contentType: "SAINT", batch: 40 });

    expect(out.sourceUnusable).toBe(false);
    expect(mockedEscalate).not.toHaveBeenCalled();
    const state = persisted(upsert);
    expect(state.failures).toBe(MAX_CONSECUTIVE_SOURCE_FAILURES - 1);
    // Still retried on the normal cadence.
    expect(state.exhaustedUntil ?? null).toBeNull();
    expect(state.escalatedAt ?? null).toBeNull();
  });

  it("escalates at the threshold, naming the ingestor, the count and the failure kind", async () => {
    mockedSparql.mockResolvedValue(null);
    const { prisma, upsert, logCreate } = makePrisma({
      cursor: { offset: 2400, failures: MAX_CONSECUTIVE_SOURCE_FAILURES - 1 },
    });
    const before = Date.now();

    const out = await runStructuredIngest(prisma, { contentType: "SAINT", batch: 40 });

    expect(out.sourceUnusable).toBe(true);
    expect(mockedEscalate).toHaveBeenCalledTimes(1);
    expect(mockedEscalate.mock.calls[0][1]).toMatchObject({
      ingestorId: "wikidata-saints",
      contentType: "SAINT",
      consecutiveFailures: MAX_CONSECUTIVE_SOURCE_FAILURES,
      lastFailureKind: "timeout (HTTP 504)",
      offset: 2400,
    });
    // Backed off to a long retry interval instead of every couple of minutes.
    const state = persisted(upsert);
    expect(state.offset).toBe(2400);
    expect(state.exhaustedUntil as number).toBeGreaterThanOrEqual(
      before + UNUSABLE_SOURCE_RETRY_MS,
    );
    expect(state.escalatedAt as number).toBeGreaterThanOrEqual(before);
    // The repeating WARN becomes one ERROR that says what happened.
    const log = logCreate.mock.calls[0][0] as { data: { severity: string; message: string } };
    expect(log.data.severity).toBe("ERROR");
    expect(log.data.message).toContain("UNUSABLE");
    expect(log.data.message).toContain("wikidata-saints");
  });

  it("pages the operator ONCE per episode, not on every later failure", async () => {
    mockedSparql.mockResolvedValue(null);
    const { prisma } = makePrisma({
      cursor: {
        offset: 2400,
        failures: MAX_CONSECUTIVE_SOURCE_FAILURES + 300,
        escalatedAt: Date.now() - 60_000,
      },
    });

    const out = await runStructuredIngest(prisma, { contentType: "SAINT", batch: 40 });

    expect(out.sourceUnusable).toBe(false);
    expect(mockedEscalate).not.toHaveBeenCalled();
  });

  it("clears the failure count and the escalation stamp as soon as a page succeeds", async () => {
    mockedSparql.mockResolvedValueOnce([enumRow("Q1")]).mockResolvedValueOnce([hydratedRow("Q1")]);
    const { prisma, upsert } = makePrisma({
      cursor: {
        offset: 0,
        failures: MAX_CONSECUTIVE_SOURCE_FAILURES + 5,
        escalatedAt: Date.now() - 60_000,
      },
    });

    await runStructuredIngest(prisma, { contentType: "SAINT", batch: 100 });

    const state = persisted(upsert);
    expect(state.failures).toBe(0);
    expect(state.escalatedAt).toBeNull();
  });

  it("is fail-open: a throwing escalation never breaks the ingest pass", async () => {
    mockedSparql.mockResolvedValue(null);
    mockedEscalate.mockRejectedValueOnce(new Error("smtp down"));
    const { prisma } = makePrisma({
      cursor: { offset: 0, failures: MAX_CONSECUTIVE_SOURCE_FAILURES - 1 },
    });

    const out = await runStructuredIngest(prisma, { contentType: "SAINT", batch: 40 });

    expect(out.sourceUnusable).toBe(true);
    expect(out.sourceFailure).toBe("timeout (HTTP 504)");
  });

  it("backs off only the failing ingestor — a healthy one still runs", async () => {
    mockedSparql
      .mockResolvedValueOnce([
        {
          pope: { type: "uri", value: `${WD}Q1` },
          popeLabel: { type: "literal", value: "Linus" },
          startYear: { type: "literal", value: "67" },
        },
      ])
      .mockResolvedValueOnce([]);
    const { prisma } = makePrisma();

    const out = await runStructuredIngest(prisma, { contentType: "POPE", batch: 40 });

    expect(out.ingestorId).toBe("wikidata-popes");
    expect(out.sourceFailure).toBeNull();
    expect(out.sourceUnusable).toBe(false);
    expect(mockedEscalate).not.toHaveBeenCalled();
  });

  it("never escalates when the network gate is simply closed", async () => {
    process.env[SKIP] = "1";
    mockedSparql.mockResolvedValue(null);
    const { prisma, upsert, logCreate } = makePrisma({
      cursor: { offset: 0, failures: MAX_CONSECUTIVE_SOURCE_FAILURES + 10 },
    });

    const out = await runStructuredIngest(prisma, { contentType: "SAINT", batch: 40 });

    expect(out.sourceUnusable).toBe(false);
    expect(mockedEscalate).not.toHaveBeenCalled();
    expect(logCreate).not.toHaveBeenCalled();
    expect(persisted(upsert).exhaustedUntil ?? null).toBeNull();
  });
});
