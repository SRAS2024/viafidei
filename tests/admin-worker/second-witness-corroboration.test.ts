/**
 * The second witness for DEVOTION, LITURGICAL and SPIRITUAL_PRACTICE web
 * artifacts comes from cross-source verification — end to end, with nothing
 * injected.
 *
 * Their schemas require two citations, and the only second citation the
 * registry accepts is the page of a stored cross-source MATCH. Verification
 * only runs for an artifact with validation needs, and these types had none:
 * every one of them was refused with INSUFFICIENT_CITATIONS, held for research,
 * requeued 7–90 days later straight back to QA_PASSED (its strict-QA row is
 * reused) and refused again, forever. The publish-payload tests passed only
 * because they inject a corroborating URL.
 *
 * Now each of these types carries a name need. These run the real
 * verification stage (its corpus search over stored source-reads from OTHER
 * hosts), the real strict QA and the real publish stage over one in-memory
 * store, and assert what actually reaches the publish orchestrator: the page
 * that confirmed the item is the second citation and the proof's agreement.
 * Without such a page, nothing publishes.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
  delete process.env.ADMIN_WORKER_DEV_VALIDATION_HOSTS;
});

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/repair-plans", () => ({
  filePlan: vi.fn(async () => ({ id: "rp" })),
}));
vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/publish-orchestrator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-worker/publish-orchestrator")>()),
  runPublishOrchestrator: vi.fn(async () => ({
    kind: "published" as const,
    publishedContentId: "pub-1",
    slug: "s",
    route: "/r",
    reason: "ok",
  })),
}));

import { buildContentPackage } from "@/lib/admin-worker/content-builder";
import {
  runCrossSourceVerification,
  runPersistAndPublish,
  runStrictQA,
} from "@/lib/admin-worker/dispatcher";
import {
  DevotionExtractor,
  LiturgyExtractor,
  SpiritualPracticeExtractor,
} from "@/lib/admin-worker/extractors";
import {
  buildProofEvidence,
  collectCitations,
  runPublishOrchestrator,
} from "@/lib/admin-worker/publish-orchestrator";
import { cleanSourceTitle } from "@/lib/admin-worker/web-extraction-helpers";

interface Read {
  sourceUrl: string;
  sourceHost: string;
  extractedText: string;
}

/** A tiny in-memory store with just the queries these stages make. */
function store(artifact: Record<string, unknown>, primary: Read, corpus: Read[]) {
  const a = { ...artifact };
  const evidence: Array<Record<string, unknown>> = [];
  let qa: Record<string, unknown> | null = null;
  const memory = new Map<string, unknown>();

  // Enough of Prisma's where-language for these stages' artifact queries.
  const matches = (where: Record<string, unknown> | undefined): boolean => {
    if (!where) return true;
    return Object.entries(where).every(([k, cond]) => {
      if (k === "OR") return (cond as Array<Record<string, unknown>>).some((c) => matches(c));
      const v = a[k];
      if (cond && typeof cond === "object" && !Array.isArray(cond)) {
        const c = cond as Record<string, unknown>;
        if ("isEmpty" in c) return (Array.isArray(v) && v.length === 0) === c.isEmpty;
        if ("in" in c) return (c.in as unknown[]).includes(v);
        if ("notIn" in c) return !(c.notIn as unknown[]).includes(v);
      }
      return v === cond;
    });
  };
  const evidenceMatches = (
    where: Record<string, unknown> | undefined,
    row: Record<string, unknown>,
  ) =>
    Object.entries(where ?? {}).every(([k, cond]) =>
      cond && typeof cond === "object" && "in" in (cond as Record<string, unknown>)
        ? ((cond as { in: unknown[] }).in as unknown[]).includes(row[k])
        : row[k] === cond,
    );

  const prisma = {
    adminWorkerPackageArtifact: {
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> } = {}) =>
        matches(args.where) ? a : null,
      ),
      findMany: vi.fn(async (args: { where?: Record<string, unknown> } = {}) =>
        matches(args.where) ? [a] : [],
      ),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => {
        Object.assign(a, args.data);
        return a;
      }),
    },
    adminWorkerSourceRead: {
      findUnique: vi.fn(async () => ({
        sourceHost: primary.sourceHost,
        sourceUrl: primary.sourceUrl,
      })),
      // The corpus witness search: another host's stored page that names it.
      findMany: vi.fn(
        async (args: {
          where: {
            sourceHost?: { not: string };
            AND: Array<{ extractedText: { contains: string } }>;
          };
        }) =>
          corpus.filter(
            (r) =>
              r.sourceHost !== args.where.sourceHost?.not &&
              args.where.AND.every((c) =>
                r.extractedText.toLowerCase().includes(c.extractedText.contains.toLowerCase()),
              ),
          ),
      ),
    },
    adminWorkerSourceReputation: { findMany: vi.fn(async () => []) },
    adminWorkerCrossSourceVerification: {
      count: vi.fn(
        async (args: { where?: Record<string, unknown> } = {}) =>
          evidence.filter((r) => evidenceMatches(args.where, r)).length,
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        evidence.push({ id: `v${evidence.length + 1}`, ...args.data });
        return { id: `v${evidence.length}` };
      }),
      findMany: vi.fn(async (args: { where?: Record<string, unknown> } = {}) =>
        evidence.filter((r) => evidenceMatches(args.where, r)),
      ),
      deleteMany: vi.fn(async () => {
        const count = evidence.length;
        evidence.length = 0;
        return { count };
      }),
    },
    adminWorkerRepairPlan: { count: vi.fn(async () => 0) },
    adminWorkerStrictQAResult: {
      findUnique: vi.fn(async () => qa),
      upsert: vi.fn(async (args: { create: Record<string, unknown> }) => {
        qa = { id: "qa-1", ...args.create };
        return { id: "qa-1" };
      }),
    },
    publishedContent: { count: vi.fn(async () => 0) },
    adminWorkerMemory: {
      findUnique: vi.fn(async (args: { where: { memoryType_memoryKey: { memoryKey: string } } }) =>
        memory.has(args.where.memoryType_memoryKey.memoryKey)
          ? { memoryValue: memory.get(args.where.memoryType_memoryKey.memoryKey) }
          : null,
      ),
      upsert: vi.fn(
        async (args: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          update: { memoryValue: unknown };
        }) => {
          memory.set(args.where.memoryType_memoryKey.memoryKey, args.update.memoryValue);
          return {};
        },
      ),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  };
  return { prisma: prisma as never, artifact: a, evidence };
}

