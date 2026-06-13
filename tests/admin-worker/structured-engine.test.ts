/**
 * Engine-level guarantees for the structured ingestor: the DOCTOR ingestor, the
 * cross-slug name dedup that stops structured records from duplicating curated
 * pages, and the goal-aware ingestor selection that focuses the worker where the
 * headroom actually is.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(),
}));
vi.mock("@/lib/admin-worker/structured/wikidata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/structured/wikidata")>();
  return { ...actual, runSparql: vi.fn() };
});
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import { ingestorFor, normalizeName } from "@/lib/admin-worker/structured/ingestors";
import { runStructuredIngest } from "@/lib/admin-worker/structured/ingest";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import { runSparql, type SparqlBinding } from "@/lib/admin-worker/structured/wikidata";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";

const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);
const mockedSparql = vi.mocked(runSparql);
const mockedPublish = vi.mocked(runPublishOrchestrator);

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;

beforeEach(() => {
  savedSkip = process.env[SKIP];
  mockedSummary.mockReset();
  mockedSparql.mockReset();
  mockedPublish.mockReset();
  mockedPublish.mockResolvedValue({ kind: "published" } as never);
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
  vi.restoreAllMocks();
});

function row(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = { type: "literal", value: v };
  return b;
}

describe("normalizeName", () => {
  it("collapses honorific-prefix variants to one key", () => {
    expect(normalizeName("Pope Saint John Paul II")).toBe("john paul ii");
    expect(normalizeName("Pope John Paul II")).toBe("john paul ii");
    expect(normalizeName("Saint Rose of Lima")).toBe("rose of lima");
    expect(normalizeName("Rerum novarum")).toBe("rerum novarum");
  });
  it("keeps distinguishing tokens distinct", () => {
    expect(normalizeName("Pope Pius X")).not.toBe(normalizeName("Pope Pius XI"));
  });
});

describe("DOCTOR ingestor mapping", () => {
  function doctorMap(r: SparqlBinding) {
    return ingestorFor("DOCTOR")!.map(r, {} as Record<string, never>);
  }

  it("maps to a SCHEMA-VALID doctor entry, prefixing 'Saint' when absent", async () => {
    mockedSummary.mockResolvedValue({
      extract:
        "Thomas Aquinas was an Italian Dominican friar and Doctor of the Church whose works remain central to Catholic theology.",
      url: "https://en.wikipedia.org/wiki/Thomas_Aquinas",
    });
    const entry = await doctorMap(
      row({
        d: "http://www.wikidata.org/entity/Q9438",
        label: "Thomas Aquinas",
        art: "https://en.wikipedia.org/wiki/Thomas_Aquinas",
      }),
    );
    expect(entry).not.toBeNull();
    expect(entry!.slug).toBe("doctor-thomas-aquinas");
    expect(entry!.payload.title).toBe("Saint Thomas Aquinas");
    expect(validatePayload("DOCTOR", entry!.payload).ok).toBe(true);
  });

  it("does not double-prefix an already-titled label", async () => {
    mockedSummary.mockResolvedValue(null);
    const entry = await doctorMap(
      row({ d: "http://www.wikidata.org/entity/Q9620", label: "Pope Gregory I" }),
    );
    expect(entry!.payload.title).toBe("Pope Gregory I");
  });
});

describe("runStructuredIngest — cross-slug name dedup", () => {
  it("skips an entry already live under a different slug convention", async () => {
    process.env[SKIP] = "1";
    mockedSparql.mockResolvedValue([
      row({
        pope: "http://www.wikidata.org/entity/Q989",
        popeLabel: "John Paul II",
        startYear: "1978",
        endYear: "2005",
      }),
    ]);
    const prisma = {
      adminWorkerMemory: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
      publishedContent: {
        // Curated row under the "pope-saint-…" convention; structured slug differs.
        findMany: vi.fn(async () => [
          { slug: "pope-saint-john-paul-ii", title: "Pope Saint John Paul II" },
        ]),
        count: vi.fn(async () => 0),
      },
      checklistItem: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "c" })),
      },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const out = await runStructuredIngest(prisma, { contentType: "POPE" });

    expect(out.published).toBe(0);
    expect(out.alreadyPublished).toBe(1);
    expect(mockedPublish).not.toHaveBeenCalled();
  });
});

describe("runStructuredIngest — goal-aware selection", () => {
  it("picks the content type furthest from its goal", async () => {
    process.env[SKIP] = "1";
    mockedSparql.mockResolvedValue([]);
    const live: Record<string, number> = {
      POPE: 264,
      SAINT: 100,
      CHURCH_DOCUMENT: 50,
      DOCTOR: 37,
      RITE: 20,
      // The descriptive ingestors are at goal here, so SAINT stays the neediest.
      DEVOTION: 100,
      MARIAN_TITLE: 50,
      SPIRITUAL_PRACTICE: 50,
    };
    const target: Record<string, number> = {
      POPE: 264,
      SAINT: 10000,
      CHURCH_DOCUMENT: 200,
      DOCTOR: 37,
      RITE: 24,
      DEVOTION: 100,
      MARIAN_TITLE: 50,
      SPIRITUAL_PRACTICE: 50,
    };
    const prisma = {
      adminWorkerMemory: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
      publishedContent: {
        count: vi.fn(
          async (args: { where: { contentType: string } }) => live[args.where.contentType] ?? 0,
        ),
        findMany: vi.fn(async () => []),
      },
      contentGoal: {
        findUnique: vi.fn(async (args: { where: { contentType: string } }) => ({
          desiredTarget: target[args.where.contentType] ?? 0,
        })),
      },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const out = await runStructuredIngest(prisma, {});

    expect(out.contentType).toBe("SAINT");
    expect(out.ingestorId).toBe("wikidata-saints");
  });
});
