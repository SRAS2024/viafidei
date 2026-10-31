/**
 * The LITURGICAL proof-publishing block (R5) and research holds.
 *
 * Live: "Publish blocked for LITURGICAL/liturgy-of-the-hours-usccb:
 * proof-based publishing: logic-rule invariants failed;
 * doctrinal_trusted_support" every ~10 minutes, for the same five
 * usccb.org / catholic.org / vatican.va items.
 *
 * Root cause, in two parts:
 *   1. The invariant was mis-evaluated. trustedSourceCount was the raw count of
 *      citations in the payload. A web artifact published its raw extractor
 *      fields, which carry no citations and no sourceUrl, so it counted ZERO
 *      trusted sources even when its page was usccb.org or vatican.va; and any
 *      two URLs, trusted or not, passed it for other callers. The proof ladder
 *      also ranked LITURGICAL_BOOK (icel.org) at -1, and the quality score's
 *      authority factor keyed on enum values that do not exist.
 *   2. Correctly counted, those items still have ONE trusted source: LITURGICAL
 *      carries no validation needs, so nothing ever looks for a second. That is
 *      a genuine evidence gap, and retrying it on the 10/20/40-minute review
 *      backoff (then again weekly) changed nothing but the log volume. Such an
 *      item is now held for research: a typed reason, a research flag, and a
 *      re-check only after 7 → 14 → … → 90 days.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/repair-plans", () => ({
  filePlan: vi.fn(async () => ({ id: "plan-1" })),
}));
vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/discovery-orchestrator", () => ({
  runDiscoveryOrchestrator: vi.fn(),
  CONTENT_TYPE_STRATEGIES: {},
}));
const orchestrator = { result: { kind: "review", reason: "" } as Record<string, unknown> };
vi.mock("@/lib/admin-worker/publish-orchestrator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/publish-orchestrator")>();
  return { ...actual, runPublishOrchestrator: vi.fn(async () => orchestrator.result) };
});

import type { PrismaClient } from "@prisma/client";

import type { BrainDecision } from "@/lib/admin-worker/brain";
import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import { readRetryBudget } from "@/lib/admin-worker/human-review";
import {
  buildInvariantState,
  buildProofEvidence,
  countCitedSources,
  sourceAuthorityFactor,
} from "@/lib/admin-worker/publish-orchestrator";
import {
  RESEARCH_HOLD_DIAGNOSIS,
  RESEARCH_RECHECK_DIAGNOSIS,
  holdForResearch,
  readResearchFlag,
  requeueDueResearchHolds,
  researchFlagKey,
  researchHoldCodeFor,
  researchHoldDelayMs,
} from "@/lib/admin-worker/research-holds";

const DAY = 24 * 60 * 60 * 1000;

let savedEnv: string | undefined;
beforeEach(() => {
  savedEnv = process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW;
  delete process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW;
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW;
  else process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW = savedEnv;
  vi.clearAllMocks();
});

describe("trusted-source evidence for the doctrinal invariant", () => {
  it("counts distinct registry-trusted SOURCES, not raw citation URLs", () => {
    // Two pages of the Holy See are one witness.
    expect(
      countCitedSources([
        "https://www.vatican.va/content/liturgy/a.html",
        "https://press.vatican.va/b.html",
      ]),
    ).toEqual({ sources: 1, trusted: 1 });
    expect(
      countCitedSources([
        "https://www.usccb.org/prayer-and-worship/liturgy-of-the-hours",
        "https://www.vatican.va/roman_curia/liturgy.html",
      ]),
    ).toEqual({ sources: 2, trusted: 2 });
    // A host no registry entry vouches for is a source, not a trusted one.
    expect(
      countCitedSources(["https://www.usccb.org/x", "https://some-parish-blog.example/x"]),
    ).toEqual({ sources: 2, trusted: 1 });
    expect(countCitedSources(["not a url"])).toEqual({ sources: 0, trusted: 0 });
  });

  it("the invariant state carries the trusted-source count, not the citation count", () => {
    const state = buildInvariantState(
      {
        contentType: "LITURGICAL",
        title: "Liturgy of the Hours",
        slug: "liturgy-of-the-hours",
        authorityLevel: "USCCB",
        isDoctrinallySensitive: false,
      },
      ["https://www.usccb.org/a", "https://www.usccb.org/b"],
      "https://www.usccb.org/a",
      null,
    );
    expect(state.trustedSourceCount).toBe(1);
    expect(state.sourceCount).toBe(1);
  });

  it("names the liturgical-book authority the way the brain's proof ladder does", () => {
    const ev = buildProofEvidence({ authorityLevel: "LITURGICAL_BOOK" }, []);
    expect(ev.authorities).toEqual(["LITURGICAL"]);
    expect(buildProofEvidence({ authorityLevel: "USCCB" }, []).authorities).toEqual(["USCCB"]);
  });

  it("scores the real SourceAuthorityLevel values (USCCB no longer below DIOCESAN)", () => {
    expect(sourceAuthorityFactor("VATICAN")).toBe(1);
    expect(sourceAuthorityFactor("USCCB")).toBe(0.95);
    expect(sourceAuthorityFactor("CATECHISM")).toBe(0.95);
    expect(sourceAuthorityFactor("LITURGICAL_BOOK")).toBe(0.95);
    expect(sourceAuthorityFactor("DIOCESAN")).toBe(0.88);
    expect(sourceAuthorityFactor("TRUSTED_PUBLISHER")).toBe(0.85);
    expect(sourceAuthorityFactor("COMMUNITY")).toBe(0.78);
    expect(sourceAuthorityFactor("USCCB")).toBeGreaterThan(sourceAuthorityFactor("DIOCESAN"));
  });
});

describe("researchHoldCodeFor", () => {
  it("classifies proof-gate evidence gaps, and only those", () => {
    expect(
      researchHoldCodeFor(
        "proof-based publishing: logic-rule invariants failed; doctrinal_trusted_support",
      ),
    ).toBe("INSUFFICIENT_TRUSTED_SOURCES");
    expect(
      researchHoldCodeFor(
        "proof-based publishing: proof incomplete (failed: source_support, agreement) — routing to review",
      ),
    ).toBe("INSUFFICIENT_TRUSTED_SOURCES");
    expect(
      researchHoldCodeFor(
        "proof-based publishing: proof holds but the sensitive type's evidence is below Vatican authority — routing to review",
      ),
    ).toBe("BELOW_REQUIRED_AUTHORITY");
    // The brain being down is transient: keep the short retry.
    expect(
      researchHoldCodeFor(
        "proof-based publishing: proof required but the intelligence brain is offline — routing to review",
      ),
    ).toBeNull();
    expect(researchHoldCodeFor("finalScore 0.83 < 0.85")).toBeNull();
    expect(researchHoldCodeFor(null)).toBeNull();
  });

  it("backs off 7 → 14 → 28 … days, capped at 90", () => {
    expect(researchHoldDelayMs(1)).toBe(7 * DAY);
    expect(researchHoldDelayMs(2)).toBe(14 * DAY);
    expect(researchHoldDelayMs(3)).toBe(28 * DAY);
    expect(researchHoldDelayMs(9)).toBe(90 * DAY);
  });
});

/** In-memory AdminWorkerMemory so flags and budgets round-trip. */
function memoryStore() {
  const rows = new Map<string, { memoryValue: unknown }>();
  return {
    rows,
    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) =>
          rows.get(where.memoryType_memoryKey.memoryKey) ?? null,
      ),
      upsert: vi.fn(
        async ({
          where,
          update,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          update: { memoryValue: unknown };
        }) => {
          rows.set(where.memoryType_memoryKey.memoryKey, { memoryValue: update.memoryValue });
          return {};
        },
      ),
      deleteMany: vi.fn(async ({ where }: { where: { memoryKey: string } }) => {
        rows.delete(where.memoryKey);
        return { count: 1 };
      }),
    },
  };
}

