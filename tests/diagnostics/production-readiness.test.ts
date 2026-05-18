/**
 * Production readiness report — proves the report returns one card
 * per spec-listed category with severity, summary, last-updated
 * timestamp, and data source.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ingestion/queue/heartbeat", () => ({
  hasHealthyWorker: vi.fn().mockResolvedValue(true),
}));

import { getProductionReadinessReport } from "@/lib/diagnostics/production-readiness";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  prismaMock.ingestionJobQueue.count.mockResolvedValue(0);
  prismaMock.contentPackageBuildLog.count.mockResolvedValue(0);
  prismaMock.sourceDocument.findMany.mockResolvedValue([]);
  prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue(null);
  prismaMock.securityEvent.findFirst.mockResolvedValue(null);
  prismaMock.ingestionSource.count.mockResolvedValue(0);
  prismaMock.prayer.count.mockResolvedValue(0);
});

describe("getProductionReadinessReport", () => {
  it("returns one card per spec-listed category", async () => {
    const report = await getProductionReadinessReport();
    const ids = report.cards.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "environment_variables",
        "database",
        "worker",
        "queue",
        "content_factory",
        "email",
        "security",
        "source_configuration",
        "public_display",
      ]),
    );
  });

  it("every card has a severity, summary, lastUpdatedAt, and dataSource", async () => {
    const report = await getProductionReadinessReport();
    for (const c of report.cards) {
      expect(["pass", "warn", "fail", "error"]).toContain(c.severity);
      expect(c.summary.length).toBeGreaterThan(0);
      expect(c.lastUpdatedAt).toBeInstanceOf(Date);
      expect(c.dataSource.length).toBeGreaterThan(0);
    }
  });
});
