/**
 * Phase 10 memory hooks (spec §15). Proves rankHostsByMemory orders by
 * confidence + recordExtractorOutcome writes the right memory row.
 */

import { describe, expect, it, vi } from "vitest";

import {
  rankHostsByMemory,
  recordExtractorOutcome,
  rememberFailurePattern,
} from "@/lib/admin-worker/memory";

function makePrisma(
  opts: {
    memoryRows?: Array<{
      memoryKey: string;
      confidence: number;
      successCount: number;
      failureCount: number;
    }>;
  } = {},
) {
  return {
    adminWorkerMemory: {
      findMany: vi.fn(async () => opts.memoryRows ?? []),
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
    },
  } as unknown as Parameters<typeof rankHostsByMemory>[0];
}

describe("rankHostsByMemory", () => {
  it("returns hosts ranked by descending confidence", async () => {
    const prisma = makePrisma({
      memoryRows: [
        { memoryKey: "good.example", confidence: 0.95, successCount: 19, failureCount: 1 },
        { memoryKey: "bad.example", confidence: 0.1, successCount: 1, failureCount: 9 },
      ],
    });
    const ranked = await rankHostsByMemory(prisma, ["bad.example", "good.example"]);
    expect(ranked[0].host).toBe("good.example");
    expect(ranked[1].host).toBe("bad.example");
  });

  it("returns 0.5 confidence for unseen hosts (Laplace-smoothed default)", async () => {
    const prisma = makePrisma({});
    const ranked = await rankHostsByMemory(prisma, ["unseen.example"]);
    expect(ranked[0].confidence).toBeCloseTo(0.5, 5);
  });

  it("returns empty array for empty input", async () => {
    const prisma = makePrisma();
    expect(await rankHostsByMemory(prisma, [])).toEqual([]);
  });
});

describe("recordExtractorOutcome", () => {
  it("writes a BUILDER_PRIORITY memory row keyed on host|contentType", async () => {
    const prisma = makePrisma();
    await recordExtractorOutcome(prisma, {
      host: "trusted.example",
      contentType: "PRAYER",
      fatal: false,
      confidenceScore: 0.85,
      missingFields: [],
    });
    const upsert = (
      prisma as unknown as { adminWorkerMemory: { upsert: ReturnType<typeof vi.fn> } }
    ).adminWorkerMemory.upsert;
    expect(upsert).toHaveBeenCalled();
    const args = upsert.mock.calls[0]?.[0] as {
      where: { memoryType_memoryKey: { memoryType: string; memoryKey: string } };
    };
    expect(args.where.memoryType_memoryKey.memoryType).toBe("BUILDER_PRIORITY");
    expect(args.where.memoryType_memoryKey.memoryKey).toBe("trusted.example|PRAYER");
  });

  it("records 'failure' when the extractor fataled", async () => {
    const prisma = makePrisma();
    await recordExtractorOutcome(prisma, {
      host: "bad.example",
      contentType: "SAINT",
      fatal: true,
      confidenceScore: 0,
      missingFields: ["saintName", "feastDay"],
    });
    const upsert = (
      prisma as unknown as { adminWorkerMemory: { upsert: ReturnType<typeof vi.fn> } }
    ).adminWorkerMemory.upsert;
    const args = upsert.mock.calls[0]?.[0] as { create: { failureCount: number } };
    expect(args.create.failureCount).toBe(1);
  });
});

describe("rememberFailurePattern", () => {
  it("writes a FAILURE_PATTERN memory row", async () => {
    const prisma = makePrisma();
    await rememberFailurePattern(prisma, {
      patternKey: "publish_post_publish_timeout",
      details: { route: "/prayers/our-father", timeout: 30 },
    });
    const upsert = (
      prisma as unknown as { adminWorkerMemory: { upsert: ReturnType<typeof vi.fn> } }
    ).adminWorkerMemory.upsert;
    const args = upsert.mock.calls[0]?.[0] as {
      where: { memoryType_memoryKey: { memoryType: string } };
    };
    expect(args.where.memoryType_memoryKey.memoryType).toBe("FAILURE_PATTERN");
  });
});