function publishDecision(): BrainDecision {
  return {
    chosenMode: "CONSTANT_FILL",
    chosenPriority: "CONTENT_GOAL",
    chosenTaskType: "PUBLIC_PUBLISH",
    passType: "CONTENT_GOAL",
    contentType: "LITURGICAL",
    sourceTarget: null,
    expectedResult: "publish",
    confidenceScore: 0.9,
    riskScore: 0.1,
    reason: "test",
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: { missionStage: "PUBLIC_PUBLISH" },
    rankedAlternatives: [],
    missionStage: "PUBLIC_PUBLISH",
    brainExplanation: "test",
    brainFailure: null,
  } as unknown as BrainDecision;
}

describe("a doctrinal_trusted_support review is held for research, not retried", () => {
  function publishPrisma(
    mem = memoryStore(),
    corroborated = true,
    validationNeeds: string[] = ["liturgyTitle"],
  ) {
    const artifactUpdate = vi.fn(async () => ({}));
    const evidenceDeletes = vi.fn(async () => ({ count: 0 }));
    return {
      artifactUpdate,
      evidenceDeletes,
      mem,
      adminWorkerPackageArtifact: {
        findFirst: vi.fn(async () => ({
          id: "art-loh",
          contentType: "LITURGICAL",
          normalizedTitle: "Liturgical Year and Calendar",
          normalizedSlug: "liturgical-year-and-calendar-usccb",
          extractedFields: {
            liturgyTitle: "Liturgical Year and Calendar | USCCB",
            liturgyType: "mass",
            summary:
              "The liturgical year is the cycle of seasons and feasts through which the Church celebrates the mystery of Christ.",
            formationBody:
              "The liturgical year is the cycle of seasons and feasts through which the Church celebrates the mystery of Christ over the course of each year.",
          },
          fieldProvenance: [{ fieldName: "liturgyTitle", sourceUrl: "x", sourceHost: "usccb.org" }],
          missingFields: [],
          validationNeeds,
          confidenceScore: 0.92,
          status: "QA_PASSED",
          checklistItemId: "ci-1",
          sourceReadId: "sr-1",
        })),
        update: artifactUpdate,
      },
      adminWorkerSourceRead: {
        findUnique: vi.fn(async () => ({
          sourceHost: "www.usccb.org",
          sourceUrl: "https://www.usccb.org/prayer-and-worship/liturgical-year",
        })),
      },
      adminWorkerStrictQAResult: {
        findUnique: vi.fn(async () => ({
          id: "qa-1",
          status: "PASSED",
          finalScore: 0.92,
          blockingReasons: [],
          repairSuggestions: [],
        })),
      },
      adminWorkerCrossSourceVerification: {
        count: vi.fn(async () => 0),
        deleteMany: evidenceDeletes,
        // One independent page, so the LITURGICAL schema (≥2 citations) maps
        // and the outcome under test is the proof gate's.
        findMany: vi.fn(async () =>
          corroborated
            ? [
                {
                  matchResult: "MATCH",
                  validationSourceUrl: "https://www.vatican.va/liturgical-year.html",
                },
              ]
            : [],
        ),
      },
      adminWorkerMemory: mem.adminWorkerMemory,
    } as unknown as Parameters<typeof executeMissionStage>[0]["prisma"] & {
      artifactUpdate: ReturnType<typeof vi.fn>;
      evidenceDeletes: ReturnType<typeof vi.fn>;
      mem: ReturnType<typeof memoryStore>;
    };
  }

  it("parks with a typed reason + NEEDS_RESEARCH, flags it, and spends no retry budget", async () => {
    orchestrator.result = {
      kind: "review",
      reason: "proof-based publishing: logic-rule invariants failed; doctrinal_trusted_support",
    };
    const prisma = publishPrisma();
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: publishDecision(),
    });
    const calls = prisma.artifactUpdate.mock.calls as unknown as Array<
      [{ data: Record<string, unknown> }]
    >;
    const data = calls[calls.length - 1][0].data;
    expect(data.status).toBe("NEEDS_REVIEW");
    expect(data.gateDiagnosis).toBe(RESEARCH_HOLD_DIAGNOSIS);
    expect(String(data.rejectionReason)).toMatch(/^INSUFFICIENT_TRUSTED_SOURCES: /);
    expect(out.summary).toMatch(/autonomous research/);
    // No 10-minute retry is scheduled …
    expect((await readRetryBudget(prisma, "review", "art-loh")).attempts).toBe(0);
    // … a research flag is, a week out.
    const flag = await readResearchFlag(prisma, "art-loh");
    expect(flag).toMatchObject({ code: "INSUFFICIENT_TRUSTED_SOURCES", attempts: 1 });
    const wait = new Date(flag!.nextAttemptAt).getTime() - Date.now();
    expect(wait).toBeGreaterThan(6.9 * DAY);
  });

  it("a second hold doubles the backoff", async () => {
    const mem = memoryStore();
    const prisma = publishPrisma(mem);
    const base = {
      artifactId: "art-loh",
      contentType: "LITURGICAL",
      slug: "liturgy-of-the-hours-usccb",
      code: "INSUFFICIENT_TRUSTED_SOURCES" as const,
      detail: "one trusted source",
      missing: ["a second independent trusted source confirming this item"],
    };
    await holdForResearch(prisma as unknown as PrismaClient, base);
    const second = await holdForResearch(prisma as unknown as PrismaClient, base);
    expect(second.attempts).toBe(2);
    expect(second.nextAttemptAt.getTime() - Date.now()).toBeGreaterThan(13.9 * DAY);
    expect(mem.rows.has(researchFlagKey("art-loh"))).toBe(true);
  });

  // The live five: one usccb.org / catholic.org / vatican.va page and nothing
  // else. The LITURGICAL schema needs two citations, so the payload is refused
  // before the proof gate is ever asked. Built before LITURGICAL carried its
  // name need, nothing ever looked for a second page: it goes to cross-source
  // verification with the need added, not onto a research hold that would
  // refuse it for the same single citation every 7–90 days.
  it("a single-source LITURGICAL page built without the need is sent to verification", async () => {
    const { runPublishOrchestrator } = await import("@/lib/admin-worker/publish-orchestrator");
    vi.mocked(runPublishOrchestrator).mockClear();
    const prisma = publishPrisma(memoryStore(), false, []);
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: publishDecision(),
    });
    expect(vi.mocked(runPublishOrchestrator)).not.toHaveBeenCalled();
    const calls = prisma.artifactUpdate.mock.calls as unknown as Array<
      [{ data: Record<string, unknown> }]
    >;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].data).toMatchObject({
      status: "BUILD_READY",
      validationNeeds: ["liturgyTitle"],
      gateDiagnosis: null,
    });
    expect(prisma.evidenceDeletes).toHaveBeenCalledWith({ where: { contentId: "art-loh" } });
    expect(out.kind).toBe("repair-planned");
    expect(await readResearchFlag(prisma, "art-loh")).toBeNull();
  });

  // Once it has been through verification with the need, a single citation is
  // a genuine evidence gap: held for research, not retried.
  it("a single-source LITURGICAL page that was verified is held for research", async () => {
    orchestrator.result = { kind: "published", publishedContentId: "x", slug: "s", route: "/r" };
    const { runPublishOrchestrator } = await import("@/lib/admin-worker/publish-orchestrator");
    vi.mocked(runPublishOrchestrator).mockClear();
    const prisma = publishPrisma(memoryStore(), false);
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: publishDecision(),
    });
    expect(vi.mocked(runPublishOrchestrator)).not.toHaveBeenCalled();
    const calls = prisma.artifactUpdate.mock.calls as unknown as Array<
      [{ data: Record<string, unknown> }]
    >;
    const data = calls[calls.length - 1][0].data;
    expect(data.status).toBe("NEEDS_REVIEW");
    expect(data.gateDiagnosis).toBe(RESEARCH_HOLD_DIAGNOSIS);
    expect(String(data.rejectionReason)).toMatch(/^INSUFFICIENT_CITATIONS: LITURGICAL schema/);
    expect(out.summary).toMatch(/Held LITURGICAL\/liturgical-year-and-calendar-usccb for research/);
    expect(await readResearchFlag(prisma, "art-loh")).toMatchObject({
      code: "INSUFFICIENT_CITATIONS",
    });
  });

  it("the brain being offline still gets the short retry", async () => {
    orchestrator.result = {
      kind: "review",
      reason:
        "proof-based publishing: proof required but the intelligence brain is offline — routing to review",
    };
    const prisma = publishPrisma();
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: publishDecision(),
    });
    expect((await readRetryBudget(prisma, "review", "art-loh")).attempts).toBe(1);
    expect(await readResearchFlag(prisma, "art-loh")).toBeNull();
  });
});

