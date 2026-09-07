/**
 * Publish orchestrator gate fixes (audit findings P1 / P6 / P8 / P10).
 *
 *   - P6: the publish-safety pattern blockers actually run; a placeholder
 *     prayer is blocked outright, a repairable pattern files a repair
 *   - P1: the proof gate receives REAL evidence built from the package
 *     (citations, authority, verifier agreements), and a proof "review" is
 *     advisory when the cross-source verifier has signed off
 *   - P8: a checklist item already published under a different slug is a
 *     logged duplicate (or a protected rename with allowUpdate), never a
 *     unique-index crash on every pass
 *   - P10: explainPublishStatus reports THIS item's last decision
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/repair", () => ({
  flagCacheRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
  flagSitemapRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
  flagSearchRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
}));

vi.mock("@/lib/admin-worker/content-goals", () => ({
  refreshContentGoals: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/public-routes", () => ({
  publicRouteFor: vi.fn((_t: string, slug: string) => ({
    tab: "prayers",
    tabPath: "/prayers",
    slugPath: `/prayers/${slug}`,
    cacheTags: [],
  })),
}));

vi.mock("@/lib/admin-worker/repair-plans", () => ({
  filePlan: vi.fn(async () => ({ id: "plan-1" })),
}));

const brain = { enabled: false };
vi.mock("@/lib/admin-worker/intelligence", () => ({
  isBrainEnabled: () => brain.enabled,
  specialistReviews: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-worker/intelligence/service", () => ({
  screenCommunionRisk: vi.fn(async () => ({ available: false, risk: 0, block: false })),
  checkDuplicate: vi.fn(async () => ({ available: false, isDuplicate: false })),
}));
vi.mock("@/lib/admin-worker/intelligence/store", () => ({
  recordBrainCall: vi.fn(async () => undefined),
}));

const proof = {
  lastInput: null as null | Record<string, unknown>,
  decision: { allow: true, action: "publish", reasons: ["ok"] },
};
vi.mock("@/lib/admin-worker/proof-publishing", () => ({
  isProofRequired: (t: string) => t === "CHURCH_DOCUMENT",
  evaluateSensitivePublish: vi.fn(async (_p: unknown, input: Record<string, unknown>) => {
    proof.lastInput = input;
    return { proofRequired: true, humanReviewRequired: !proof.decision.allow, ...proof.decision };
  }),
}));

vi.mock("@/lib/admin-worker/content-protection", () => ({
  applyProtectedContentUpdate: vi.fn(async () => ({
    applied: true,
    kind: "enrich",
    reason: "applied enrich",
    versionId: "ver-1",
    assessment: {},
  })),
}));

import { writeAdminWorkerLog } from "@/lib/admin-worker/logs";
import { applyProtectedContentUpdate } from "@/lib/admin-worker/content-protection";
import { filePlan } from "@/lib/admin-worker/repair-plans";
import {
  buildInvariantState,
  buildProofEvidence,
  collectCitations,
  explainPublishStatus,
  runPublishOrchestrator,
} from "@/lib/admin-worker/publish-orchestrator";

type Prisma = Parameters<typeof runPublishOrchestrator>[0];

function makePrisma(
  opts: {
    existing?: { id: string; isPublished: boolean } | null;
    byItem?: { id: string; slug: string; isPublished: boolean; contentType: string } | null;
  } = {},
) {
  const update = vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
    id: args.where.id,
    isPublished: true,
  }));
  const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
    id: "new-1",
    ...args.data,
  }));
  return {
    update,
    create,
    publishedContent: {
      findFirst: vi.fn(async () => opts.existing ?? null),
      findUnique: vi.fn(async () => opts.byItem ?? null),
      findMany: vi.fn(async () => []),
      update,
      create,
    },
    adminWorkerLog: { findFirst: vi.fn(async () => null) },
    adminWorkerMemory: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    contentQualityScore: {
      create: vi.fn(async (args: { data: { finalScore: number } }) => ({
        id: "q-1",
        finalScore: args.data.finalScore,
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
  } as unknown as Prisma & { update: typeof update; create: typeof create };
}

const PRAYER = {
  contentType: "PRAYER",
  contentId: "ci-1",
  title: "Our Father",
  slug: "our-father",
  payload: {
    prayerText: "Our Father, who art in heaven, hallowed be Thy name. Amen.",
    citations: ["https://www.vatican.va/a", "https://www.usccb.org/b"],
  },
  authorityLevel: "VATICAN",
  finalScore: 0.92,
  qaPassed: true,
  hasSourceEvidence: true,
  isDoctrinallySensitive: false,
  confidence: 0.92,
};

beforeEach(() => {
  brain.enabled = false;
  proof.lastInput = null;
  proof.decision = { allow: true, action: "publish", reasons: ["ok"] };
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("P6 — publish-safety blockers run in the orchestrator", () => {
  it("blocks a placeholder prayer outright (hard reason)", async () => {
    const prisma = makePrisma();
    const result = await runPublishOrchestrator(prisma, {
      ...PRAYER,
      payload: { ...PRAYER.payload, prayerText: "Prayer text" },
      strictQAArtifactId: "art-1",
    });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") {
      expect(result.blockedBy).toBe("safety");
      expect(result.reason).toContain("incomplete_prayer");
    }
    expect(prisma.create).not.toHaveBeenCalled();
    expect(vi.mocked(filePlan)).not.toHaveBeenCalled();
  });

  it("blocks a donation-page source (hard reason) even for curated-style input", async () => {
    const prisma = makePrisma();
    const result = await runPublishOrchestrator(prisma, {
      ...PRAYER,
      payload: { ...PRAYER.payload, sourceUrl: "https://parish.example/donate" },
    });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") expect(result.reason).toContain("donation_page");
  });

  it("routes a repairable pattern (article about a prayer) to repair when an artifact exists, else blocks", async () => {
    const prisma = makePrisma();
    const repair = await runPublishOrchestrator(prisma, {
      ...PRAYER,
      title: "How to pray the Rosary",
      slug: "how-to-pray-the-rosary",
      strictQAArtifactId: "art-2",
    });
    expect(repair.kind).toBe("repair");
    expect(vi.mocked(filePlan)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: "EXTRACT_FAILED", failedEntity: "art-2" }),
    );

    const blocked = await runPublishOrchestrator(makePrisma(), {
      ...PRAYER,
      title: "How to pray the Rosary",
      slug: "how-to-pray-the-rosary",
    });
    expect(blocked.kind).toBe("blocked");
  });

  it("lets a complete, cited prayer through", async () => {
    const prisma = makePrisma();
    const result = await runPublishOrchestrator(prisma, PRAYER);
    expect(result.kind).toBe("published");
  });
});

describe("P1 — proof gate receives real evidence", () => {
  const DOC = {
    ...PRAYER,
    contentType: "CHURCH_DOCUMENT",
    title: "Lumen Gentium",
    slug: "lumen-gentium",
    payload: {
      body: "Dogmatic Constitution on the Church, promulgated by Pope Paul VI in 1964.",
      documentType: "constitution",
      citations: ["https://www.vatican.va/lg", "https://www.usccb.org/lg"],
      sourceUrl: "https://www.vatican.va/lg",
    },
    isDoctrinallySensitive: true,
    // Doctrinal content faces the higher publishDoctrinal threshold at the
    // publisher gate; keep the fixture above it so only the proof gate varies.
    finalScore: 0.97,
    confidence: 0.97,
    verifier: {
      publishAllowed: true,
      missingRequired: [],
      blockingSensitiveFields: [],
      verificationRowIds: ["v1", "v2"],
      evidence: [],
      hasConflict: false,
      summary: "two sources agree",
    },
  };

  it("collects citations from arrays, objects and sourceUrl", () => {
    expect(
      collectCitations({
        citations: ["https://a", { url: "https://b" }],
        sources: [{ href: "https://c" }],
        sourceUrl: "https://a",
      }),
    ).toEqual(["https://a", "https://b", "https://c"]);
    expect(collectCitations(null)).toEqual([]);
  });

  it("builds evidence + invariant state that satisfy the brain's proof conditions", () => {
    const citations = collectCitations(DOC.payload);
    const ev = buildProofEvidence(DOC, citations);
    expect(ev.sources).toHaveLength(2);
    expect(ev.authorities).toEqual(["VATICAN"]);
    expect(ev.citations).toHaveLength(2);
    expect(ev.agreements).toBe(2);
    expect(ev.conflicts).toEqual([]);
    const state = buildInvariantState(DOC, citations, "https://www.vatican.va/lg", DOC.payload);
    expect(state.trustedSourceCount).toBe(2);
    expect(state.title).toBe("Lumen Gentium");
    expect(state.authority).toBe("VATICAN");
    expect(state.documentType).toBe("constitution");
    expect(state.route).toBe("/prayers/lumen-gentium");
    expect(state.citation).toBe("https://www.vatican.va/lg");
    // A verifier conflict is surfaced as the unresolved contradiction.
    const conflicted = buildProofEvidence(
      { ...DOC, verifier: { ...DOC.verifier, hasConflict: true, publishAllowed: false } },
      citations,
    );
    expect(conflicted.conflicts).toHaveLength(1);
    expect(conflicted.agreements).toBe(2);
    // No verifier at all → no agreements claimed.
    expect(buildProofEvidence({ authorityLevel: "VATICAN" }, citations).agreements).toBe(0);
  });

  it("hands the evidence and the title (not the slug) to evaluateSensitivePublish", async () => {
    brain.enabled = true;
    const result = await runPublishOrchestrator(makePrisma(), DOC);
    expect(result.kind).toBe("published");
    expect(proof.lastInput).not.toBeNull();
    const input = proof.lastInput as {
      claim: { text: string };
      evidence: { sources: string[]; agreements: number };
      state: { trustedSourceCount: number };
    };
    expect(input.claim.text).toBe("Lumen Gentium");
    expect(input.evidence.sources).toHaveLength(2);
    expect(input.evidence.agreements).toBe(2);
    expect(input.state.trustedSourceCount).toBe(2);
  });

  it("treats a proof 'review' as advisory when the verifier signed off, and as review otherwise", async () => {
    brain.enabled = true;
    proof.decision = { allow: false, action: "review", reasons: ["below Vatican authority"] };
    const advisory = await runPublishOrchestrator(makePrisma(), DOC);
    expect(advisory.kind).toBe("published");
    expect(vi.mocked(writeAdminWorkerLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventName: "proof_review_advisory" }),
    );

    const parked = await runPublishOrchestrator(makePrisma(), {
      ...DOC,
      isDoctrinallySensitive: false,
      verifier: undefined,
    });
    expect(parked.kind).toBe("review");
    if (parked.kind === "review") expect(parked.reason).toMatch(/^proof-based publishing/);

    proof.decision = { allow: false, action: "block", reasons: ["conflict"] };
    const blocked = await runPublishOrchestrator(makePrisma(), DOC);
    expect(blocked.kind).toBe("blocked");
  });
});

describe("P8 — checklist item already published under another slug", () => {
  it("returns a logged duplicate instead of crashing on the unique index", async () => {
    const prisma = makePrisma({
      byItem: {
        id: "pub-9",
        slug: "saint-therese-of-the-child-jesus",
        isPublished: true,
        contentType: "PRAYER",
      },
    });
    const result = await runPublishOrchestrator(prisma, {
      ...PRAYER,
      slug: "saint-therese-of-lisieux",
    });
    expect(result.kind).toBe("duplicate");
    if (result.kind === "duplicate") {
      expect(result.existingId).toBe("pub-9");
      expect(result.reason).toContain("slug mismatch");
    }
    expect(prisma.create).not.toHaveBeenCalled();
    expect(vi.mocked(writeAdminWorkerLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventName: "publish_slug_mismatch" }),
    );
  });

  it("renames through the protection gate when the caller passes allowUpdate", async () => {
    const prisma = makePrisma({
      byItem: { id: "pub-9", slug: "old-slug", isPublished: true, contentType: "PRAYER" },
    });
    const result = await runPublishOrchestrator(prisma, { ...PRAYER, allowUpdate: true });
    expect(result.kind).toBe("published");
    if (result.kind === "published") {
      expect(result.publishedContentId).toBe("pub-9");
      expect(result.reason).toContain("renamed existing row from old-slug");
    }
    expect(vi.mocked(applyProtectedContentUpdate)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        contentId: "pub-9",
        allowReplace: true,
        proposedTitle: "Our Father",
      }),
    );
    expect(prisma.update).toHaveBeenCalledWith({
      where: { id: "pub-9" },
      data: { slug: "our-father" },
    });
    expect(prisma.create).not.toHaveBeenCalled();
  });

  it("refuses the rename when the protection gate blocks it", async () => {
    vi.mocked(applyProtectedContentUpdate).mockResolvedValueOnce({
      applied: false,
      kind: "replace",
      blocked: true,
      reason: "destructive change not backed",
      assessment: {} as never,
    });
    const prisma = makePrisma({
      byItem: { id: "pub-9", slug: "old-slug", isPublished: true, contentType: "PRAYER" },
    });
    const result = await runPublishOrchestrator(prisma, { ...PRAYER, allowUpdate: true });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") expect(result.blockedBy).toBe("protection");
    expect(prisma.update).not.toHaveBeenCalled();
  });

  it("republishes an UNPUBLISHED row under the requested slug (no live URL affected)", async () => {
    const prisma = makePrisma({
      byItem: { id: "pub-9", slug: "old-slug", isPublished: false, contentType: "PRAYER" },
    });
    const result = await runPublishOrchestrator(prisma, PRAYER);
    expect(result.kind).toBe("published");
    if (result.kind === "published") expect(result.publishedContentId).toBe("pub-9");
    const call = prisma.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "pub-9" });
    expect(call.data.slug).toBe("our-father");
    expect(call.data.isPublished).toBe(true);
    expect(prisma.create).not.toHaveBeenCalled();
  });

  it("still creates a fresh row when the item has no published row at all", async () => {
    const prisma = makePrisma();
    const result = await runPublishOrchestrator(prisma, PRAYER);
    expect(result.kind).toBe("published");
    expect(prisma.create).toHaveBeenCalledTimes(1);
  });
});

describe("P10 — explainPublishStatus is scoped to the item", () => {
  it("filters the PUBLISHING log by `<TYPE>/<slug>`", async () => {
    const findFirst = vi.fn(async () => ({
      message: "Published PRAYER/hail-mary → /prayers/hail-mary",
    }));
    const prisma = {
      publishedContent: {
        findFirst: vi.fn(async () => ({ isPublished: true, publishedAt: new Date() })),
      },
      adminWorkerLog: { findFirst },
    } as unknown as Prisma;
    const out = await explainPublishStatus(prisma, { contentType: "PRAYER", slug: "hail-mary" });
    expect(out.lastDecision).toContain("hail-mary");
    const where = (findFirst.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0]
      .where;
    expect(where.message).toEqual({ contains: "PRAYER/hail-mary" });
  });
});
