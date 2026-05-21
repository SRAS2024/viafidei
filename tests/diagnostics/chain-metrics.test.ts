/**
 * Full pipeline chain metrics.
 *
 * Pins section 15: chain-stage events recorded in QueueAuditLog roll
 * up into one row per pipeline stage, and the first instrumented
 * stage with zero events (while upstream has some) is the blocker.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getChainMetrics } from "@/lib/diagnostics/chain-metrics";

beforeEach(() => {
  resetPrismaMock();
});

describe("getChainMetrics", () => {
  it("maps chain-stage events to pipeline stages with counts and latest timestamps", async () => {
    const latest = new Date("2026-05-21T00:00:00Z");
    prismaMock.queueAuditLog.groupBy.mockResolvedValue([
      { event: "chain.discovery_completed", _count: { _all: 7 }, _max: { createdAt: latest } },
      { event: "chain.source_document_created", _count: { _all: 5 }, _max: { createdAt: latest } },
      { event: "chain.strict_qa_passed", _count: { _all: 3 }, _max: { createdAt: latest } },
      { event: "chain.strict_qa_rejected", _count: { _all: 2 }, _max: { createdAt: latest } },
    ]);

    const report = await getChainMetrics();

    const discovery = report.stages.find((s) => s.stage === "discovery");
    expect(discovery?.count).toBe(7);
    expect(discovery?.latestAt).toEqual(latest);

    const strictQa = report.stages.find((s) => s.stage === "strict_qa");
    expect(strictQa?.count).toBe(3);
    expect(strictQa?.failureCount).toBe(2);
  });

  it("names the first instrumented empty stage as the blocker", async () => {
    // Discovery happened but nothing fetched.
    prismaMock.queueAuditLog.groupBy.mockResolvedValue([
      { event: "chain.discovery_completed", _count: { _all: 4 }, _max: { createdAt: new Date() } },
    ]);

    const report = await getChainMetrics();

    expect(report.blockerStage).toBe("fetch");
  });

  it("returns the full stage list including stages with no chain events", async () => {
    prismaMock.queueAuditLog.groupBy.mockResolvedValue([]);

    const report = await getChainMetrics();

    expect(report.stages.map((s) => s.stage)).toEqual([
      "discovery",
      "fetch",
      "source_document",
      "build",
      "validation_evidence",
      "strict_qa",
      "persist",
      "public",
      "search",
      "sitemap",
      "cache",
    ]);
    expect(report.stages.every((s) => s.count === 0)).toBe(true);
  });
});