describe("the drain's short review retry never undoes a research hold", () => {
  it("skips a NEEDS_RESEARCH artifact even though its reason names the proof gate", async () => {
    let status = "NEEDS_REVIEW";
    const mem = memoryStore();
    const prisma = {
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
          where?.status === "NEEDS_REVIEW" && status === "NEEDS_REVIEW"
            ? [
                {
                  id: "art-loh",
                  fieldProvenance: [{ field: "x" }],
                  gateDiagnosis: RESEARCH_HOLD_DIAGNOSIS,
                  rejectionReason:
                    "INSUFFICIENT_TRUSTED_SOURCES: proof-based publishing: logic-rule invariants failed; doctrinal_trusted_support [research hold 1; re-check after 2026-11-07]",
                },
              ]
            : [],
        ),
        count: vi.fn(async () => 0),
        update: vi.fn(async ({ data }: { data?: Record<string, unknown> } = {}) => {
          if (typeof data?.status === "string") status = data.status;
          return undefined;
        }),
      },
      adminWorkerStrictQAResult: { findUnique: vi.fn(async () => ({ status: "PASSED" })) },
      adminWorkerCrossSourceVerification: { groupBy: vi.fn(async () => []) },
      publishedContent: { findMany: vi.fn(async () => []) },
      adminWorkerMemory: mem.adminWorkerMemory,
    } as never;
    const { runBuildReadyDrain } = await import("@/lib/admin-worker/build-ready-drain");
    const r = await runBuildReadyDrain(prisma, { active: true, driveRounds: 0 });
    expect(r.recovered).toBe(0);
    expect(status).toBe("NEEDS_REVIEW");
  });
});