type Extract = typeof DevotionExtractor;

/** An artifact exactly as EXTRACTION + the checklist bridge leave it. */
function builtArtifact(type: string, extract: Extract, page: Read & { title: string }) {
  const out = extract({
    url: page.sourceUrl,
    host: page.sourceHost,
    title: page.title,
    bodyText: page.extractedText,
  });
  const pkg = buildContentPackage({
    contentType: type,
    extractor: out as never,
    title: cleanSourceTitle(page.title, page.sourceHost) ?? page.title,
  });
  expect(pkg.missingFields).toEqual([]);
  return {
    id: `art-${type.toLowerCase()}`,
    contentType: type,
    normalizedTitle: pkg.normalizedTitle,
    normalizedSlug: pkg.normalizedSlug,
    extractedFields: pkg.displayFields,
    fieldProvenance: pkg.fieldProvenance,
    missingFields: [],
    validationNeeds: pkg.validationNeeds,
    formattingMetadata: pkg.formattingMetadata,
    confidenceScore: pkg.confidenceByPackage,
    packageChecksum: pkg.duplicateKeys.titleHash,
    status: "BUILD_READY",
    sourceReadId: "sr-1",
    checklistItemId: "ci-1",
  };
}

const CASES: Array<{
  type: string;
  extract: Extract;
  need: string;
  page: Read & { title: string };
  witness: Read;
}> = [
  {
    type: "DEVOTION",
    extract: DevotionExtractor,
    need: "devotionTitle",
    page: {
      title: "The Chaplet of Divine Mercy | EWTN",
      sourceUrl: "https://www.ewtn.com/catholicism/devotions/chaplet-of-divine-mercy",
      sourceHost: "www.ewtn.com",
      extractedText:
        "The Chaplet of Divine Mercy was given by Jesus to Saint Faustina Kowalska in 1935 as a prayer for mercy on the whole world.\n\nHow to pray: begin with the Sign of the Cross, one Our Father, one Hail Mary and the Apostles' Creed, then pray the five decades on ordinary rosary beads.\n\n",
    },
    witness: {
      sourceUrl: "https://www.thedivinemercy.org/message/devotions/chaplet",
      sourceHost: "www.thedivinemercy.org",
      extractedText:
        "How to recite the Chaplet of Divine Mercy, which Our Lord taught to Saint Faustina.",
    },
  },
  {
    type: "LITURGICAL",
    extract: LiturgyExtractor,
    need: "liturgyTitle",
    page: {
      title: "Liturgical Year and Calendar | USCCB",
      sourceUrl: "https://www.usccb.org/prayer-and-worship/liturgical-year",
      sourceHost: "www.usccb.org",
      extractedText:
        "The liturgical year is the cycle of seasons and feasts through which the Church celebrates the whole mystery of Christ, from Advent to the Solemnity of Christ the King. Each season has its own character and readings.",
    },
    witness: {
      sourceUrl: "https://www.vatican.va/roman_curia/liturgical-year-and-calendar.html",
      sourceHost: "www.vatican.va",
      extractedText:
        "Universal norms on the liturgical year and calendar, approved by Pope Paul VI.",
    },
  },
  {
    type: "SPIRITUAL_PRACTICE",
    extract: SpiritualPracticeExtractor,
    need: "title",
    page: {
      title: "Lectio Divina | Catholic Culture",
      sourceUrl: "https://www.catholicculture.org/culture/liturgicalyear/lectio-divina",
      sourceHost: "www.catholicculture.org",
      extractedText:
        "Lectio divina is the slow, prayerful reading of Scripture handed down by the monastic tradition of the Church. It moves through reading, meditation, prayer and contemplation, letting the Word take root in the heart.\n\nHow to practice: choose a short passage of Scripture, read it slowly twice, and stay with the word or phrase that strikes you.",
    },
    witness: {
      sourceUrl: "https://www.usccb.org/prayer-and-worship/prayers/lectio-divina",
      sourceHost: "www.usccb.org",
      extractedText: "Lectio Divina is a way of praying with Scripture.",
    },
  },
];

