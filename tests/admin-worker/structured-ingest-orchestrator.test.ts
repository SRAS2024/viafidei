/**
 * The structured-ingest orchestrator turns mapped records into published
 * content through the REAL publish path, advancing a corpus cursor across passes
 * and accumulating a learning signal — all keyless. These tests mock the
 * Wikidata transport and the publish gate to pin the orchestration: publish the
 * new, skip the already-live, dedup within a batch, respect the per-pass limit,
 * and persist the advancing cursor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikidata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/structured/wikidata")>();
  return { ...actual, runSparql: vi.fn() };
});
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));

import type { PrismaClient } from "@prisma/client";

import { runStructuredIngest } from "@/lib/admin-worker/structured/ingest";
import { runSparql, type SparqlBinding } from "@/lib/admin-worker/structured/wikidata";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";

const mockedSparql = vi.mocked(runSparql);
const mockedPublish = vi.mocked(runPublishOrchestrator);

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;

beforeEach(() => {
  savedSkip = process.env[SKIP];
  process.env[SKIP] = "1"; // keep the POPE mapper offline (no Wikipedia fetch)
  mockedSparql.mockReset();
  mockedPublish.mockReset();
  mockedPublish.mockResolvedValue({ kind: "published" } as never);
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
  vi.restoreAllMocks();
});

function lit(value: string): { type: string; value: string } {
  return { type: "literal", value };
}

function row(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = lit(v);
  return b;
}

const ROWS: SparqlBinding[] = [
  row({
    pope: "http://www.wikidata.org/entity/Q989",
    popeLabel: "John Paul II",
    startYear: "1978",
    endYear: "2005",
  }),
  row({ pope: "http://www.wikidata.org/entity/Q450", popeLabel: "Francis", startYear: "2013" }),
  row({ pope: "http://www.wikidata.org/entity/Q1", popeLabel: "Q1", startYear: "100" }), // bad label
  row({
    pope: "http://www.wikidata.org/entity/Q333",
    popeLabel: "Benedict XVI",
    startYear: "2005",
    endYear: "2013",
  }),
];

function makePrisma(opts: { live?: string[] } = {}) {
  const upsert = vi.fn(async () => ({}));
  return {
    prisma: {
      adminWorkerMemory: {
        findUnique: vi.fn(async () => null), // cursor starts at 0
        upsert,
      },
      publishedContent: {
        findMany: vi.fn(async () => (opts.live ?? []).map((slug) => ({ slug }))),
        count: vi.fn(async () => 0),
      },
      checklistItem: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "ci1" })),
      },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient,
    upsert,
  };
}

describe("runStructuredIngest", () => {
  it("publishes the new, skips already-live, and skips unmappable rows", async () => {
    mockedSparql.mockResolvedValue(ROWS);
    const { prisma } = makePrisma({ live: ["pope-francis"] });

    const out = await runStructuredIngest(prisma, { contentType: "POPE" });

    expect(out.fetched).toBe(4);
    expect(out.published).toBe(2); // John Paul II + Benedict XVI
    expect(out.alreadyPublished).toBe(1); // Francis
    expect(out.skipped).toBe(1); // bad-label row
    expect(mockedPublish).toHaveBeenCalledTimes(2);
  });

  it("respects the per-pass publish limit", async () => {
    mockedSparql.mockResolvedValue(ROWS);
    const { prisma } = makePrisma();

    const out = await runStructuredIngest(prisma, { contentType: "POPE", limit: 1 });

    expect(out.published).toBe(1);
    expect(mockedPublish).toHaveBeenCalledTimes(1);
  });

  it("advances and persists the corpus cursor when a full batch comes back", async () => {
    mockedSparql.mockResolvedValue(ROWS);
    const { prisma, upsert } = makePrisma();

    await runStructuredIngest(prisma, { contentType: "POPE", batch: 4 });

    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0] as { create: { memoryValue: { offset: number } } };
    expect(arg.create.memoryValue.offset).toBe(4); // offset 0 + 4 fetched
  });

  it("is a clean no-op when the source returns nothing", async () => {
    mockedSparql.mockResolvedValue([]);
    const { prisma } = makePrisma();

    const out = await runStructuredIngest(prisma, { contentType: "POPE" });

    expect(out.fetched).toBe(0);
    expect(out.published).toBe(0);
    expect(out.exhausted).toBe(true);
    expect(mockedPublish).not.toHaveBeenCalled();
  });
});