describe("requeueDueResearchHolds", () => {
  function holdsPrisma(flags: Record<string, { nextAttemptAt: string }>) {
    const mem = memoryStore();
    for (const [id, f] of Object.entries(flags)) {
      mem.rows.set(researchFlagKey(id), { memoryValue: { attempts: 1, ...f } });
    }
    const moved: string[] = [];
    const wiped: string[] = [];
    const prisma = {
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async () => Object.keys(flags).map((id) => ({ id }))),
        updateMany: vi.fn(
          async (args: {
            where: { id: string };
            data: { status: string; gateDiagnosis: string };
          }) => {
            moved.push(args.where.id);
            expect(args.data).toMatchObject({
              status: "BUILD_READY",
              gateDiagnosis: RESEARCH_RECHECK_DIAGNOSIS,
            });
            return { count: 1 };
          },
        ),
      },
      adminWorkerCrossSourceVerification: {
        deleteMany: vi.fn(async (args: { where: { contentId: string } }) => {
          wiped.push(args.where.contentId);
          return { count: 2 };
        }),
      },
      adminWorkerMemory: mem.adminWorkerMemory,
    } as unknown as PrismaClient;
    return { prisma, moved, wiped };
  }

  it("requeues only holds whose backoff has expired, clearing their stale evidence", async () => {
    const { prisma, moved, wiped } = holdsPrisma({
      "art-due": { nextAttemptAt: new Date(Date.now() - DAY).toISOString() },
      "art-waiting": { nextAttemptAt: new Date(Date.now() + 3 * DAY).toISOString() },
    });
    const n = await requeueDueResearchHolds(prisma);
    expect(n).toBe(1);
    expect(moved).toEqual(["art-due"]);
    expect(wiped).toEqual(["art-due"]);
  });

  it("is fail-open against a client without the tables", async () => {
    expect(await requeueDueResearchHolds({} as unknown as PrismaClient)).toBe(0);
  });
});
