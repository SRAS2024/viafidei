/**
 * Content-growth escalation (spec §25). Proves the 24h/7d escalation
 * logic emits the right repair instruction for a stale content type.
 */

import { describe, expect, it, vi } from "vitest";

import { escalationsForOperator, reportGrowth } from "@/lib/admin-worker/content-growth";

function makePrisma(opts: {
  goals: Array<{
    contentType: string;
    gapCount: number;
    currentValidCount?: number;
    desiredTarget?: number;
  }>;
  lastPublished: Record<string, Date | null>;
}) {
  return {
    contentGoal: {
      findMany: vi.fn(async () =>
        opts.goals.map((g) => ({
          contentType: g.contentType,
          gapCount: g.gapCount,
          currentValidCount: g.currentValidCount ?? 0,
          desiredTarget: g.desiredTarget ?? g.gapCount,
          priority: 10,
        })),
      ),
    },
    publishedContent: {
      findFirst: vi.fn(async (args: { where: { contentType: string } }) => {
        const last = opts.lastPublished[args.where.contentType];
        return last ? { publishedAt: last } : null;
      }),
    },
  } as unknown as Parameters<typeof reportGrowth>[0];
}

describe("reportGrowth", () => {
  it("emits NONE when content was published recently", async () => {
    const prisma = makePrisma({
      goals: [{ contentType: "PRAYER", gapCount: 5 }],
      lastPublished: { PRAYER: new Date(Date.now() - 60 * 60 * 1000) }, // 1h ago
    });
    const reports = await reportGrowth(prisma);
    expect(reports[0].escalation).toBe("NONE");
  });

  it("escalates EXPAND_SOURCES when last publish was >24h ago", async () => {
    const prisma = makePrisma({
      goals: [{ contentType: "PRAYER", gapCount: 5 }],
      lastPublished: { PRAYER: new Date(Date.now() - 26 * 60 * 60 * 1000) },
    });
    const reports = await reportGrowth(prisma);
    expect(reports[0].escalation).toBe("EXPAND_SOURCES");
    expect(reports[0].reason).toMatch(/24h/);
  });

  it("escalates ESCALATE_DIAGNOSTICS when last publish was >7 days ago", async () => {
    const prisma = makePrisma({
      goals: [{ contentType: "SAINT", gapCount: 10 }],
      lastPublished: { SAINT: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    });
    const reports = await reportGrowth(prisma);
    expect(reports[0].escalation).toBe("ESCALATE_DIAGNOSTICS");
  });

  it("escalates ESCALATE_DIAGNOSTICS when content type was never published", async () => {
    const prisma = makePrisma({
      goals: [{ contentType: "APPARITION", gapCount: 3 }],
      lastPublished: {},
    });
    const reports = await reportGrowth(prisma);
    expect(reports[0].escalation).toBe("ESCALATE_DIAGNOSTICS");
  });
});

describe("escalationsForOperator", () => {
  it("filters out NONE entries", async () => {
    const prisma = makePrisma({
      goals: [
        { contentType: "PRAYER", gapCount: 1 },
        { contentType: "SAINT", gapCount: 1 },
      ],
      lastPublished: {
        PRAYER: new Date(Date.now() - 60 * 60 * 1000),
        SAINT: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
    });
    const reports = await reportGrowth(prisma);
    const filtered = escalationsForOperator(reports);
    expect(filtered.map((r) => r.contentType)).toEqual(["SAINT"]);
  });
});
