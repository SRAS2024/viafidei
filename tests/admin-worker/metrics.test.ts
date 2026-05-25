/**
 * Command Center metrics — proves the spec section 17 numbers are
 * computed deterministically from the underlying tables.
 */

import { describe, expect, it, vi } from "vitest";

import { loadCommandCenterMetrics } from "@/lib/admin-worker/metrics";

function makePrisma(opts: {
  qaTotal?: number;
  qaPassed?: number;
  publishesAttempted?: number;
  publishesSucceeded?: number;
  deletionLogs?: number;
  reviewQueueCount?: number;
  recentSecurityActions24h?: number;
  lastReportAt?: Date | null;
  publishedContentLive?: number;
  queueInFlight?: number;
}) {
  const o = {
    qaTotal: 0,
    qaPassed: 0,
    publishesAttempted: 0,
    publishesSucceeded: 0,
    deletionLogs: 0,
    reviewQueueCount: 0,
    recentSecurityActions24h: 0,
    lastReportAt: null as Date | null,
    publishedContentLive: 0,
    queueInFlight: 0,
    ...opts,
  };
  return {
    checklistQAReport: {
      count: vi.fn(async ({ where }: { where: { passed?: boolean } }) =>
        where.passed === true ? o.qaPassed : o.qaTotal,
      ),
    },
    adminWorkerLog: {
      count: vi.fn(async ({ where }: { where: { eventName?: { in: string[] } | string } }) => {
        if (typeof where.eventName === "object" && Array.isArray(where.eventName.in))
          return o.publishesAttempted;
        if (where.eventName === "publish_gate_publish") return o.publishesSucceeded;
        if (where.eventName === "content_deleted") return o.deletionLogs;
        return 0;
      }),
    },
    humanReviewQueue: { count: vi.fn(async () => o.reviewQueueCount) },
    adminWorkerSecurityAction: { count: vi.fn(async () => o.recentSecurityActions24h) },
    adminDeveloperReportLog: {
      findFirst: vi.fn(async () => (o.lastReportAt ? { generatedAt: o.lastReportAt } : null)),
    },
    publishedContent: { count: vi.fn(async () => o.publishedContentLive) },
    workerBuildJob: { count: vi.fn(async () => o.queueInFlight) },
  } as unknown as Parameters<typeof loadCommandCenterMetrics>[0];
}

describe("loadCommandCenterMetrics", () => {
  it("returns zero metrics on an empty system", async () => {
    const prisma = makePrisma({});
    const m = await loadCommandCenterMetrics(prisma);
    expect(m.publishRate30d).toBe(0);
    expect(m.qaPassRate30d).toBe(0);
    expect(m.deletionRate30d).toBe(0);
    expect(m.monthlyReportFresh).toBe(false);
    expect(m.monthlyReportLastAt).toBeNull();
  });

  it("publishRate = succeeded / attempted", async () => {
    const m = await loadCommandCenterMetrics(
      makePrisma({ publishesAttempted: 10, publishesSucceeded: 8 }),
    );
    expect(m.publishRate30d).toBeCloseTo(0.8, 5);
  });

  it("qaPassRate = passed / total", async () => {
    const m = await loadCommandCenterMetrics(makePrisma({ qaTotal: 20, qaPassed: 18 }));
    expect(m.qaPassRate30d).toBeCloseTo(0.9, 5);
  });

  it("deletionRate uses publishes as the denominator", async () => {
    const m = await loadCommandCenterMetrics(
      makePrisma({ publishesSucceeded: 100, deletionLogs: 5 }),
    );
    expect(m.deletionRate30d).toBeCloseTo(0.05, 5);
  });

  it("flags the monthly report as fresh when it was generated within 32 days", async () => {
    const m = await loadCommandCenterMetrics(makePrisma({ lastReportAt: new Date() }));
    expect(m.monthlyReportFresh).toBe(true);
  });

  it("flags the monthly report as stale when older than 32 days", async () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const m = await loadCommandCenterMetrics(makePrisma({ lastReportAt: old }));
    expect(m.monthlyReportFresh).toBe(false);
  });
});
