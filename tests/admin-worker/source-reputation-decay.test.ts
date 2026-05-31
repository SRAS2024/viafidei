/**
 * Source reputation decay (spec §19-22). Sources that have not produced
 * valid content recently should become less trusted until proven again.
 * Proves the decay is time-based, demotes a quiet TRUSTED source, and
 * makes a long-quiet paused source retestable.
 */

import { describe, expect, it, vi } from "vitest";

import {
  decayedReputationRates,
  decaySourceReputation,
  REPUTATION_POSITIVE_HALF_LIFE_DAYS,
} from "@/lib/admin-worker/source-reputation";

const DAY = 24 * 60 * 60 * 1000;

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    publicPublishRate: 0.9,
    qaPassRate: 0.85,
    contentBuildSuccessRate: 0.9,
    validationEvidenceSuccessRate: 0.8,
    fetchSuccessRate: 0.95,
    averageUsefulness: 0.7,
    wrongContentRate: 0,
    duplicateRate: 0,
    reputationTier: "TRUSTED",
    paused: false,
    lastScoreUpdate: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("decayedReputationRates", () => {
  it("halves positive signals after one positive half-life", () => {
    const r = row();
    const now = new Date(r.lastScoreUpdate.getTime() + REPUTATION_POSITIVE_HALF_LIFE_DAYS * DAY);
    const d = decayedReputationRates(r, now);
    expect(d.publicPublishRate).toBeCloseTo(0.45, 5);
    expect(d.qaPassRate).toBeCloseTo(0.425, 5);
    expect(d.ageDays).toBeCloseTo(REPUTATION_POSITIVE_HALF_LIFE_DAYS, 5);
  });

  it("does not decay when no time has passed", () => {
    const r = row();
    const d = decayedReputationRates(r, r.lastScoreUpdate);
    expect(d.publicPublishRate).toBeCloseTo(0.9, 5);
  });
});

describe("decaySourceReputation (spec §19-20)", () => {
  it("demotes a TRUSTED source that has gone quiet", async () => {
    const updates: Array<Record<string, unknown>> = [];
    // 90 days quiet ≈ 4 positive half-lives → publish rate 0.9 → ~0.056,
    // well below the TRUSTED threshold, so the tier must drop.
    const quiet = row({
      lastScoreUpdate: new Date(Date.now() - 90 * DAY),
    });
    const prisma = {
      adminWorkerSourceReputation: {
        findMany: vi.fn(async () => [quiet]),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => {
          updates.push(args.data);
          return { id: "r1" };
        }),
      },
    } as unknown as Parameters<typeof decaySourceReputation>[0];

    const result = await decaySourceReputation(prisma);
    expect(result.decayed).toBe(1);
    expect(result.demoted).toBe(1);
    expect(updates[0].reputationTier).not.toBe("TRUSTED");
    // The decay must NOT bump lastScoreUpdate — it stays anchored to the
    // last real outcome so the source keeps decaying until re-proven.
    expect(updates[0].lastScoreUpdate).toBeUndefined();
  });

  it("skips rows updated within the minimum age window", async () => {
    const fresh = row({ lastScoreUpdate: new Date(Date.now() - 1 * DAY) });
    const update = vi.fn();
    const prisma = {
      adminWorkerSourceReputation: {
        findMany: vi.fn(async () => [fresh]),
        update,
      },
    } as unknown as Parameters<typeof decaySourceReputation>[0];
    const result = await decaySourceReputation(prisma, { minAgeDays: 7 });
    expect(result.decayed).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("makes a long-quiet paused source retestable once negatives decay", async () => {
    const updates: Array<Record<string, unknown>> = [];
    // Paused due to wrong content long ago; after ~6 negative half-lives
    // the wrong-content signal is negligible so the source un-pauses.
    const pausedRow = row({
      publicPublishRate: 0,
      qaPassRate: 0,
      contentBuildSuccessRate: 0,
      wrongContentRate: 0.8,
      reputationTier: "PAUSED",
      paused: true,
      lastScoreUpdate: new Date(Date.now() - 300 * DAY),
    });
    const prisma = {
      adminWorkerSourceReputation: {
        findMany: vi.fn(async () => [pausedRow]),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => {
          updates.push(args.data);
          return { id: "r1" };
        }),
      },
    } as unknown as Parameters<typeof decaySourceReputation>[0];

    const result = await decaySourceReputation(prisma);
    expect(result.retestable).toBe(1);
    expect(updates[0].paused).toBe(false);
  });
});
