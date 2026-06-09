/**
 * Intelligence Laboratory persistence + read layer — proves the dashboard data
 * loads correctly from the Lab* tables and that writers persist rows. Pure unit
 * tests over a mocked Prisma; guarded so empty/erroring tables never throw.
 */

import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";

import {
  collectIntelligenceLabData,
  persistProofPacket,
  persistArchitectureReport,
} from "@/lib/admin-worker/intelligence-lab-store";

function readerPrisma(over: Record<string, unknown> = {}) {
  const list = () => ({ findMany: vi.fn(async () => []), count: vi.fn(async () => 0) });
  const base: Record<string, unknown> = {
    labProofPacket: {
      findMany: vi.fn(async () => [
        {
          id: "p1",
          contentType: "CHURCH_DOCUMENT",
          recommendedAction: "review",
          proven: false,
          riskLevel: "high",
          createdAt: new Date(),
        },
      ]),
      count: vi.fn(async () => 3),
    },
    labHypothesis: list(),
    labArchitectureIntegrityReport: {
      findMany: vi.fn(async () => [
        { id: "a1", integrity: 0.94, clean: false, createdAt: new Date() },
      ]),
    },
    labBenchmarkRun: list(),
    labBrainVersionScore: list(),
    labStrategyTournament: list(),
    labCapabilityProposal: list(),
    labAdversarialCase: list(),
    labCurriculumRun: list(),
    labDigitalTwinRun: list(),
    labCounterfactualRun: list(),
    labExperimentPlan: list(),
    labRuleEvaluation: list(),
    labCatholicOntologyNode: { count: vi.fn(async () => 2) },
    labClaimRecord: {
      groupBy: vi.fn(async () => [
        { epistemicStatus: "CERTAIN", _count: { _all: 5 } },
        { epistemicStatus: "BLOCKED", _count: { _all: 1 } },
      ]),
    },
    adminWorkerBrainCall: {
      findFirst: vi.fn(async () => ({ reasoning: "Highest-leverage change: new_parser." })),
    },
  };
  return { ...base, ...over } as unknown as PrismaClient;
}

describe("collectIntelligenceLabData", () => {
  it("loads the lab surfaces from the tables", async () => {
    const data = await collectIntelligenceLabData(readerPrisma(), { limit: 10 });
    expect(data.proofPackets[0].contentType).toBe("CHURCH_DOCUMENT");
    expect(data.failedProofCount).toBe(3);
    expect(data.latestArchitectureIntegrity).toBeCloseTo(0.94, 2);
    expect(data.claimsByStatus.CERTAIN).toBe(5);
    expect(data.ontologyGaps).toBe(2);
    expect(data.highestLeverage).toMatch(/new_parser/);
  });

  it("never throws when a table errors (guarded)", async () => {
    const prisma = readerPrisma({
      labProofPacket: {
        findMany: vi.fn(async () => {
          throw new Error("db down");
        }),
        count: vi.fn(async () => {
          throw new Error("db down");
        }),
      },
    });
    const data = await collectIntelligenceLabData(prisma);
    expect(data.proofPackets).toEqual([]);
    expect(data.failedProofCount).toBe(0);
  });
});

describe("lab writers", () => {
  it("persists a proof packet and returns its id", async () => {
    const create = vi.fn(async () => ({ id: "pp1" }));
    const prisma = { labProofPacket: { create } } as unknown as PrismaClient;
    const id = await persistProofPacket(prisma, {
      contentType: "APPARITION",
      proven: false,
      recommendedAction: "review",
    });
    expect(id).toBe("pp1");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("returns null (never throws) when a write fails", async () => {
    const prisma = {
      labArchitectureIntegrityReport: {
        create: vi.fn(async () => {
          throw new Error("db down");
        }),
      },
    } as unknown as PrismaClient;
    const id = await persistArchitectureReport(prisma, { integrity: 1, clean: true });
    expect(id).toBeNull();
  });
});
