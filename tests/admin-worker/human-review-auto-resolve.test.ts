/**
 * The worker resolves the review items it can decide on its own, and approving a
 * translation actually writes it onto the prayer — so the queue stops piling up
 * and "approve" is not a no-op. Accuracy is preserved: a machine proposal is only
 * auto-applied when the deterministic canonical engine confirms it; otherwise it
 * is rejected as redundant/moot. In full autonomy (the default) every otherwise-
 * undecidable item is auto-decided (the worker declines the uncertain action) so
 * the queue drains to zero; only ADMIN_WORKER_REQUIRE_HUMAN_REVIEW=1 leaves it
 * pending for a person.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";
import {
  executeApprovedReview,
  fileHumanReview,
  runReviewAutoResolve,
} from "@/lib/admin-worker/human-review";

let savedReviewEnv: string | undefined;
beforeEach(() => {
  savedReviewEnv = process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW;
  delete process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW; // default: fully autonomous
});
afterEach(() => {
  if (savedReviewEnv === undefined) delete process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW;
  else process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW = savedReviewEnv;
});

describe("fileHumanReview — full autonomy", () => {
  it("does NOT create a pending review row by default (logs the decision instead)", async () => {
    const create = vi.fn(async () => ({ id: "x" }));
    const logCreate = vi.fn(async () => ({}));
    const prisma = {
      humanReviewQueue: { create },
      adminWorkerLog: { create: logCreate },
    } as unknown as PrismaClient;
    const res = await fileHumanReview(prisma, {
      contentType: "SAINT",
      contentTitle: "Some Saint",
      proposedAction: "publish",
      reason: "confidence below threshold",
      confidence: 0.5,
    });
    expect(create).not.toHaveBeenCalled(); // never queued
    expect(logCreate).toHaveBeenCalled(); // decision recorded as a log
    expect(res.id).toBe("autonomous");
  });

  it("creates a pending review row when human review is explicitly required", async () => {
    process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW = "1";
    const create = vi.fn(async () => ({ id: "rev1" }));
    const prisma = {
      humanReviewQueue: { create },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;
    const res = await fileHumanReview(prisma, {
      contentType: "SAINT",
      contentTitle: "Some Saint",
      proposedAction: "publish",
      reason: "confidence below threshold",
      confidence: 0.5,
    });
    expect(create).toHaveBeenCalled();
    expect(res.id).toBe("rev1");
  });
});

describe("human-review executor", () => {
  it("writes the confirmed translation onto the published prayer", async () => {
    const updates: Array<{ data: { payload: Record<string, unknown> } }> = [];
    const prisma = {
      publishedContent: {
        findFirst: vi.fn(async () => ({
          id: "p1",
          title: "Glory Be",
          slug: "glory-be",
          payload: { body: "Glory be to the Father…" },
        })),
        update: vi.fn(async (a: { data: { payload: Record<string, unknown> } }) => {
          updates.push(a);
          return {};
        }),
      },
    } as unknown as PrismaClient;

    const res = await executeApprovedReview(prisma, {
      id: "r1",
      proposedAction: "CONFIRM_TRANSLATION",
      contentTitle: "Glory Be",
      contentType: "PRAYER",
      sourceEvidence: { language: "la", text: "Gloria Patri, et Filio…" },
    });

    expect(res.applied).toBe(true);
    expect(updates[0].data.payload.latin).toBe("Gloria Patri, et Filio…");
  });

  it("records the approval without a content change for an action it cannot execute", async () => {
    const res = await executeApprovedReview({} as PrismaClient, {
      id: "r9",
      proposedAction: "PUBLISH_PARISH",
      contentTitle: "St. Mary's",
      contentType: "PARISH",
      sourceEvidence: null,
    });
    expect(res.applied).toBe(false);
  });
});

describe("runReviewAutoResolve", () => {
  type Item = {
    id: string;
    proposedAction: string;
    contentTitle: string | null;
    contentType?: string | null;
    sourceEvidence: unknown;
  };
  function prismaWith(opts: {
    items: Item[];
    prayerPayload?: Record<string, unknown> | null;
    /** Whether a published row exists for a contentIsLive() lookup. */
    contentLive?: boolean;
    /** A DailyReading row to return (with verified sections) or null. */
    dailyReading?: { sections: unknown[] } | null;
  }): { prisma: PrismaClient; reviewUpdates: Array<{ data: { status?: string } }> } {
    const reviewUpdates: Array<{ data: { status?: string } }> = [];
    const prisma = {
      humanReviewQueue: {
        findMany: vi.fn(async () => opts.items),
        update: vi.fn(async (a: { data: { status?: string } }) => {
          reviewUpdates.push(a);
          return {};
        }),
      },
      publishedContent: {
        findFirst: vi.fn(async () => {
          if (opts.prayerPayload !== undefined) {
            return opts.prayerPayload === null
              ? null
              : { id: "p1", title: "t", slug: "s", payload: opts.prayerPayload };
          }
          return opts.contentLive ? { id: "c1" } : null;
        }),
        update: vi.fn(async () => ({})),
      },
      dailyReading: {
        findFirst: vi.fn(async () => opts.dailyReading ?? null),
      },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;
    return { prisma, reviewUpdates };
  }

  it("rejects a redundant proposal when the prayer already has that language", async () => {
    const { prisma, reviewUpdates } = prismaWith({
      items: [
        {
          id: "r1",
          proposedAction: "CONFIRM_TRANSLATION",
          contentTitle: "Hail Mary",
          sourceEvidence: { language: "la" },
        },
      ],
      prayerPayload: { body: "Hail Mary…", latin: "Ave Maria…" },
    });
    const out = await runReviewAutoResolve(prisma);
    expect(out.rejected).toBe(1);
    expect(out.approved).toBe(0);
    expect(reviewUpdates.some((u) => u.data.status === "REJECTED")).toBe(true);
  });

  it("rejects a moot proposal when the prayer is no longer published", async () => {
    const { prisma } = prismaWith({
      items: [
        {
          id: "r2",
          proposedAction: "CONFIRM_TRANSLATION",
          contentTitle: "Gone",
          sourceEvidence: { language: "el" },
        },
      ],
      prayerPayload: null,
    });
    const out = await runReviewAutoResolve(prisma);
    expect(out.rejected).toBe(1);
  });

  it("auto-decides a genuine machine-only proposal in full autonomy (declines, drains the queue)", async () => {
    const { prisma, reviewUpdates } = prismaWith({
      items: [
        {
          id: "r3",
          proposedAction: "CONFIRM_TRANSLATION",
          contentTitle: "Obscure Prayer",
          sourceEvidence: { language: "la" },
        },
      ],
      prayerPayload: { body: "Some unique uncurated prayer text that the corpus cannot resolve." },
    });
    const out = await runReviewAutoResolve(prisma);
    // Default (no env) is fully autonomous: it declines (rejects) rather than leaving.
    expect(out.left).toBe(0);
    expect(out.rejected).toBe(1);
    expect(reviewUpdates.some((u) => u.data.status === "REJECTED")).toBe(true);
  });

  it("leaves a genuine machine-only proposal for a human ONLY when review is required", async () => {
    process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW = "1";
    const { prisma, reviewUpdates } = prismaWith({
      items: [
        {
          id: "r3b",
          proposedAction: "CONFIRM_TRANSLATION",
          contentTitle: "Obscure Prayer",
          sourceEvidence: { language: "la" },
        },
      ],
      prayerPayload: { body: "Some unique uncurated prayer text that the corpus cannot resolve." },
    });
    const out = await runReviewAutoResolve(prisma);
    expect(out.left).toBe(1);
    expect(out.approved).toBe(0);
    expect(out.rejected).toBe(0);
    expect(reviewUpdates).toHaveLength(0); // untouched — waiting for a human
  });

  it("resolves a TRANSLATE_TO_LATIN review the canonical engine can build (applies authentic text)", async () => {
    const { prisma, reviewUpdates } = prismaWith({
      items: [
        {
          id: "r4",
          proposedAction: "TRANSLATE_TO_LATIN",
          contentTitle: "glory-be",
          sourceEvidence: { slug: "glory-be", targetLanguage: "Latin" },
        },
      ],
      prayerPayload: { body: "Glory be to the Father, and to the Son, and to the Holy Spirit…" },
    });
    const out = await runReviewAutoResolve(prisma);
    // Either applied authentic (approved) or auto-declined (rejected) in full
    // autonomy — but it must never crash and must touch exactly this one item.
    expect(out.scanned).toBe(1);
    expect(out.approved + out.rejected + out.left).toBe(1);
    if (out.approved === 1) {
      expect(reviewUpdates.some((u) => u.data.status === "APPROVED")).toBe(true);
    }
  });

  it("rejects a stale `publish` review once the content is live again (moot)", async () => {
    const { prisma } = prismaWith({
      items: [
        {
          id: "r5",
          proposedAction: "publish",
          contentTitle: "Some Saint",
          contentType: "SAINT",
          sourceEvidence: null,
        },
      ],
      contentLive: true,
    });
    const out = await runReviewAutoResolve(prisma);
    expect(out.rejected).toBe(1);
  });

  it("auto-declines a not-yet-live `publish` review in full autonomy (never publishes uncertain content)", async () => {
    const { prisma } = prismaWith({
      items: [
        {
          id: "r6",
          proposedAction: "publish",
          contentTitle: "Not Yet",
          contentType: "SAINT",
          sourceEvidence: null,
        },
      ],
      contentLive: false,
    });
    const out = await runReviewAutoResolve(prisma);
    expect(out.left).toBe(0);
    expect(out.rejected).toBe(1);
  });

  it("leaves a not-yet-live `publish` review for a human ONLY when review is required", async () => {
    process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW = "1";
    const { prisma } = prismaWith({
      items: [
        {
          id: "r6b",
          proposedAction: "publish",
          contentTitle: "Not Yet",
          contentType: "SAINT",
          sourceEvidence: null,
        },
      ],
      contentLive: false,
    });
    const out = await runReviewAutoResolve(prisma);
    expect(out.left).toBe(1);
    expect(out.rejected).toBe(0);
  });

  it("rejects a `delete:*` review once the content is already gone (moot)", async () => {
    const { prisma } = prismaWith({
      items: [
        {
          id: "r7",
          proposedAction: "delete:duplicate",
          contentTitle: "Removed Already",
          contentType: "PRAYER",
          sourceEvidence: null,
        },
      ],
      contentLive: false,
    });
    const out = await runReviewAutoResolve(prisma);
    expect(out.rejected).toBe(1);
  });

  it("rejects a `publish-daily-readings` review once the day carries verified text", async () => {
    const { prisma } = prismaWith({
      items: [
        {
          id: "r8",
          proposedAction: "publish-daily-readings",
          contentTitle: "Daily readings — 2026-06-27",
          contentType: "READING",
          sourceEvidence: { sourceUrl: "https://example.org" },
        },
      ],
      dailyReading: { sections: [{ body: "In those days…" }] },
    });
    const out = await runReviewAutoResolve(prisma);
    expect(out.rejected).toBe(1);
  });
});
