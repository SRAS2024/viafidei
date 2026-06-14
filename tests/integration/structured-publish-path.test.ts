/**
 * Integration proof: a structured-ingest record actually publishes through the
 * REAL publish orchestrator into the REAL database. The unit tests mock
 * `runPublishOrchestrator`, so they cannot catch a publish gate that silently
 * rejects structured content — which would present in production as "structured
 * ingest fetches rows but nothing ever appears." This test closes that gap:
 * only the network (Wikidata SPARQL + Wikipedia summary) is mocked; the publish
 * path, schema validation, dedup, and persistence are all real.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikidata", async (orig) => {
  const actual = await orig<typeof import("@/lib/admin-worker/structured/wikidata")>();
  return { ...actual, runSparql: vi.fn() };
});
vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(),
}));

import { prisma } from "@/lib/db/client";
import { runStructuredIngest } from "@/lib/admin-worker/structured/ingest";
import { runSparql, type SparqlBinding } from "@/lib/admin-worker/structured/wikidata";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import { seedContentGoals } from "@/lib/admin-worker/content-goals";

const mockedSparql = vi.mocked(runSparql);
const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);

const SLUG = "test-devotion-to-the-sacred-heart-xyz";
const EXTRACT =
  "Devotion to the Sacred Heart of Jesus is one of the most widely practised Catholic " +
  "devotions, taking the heart of Christ as the representation of his divine love for " +
  "humanity, honoured especially on the First Fridays of each month.";

function row(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = { type: "literal", value: v };
  return b;
}

async function cleanup() {
  await prisma.publishedContent.deleteMany({ where: { slug: SLUG } }).catch(() => undefined);
  await prisma.checklistItem.deleteMany({ where: { canonicalSlug: SLUG } }).catch(() => undefined);
  await prisma.adminWorkerMemory
    .deleteMany({ where: { memoryKey: "structured-cursor:wikidata-devotions" } })
    .catch(() => undefined);
}

describe("structured ingest → real publish gate (integration)", () => {
  beforeEach(async () => {
    await seedContentGoals(prisma);
    await cleanup();
    mockedSummary.mockReset();
    mockedSparql.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(cleanup);

  it("publishes a structured DEVOTION through the REAL orchestrator into the DB", async () => {
    // Row carries only the Wikipedia article (no official site), so the mapper's
    // narrative comes from the mocked Wikipedia summary — no real network needed.
    mockedSummary.mockResolvedValue({
      extract: EXTRACT,
      url: "https://en.wikipedia.org/wiki/Sacred_Heart_test",
    } as never);
    mockedSparql.mockResolvedValue([
      row({
        d: "http://www.wikidata.org/entity/Q_test_sacred_heart",
        label: "Test Devotion to the Sacred Heart Xyz",
        art: "https://en.wikipedia.org/wiki/Sacred_Heart_test",
      }),
    ]);

    const before = await prisma.publishedContent.count({
      where: { isPublished: true, contentType: "DEVOTION" },
    });

    const out = await runStructuredIngest(prisma, { contentType: "DEVOTION" });

    // The decisive assertions: the orchestrator actually published it, and the
    // row is really in the DB, published.
    expect(out.errors).toEqual([]);
    expect(out.published).toBe(1);

    const live = await prisma.publishedContent.findFirst({
      where: { slug: SLUG, contentType: "DEVOTION" },
      select: { isPublished: true, title: true },
    });
    expect(live?.isPublished).toBe(true);

    const after = await prisma.publishedContent.count({
      where: { isPublished: true, contentType: "DEVOTION" },
    });
    expect(after).toBe(before + 1);
  });
});
