/**
 * Source reputation update — proves "source reputation changes over
 * time" + "bad sources are paused automatically" (spec sections 19,
 * 24). Uses a mocked Prisma so reputation rates can be driven through
 * a known sequence.
 */

import type { AdminWorkerSourceReputation } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { recordSourceOutcome } from "@/lib/admin-worker/source-reputation";

function makePrisma() {
  let row: AdminWorkerSourceReputation | null = null;
  return {
    rowRef: {
      get current() {
        return row;
      },
    },
    prisma: {
      adminWorkerSourceReputation: {
        findUnique: vi.fn(async () => row),
        upsert: vi.fn(
          async ({
            create,
            update,
          }: {
            create: AdminWorkerSourceReputation;
            update: AdminWorkerSourceReputation;
          }) => {
            row = (row ? { ...row, ...update } : { ...create }) as AdminWorkerSourceReputation;
            return row;
          },
        ),
      },
    } as unknown as Parameters<typeof recordSourceOutcome>[0],
  };
}

describe("recordSourceOutcome", () => {
  it("creates a new reputation row on first outcome", async () => {
    const { prisma, rowRef } = makePrisma();
    await recordSourceOutcome(prisma, {
      sourceHost: "www.vatican.va",
      contentType: "PRAYER",
      fetchOk: true,
      buildOk: true,
      qaOk: true,
      publishedOk: true,
    });
    expect(rowRef.current).not.toBeNull();
    expect(rowRef.current?.sourceHost).toBe("www.vatican.va");
  });

  it("rates move toward 1 with sustained successes", async () => {
    const { prisma, rowRef } = makePrisma();
    for (let i = 0; i < 30; i++) {
      await recordSourceOutcome(prisma, {
        sourceHost: "www.vatican.va",
        contentType: "PRAYER",
        fetchOk: true,
        buildOk: true,
        qaOk: true,
        publishedOk: true,
      });
    }
    expect(rowRef.current?.publicPublishRate).toBeGreaterThan(0.9);
    expect(rowRef.current?.reputationTier).toBe("TRUSTED");
  });

  it("rates move toward 0 with sustained failures and auto-pauses", async () => {
    const { prisma, rowRef } = makePrisma();
    for (let i = 0; i < 30; i++) {
      await recordSourceOutcome(prisma, {
        sourceHost: "noise.example",
        contentType: "PRAYER",
        fetchOk: true,
        buildOk: false,
        qaOk: false,
        publishedOk: false,
        wrongContent: true,
      });
    }
    expect(rowRef.current?.wrongContentRate).toBeGreaterThan(0.9);
    expect(rowRef.current?.paused).toBe(true);
    expect(rowRef.current?.reputationTier).toBe("PAUSED");
  });
});
