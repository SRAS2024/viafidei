/**
 * Smoke test for the developer-audit PDF — in particular the new unified
 * "Intelligence (the unified brain)" section. Mocks the data layer so the
 * generator runs deterministically and asserts it produces a valid PDF without
 * crashing on the brain-audit queries.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/checklist", () => ({
  curatedKnowledgeByType: () => ({ PRAYER: 10, SAINT: 5 }),
  curatedKnowledgeSize: () => 15,
  totalChecklistItems: () => 200,
}));

vi.mock("@/lib/diagnostics/index", () => ({
  runAllDiagnostics: vi.fn(async () => [
    { label: "DB", status: "pass", summary: "ok", details: [], suggestedAction: null },
  ]),
}));

vi.mock("@/lib/db/client", () => {
  const zeroCount = vi.fn(async () => 0);
  return {
    prisma: {
      adminWorkerLog: {
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async ({ where }: { where: { eventName: string } }) => {
          if (where.eventName === "intelligence_pass") return { safeMetadata: { iqIndex: 137 } };
          return null;
        }),
      },
      adminWorkerSelfModelSnapshot: {
        findFirst: vi.fn(async () => ({
          fileCount: 974,
          coverageRatio: 0.65,
          weakCount: 12,
          untestedCount: 7,
          importCycles: 1,
          topUpgrades: ["Split the oversized dispatcher", "Add PDF regression tests"],
        })),
      },
      adminWorkerMissionState: {
        findFirst: vi.fn(async () => ({ nextAction: "Discover more PRAYER content." })),
      },
      adminWorkerStucknessRecord: { findFirst: vi.fn(async () => null) },
      adminWorkerStrictQAResult: { findMany: vi.fn(async () => []) },
      publishedContent: { count: zeroCount },
      checklistItem: { count: zeroCount },
      workerBuildJob: { count: zeroCount, findMany: vi.fn(async () => []) },
      adminWorkerBrainCall: {
        count: vi.fn(async () => 42),
        aggregate: vi.fn(async () => ({ _avg: { confidence: 0.81 } })),
        groupBy: vi.fn(async () => [
          { op: "select_action", _count: { _all: 20 }, _avg: { confidence: 0.8 } },
          { op: "detect_duplicates", _count: { _all: 10 }, _avg: { confidence: 0.9 } },
        ]),
      },
      adminWorkerDeveloperRequest: {
        findMany: vi.fn(async () => [
          {
            kind: "process",
            title: "Worker appears stuck",
            severity: "high",
            occurrences: 3,
            source: "stuckness",
          },
          {
            kind: "code",
            title: "Split the dispatcher",
            severity: "medium",
            occurrences: 1,
            source: "self_model",
          },
        ]),
      },
    },
  };
});

import { generateDeveloperAuditPdf } from "@/lib/diagnostics/developer-audit";

describe("developer-audit PDF — intelligence section", () => {
  it("generates a valid PDF including the unified brain audit data", async () => {
    const pdf = await generateDeveloperAuditPdf("week");
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(1000);
    // PDF magic header.
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});
