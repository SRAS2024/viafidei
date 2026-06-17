/**
 * The worker resolves the review items it can decide on its own, and approving a
 * translation actually writes it onto the prayer — so the queue stops piling up
 * and "approve" is not a no-op. Accuracy is preserved: a machine proposal is only
 * auto-applied when the deterministic canonical engine confirms it; otherwise it
 * is rejected as redundant/moot or left for a human.
 */
import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";
import { executeApprovedReview, runReviewAutoResolve } from "@/lib/admin-worker/human-review";

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
  function prismaWith(opts: {
    items: Array<{ id: string; contentTitle: string | null; sourceEvidence: unknown }>;
    prayerPayload: Record<string, unknown> | null;
  }): { prisma: PrismaClient; reviewUpdates: Array<{ data: { status?: string } }> } {
    const reviewUpdates: Array<{ data: { status?: string } }> = [];
    const prisma = {
      humanReviewQueue: {
        findMany: vi.fn(async () => opts.items),
        findUnique: vi.fn(async (a: { where: { id: string } }) => ({
          id: a.where.id,
          proposedAction: "CONFIRM_TRANSLATION",
          contentTitle: opts.items.find((i) => i.id === a.where.id)?.contentTitle ?? null,
          contentType: "PRAYER",
          sourceEvidence: opts.items.find((i) => i.id === a.where.id)?.sourceEvidence ?? null,
        })),
        update: vi.fn(async (a: { data: { status?: string } }) => {
          reviewUpdates.push(a);
          return {};
        }),
      },
      publishedContent: {
        findFirst: vi.fn(async () =>
          opts.prayerPayload === null ? null : { payload: opts.prayerPayload },
        ),
        update: vi.fn(async () => ({})),
      },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;
    return { prisma, reviewUpdates };
  }

  it("rejects a redundant proposal when the prayer already has that language", async () => {
    const { prisma, reviewUpdates } = prismaWith({
      items: [{ id: "r1", contentTitle: "Hail Mary", sourceEvidence: { language: "la" } }],
      prayerPayload: { body: "Hail Mary…", latin: "Ave Maria…" },
    });
    const out = await runReviewAutoResolve(prisma);
    expect(out.rejected).toBe(1);
    expect(out.approved).toBe(0);
    expect(reviewUpdates.some((u) => u.data.status === "REJECTED")).toBe(true);
  });

  it("rejects a moot proposal when the prayer is no longer published", async () => {
    const { prisma } = prismaWith({
      items: [{ id: "r2", contentTitle: "Gone", sourceEvidence: { language: "el" } }],
      prayerPayload: null,
    });
    const out = await runReviewAutoResolve(prisma);
    expect(out.rejected).toBe(1);
  });

  it("leaves a genuine machine-only proposal the canonical engine cannot resolve", async () => {
    const { prisma, reviewUpdates } = prismaWith({
      items: [{ id: "r3", contentTitle: "Obscure Prayer", sourceEvidence: { language: "la" } }],
      prayerPayload: { body: "Some unique uncurated prayer text that the corpus cannot resolve." },
    });
    const out = await runReviewAutoResolve(prisma);
    expect(out.left).toBe(1);
    expect(out.approved).toBe(0);
    expect(out.rejected).toBe(0);
    expect(reviewUpdates).toHaveLength(0); // untouched — waiting for a human
  });
});
