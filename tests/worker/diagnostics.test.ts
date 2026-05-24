/**
 * Tests for the diagnostics module that powers /admin/diagnostics.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/client", () => {
  const stub: any = {
    $queryRaw: vi.fn().mockResolvedValue([{ "1": 1 }]),
    checklistItem: {
      count: vi.fn().mockResolvedValue(190),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    authoritySource: { count: vi.fn().mockResolvedValue(20) },
    workerBuildJob: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    checklistQAReport: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    publishedContent: {
      count: vi.fn().mockResolvedValue(50),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([
        { contentType: "PRAYER", _count: 10 },
        { contentType: "SAINT", _count: 5 },
      ]),
    },
    workerBuildLog: { count: vi.fn().mockResolvedValue(20) },
    checklistCitation: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma: stub };
});

import { runAllDiagnostics, buildDeveloperReport } from "@/lib/diagnostics";

describe("runAllDiagnostics", () => {
  it("returns one result per check", async () => {
    const results = await runAllDiagnostics();
    expect(results.length).toBeGreaterThanOrEqual(8);
    const keys = results.map((r) => r.key);
    expect(keys).toContain("database");
    expect(keys).toContain("checklist");
    expect(keys).toContain("authority-sources");
    expect(keys).toContain("knowledge");
    expect(keys).toContain("autonomy");
    expect(keys).toContain("queue");
    expect(keys).toContain("qa");
    expect(keys).toContain("publishing");
    expect(keys).toContain("coverage");
    expect(keys).toContain("janitor");
    expect(keys).toContain("schemas");
  });

  it("every result has a valid status value", async () => {
    const results = await runAllDiagnostics();
    for (const r of results) {
      expect(["pass", "warn", "fail"]).toContain(r.status);
      expect(typeof r.summary).toBe("string");
      expect(r.summary.length).toBeGreaterThan(0);
    }
  });
});

describe("buildDeveloperReport", () => {
  it("produces a markdown blob containing each diagnostic", () => {
    const md = buildDeveloperReport([
      {
        key: "database",
        label: "Database",
        status: "pass",
        summary: "ok",
      },
      {
        key: "queue",
        label: "Queue",
        status: "warn",
        summary: "slow",
        details: ["pending=5"],
        suggestedAction: "run the worker",
      },
    ]);
    expect(md).toContain("# Viafidei Developer Report");
    expect(md).toContain("Database");
    expect(md).toContain("Queue");
    expect(md).toContain("Suggested action: run the worker");
  });
});
