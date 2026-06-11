/**
 * Source self-expansion: as the worker ingests entities it learns new
 * authoritative places to pull content from, adding their official websites to
 * its own discovery queue through the normal candidate guard. These tests pin
 * that wiring end-to-end: a row carrying an official site is enqueued (host
 * derived, routed through discoverCandidate); a row without one enqueues
 * nothing.
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

const mockedSparql = vi.mocked(runSparql);

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;

beforeEach(() => {
  savedSkip = process.env[SKIP];
  process.env[SKIP] = "1"; // keep the POPE mapper offline
  mockedSparql.mockReset();
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

function makePrisma() {
  const candidateUpsert = vi.fn(async () => ({ id: "c1", status: "DISCOVERED" }));
  return {
    prisma: {
      adminWorkerMemory: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({})),
      },
      publishedContent: {
        findMany: vi.fn(async () => [] as Array<{ slug: string }>),
        count: vi.fn(async () => 0),
      },
      checklistItem: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "ci1" })),
      },
      candidateSourceUrl: { upsert: candidateUpsert },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient,
    candidateUpsert,
  };
}

describe("structured ingest — source self-expansion", () => {
  it("adds an entity's official website to the discovery queue", async () => {
    mockedSparql.mockResolvedValue([
      row({
        pope: "http://www.wikidata.org/entity/Q989",
        popeLabel: "John Paul II",
        startYear: "1978",
        endYear: "2005",
        website: "https://www.vatican.va/content/john-paul-ii/en.html",
      }),
    ]);
    const { prisma, candidateUpsert } = makePrisma();

    const out = await runStructuredIngest(prisma, { contentType: "POPE" });

    expect(out.discoveredSources).toBe(1);
    expect(candidateUpsert).toHaveBeenCalledTimes(1);
    const arg = candidateUpsert.mock.calls[0][0] as {
      create: { discoveredUrl: string; sourceHost: string };
    };
    expect(arg.create.discoveredUrl).toContain("vatican.va");
    expect(arg.create.sourceHost).toBe("www.vatican.va");
  });

  it("enqueues nothing when the row carries no official website", async () => {
    mockedSparql.mockResolvedValue([
      row({
        pope: "http://www.wikidata.org/entity/Q450",
        popeLabel: "Francis",
        startYear: "2013",
      }),
    ]);
    const { prisma, candidateUpsert } = makePrisma();

    const out = await runStructuredIngest(prisma, { contentType: "POPE" });

    expect(out.discoveredSources).toBe(0);
    expect(candidateUpsert).not.toHaveBeenCalled();
  });
});