beforeEach(() => {
  vi.mocked(runPublishOrchestrator).mockClear();
});

describe.each(CASES)("$type web artifact", ({ type, extract, need, page, witness }) => {
  it(`carries the ${need} need from extraction`, () => {
    const artifact = builtArtifact(type, extract, page);
    expect(artifact.validationNeeds).toEqual([need]);
  });

  it("publishes with the confirming page as its second citation and proof agreement", async () => {
    const { prisma, artifact, evidence } = store(builtArtifact(type, extract, page), page, [
      // The item's own site never corroborates it …
      { ...page, sourceUrl: `${page.sourceUrl}?print=1` },
      witness,
    ]);
    await runCrossSourceVerification(prisma, "p1");
    expect(evidence.some((r) => r.matchResult === "MATCH")).toBe(true);
    expect(artifact.status).toBe("VERIFICATION_READY");

    await runStrictQA(prisma, "p1");
    expect(artifact.status).toBe("QA_PASSED");

    const out = await runPersistAndPublish(prisma, "w1", "p1");
    expect(out.kind).toBe("advanced");
    expect(artifact.status).toBe("PUBLISHED");
    const input = vi.mocked(runPublishOrchestrator).mock.calls[0][1];
    const payload = input.payload as Record<string, unknown>;
    expect(payload.citations).toEqual([page.sourceUrl, witness.sourceUrl]);
    expect(input.corroboratingSources).toEqual([witness.sourceUrl]);
    const proof = buildProofEvidence(input, collectCitations(payload));
    expect(proof.agreements).toBe(1);
    expect(proof.sources).toHaveLength(2);
  });

  it("without an independent page naming it, verification blocks and nothing publishes", async () => {
    const { prisma, artifact } = store(builtArtifact(type, extract, page), page, [
      { ...page, sourceUrl: `${page.sourceUrl}?print=1` },
    ]);
    await runCrossSourceVerification(prisma, "p1");
    expect(artifact.status).toBe("NEEDS_REPAIR");
    expect(String(artifact.rejectionReason)).toContain(need);
    await runStrictQA(prisma, "p1");
    await runPersistAndPublish(prisma, "w1", "p1");
    expect(vi.mocked(runPublishOrchestrator)).not.toHaveBeenCalled();
    expect(artifact.status).toBe("NEEDS_REPAIR");
  });
});
