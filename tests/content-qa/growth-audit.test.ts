/**
 * Growth audit — answers the 10/10 question "why is each content
 * type growing or stalled?"
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getGrowthAudit } from "@/lib/content-qa/growth-audit";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.prayer.count.mockResolvedValue(0);
  prismaMock.saint.count.mockResolvedValue(0);
  prismaMock.parish.count.mockResolvedValue(0);
  prismaMock.dataManagementLog.count.mockResolvedValue(0);
  prismaMock.rejectedContentLog.count.mockResolvedValue(0);
  prismaMock.ingestionSource.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getGrowthAudit", () => {
  it("classifies as 'stalled' when no adds over 30 days and below target", async () => {
    prismaMock.prayer.count.mockResolvedValue(50);
    prismaMock.dataManagementLog.count.mockResolvedValue(0);
    const out = await getGrowthAudit({ contentType: "Prayer" });
    expect(out.status).toBe("stalled");
    expect(out.completionPct).toBe(Math.round((50 / 500) * 100));
    expect(out.explanation).toMatch(/Stalled/);
  });

  it("classifies as 'growing' when adds outpace deletes", async () => {
    prismaMock.prayer.count.mockResolvedValue(100);
    prismaMock.dataManagementLog.count.mockImplementation(
      async ({ where }: { where: { createdAt?: { gte: Date } } }) => {
        // last 24h / 7d / 30d
        const hours = where?.createdAt
          ? (Date.now() - new Date(where.createdAt.gte).getTime()) / (60 * 60 * 1000)
          : 0;
        if (hours < 30) return 5;
        if (hours < 180) return 30;
        return 80;
      },
    );
    const out = await getGrowthAudit({ contentType: "Prayer" });
    expect(out.status).toBe("growing");
    expect(out.addedLast7d).toBe(30);
  });

  it("classifies as 'shrinking' when deletes outpace adds in last 7 days", async () => {
    prismaMock.prayer.count.mockResolvedValue(50);
    prismaMock.dataManagementLog.count.mockResolvedValue(2); // adds
    prismaMock.rejectedContentLog.count.mockResolvedValue(20); // deletes
    const out = await getGrowthAudit({ contentType: "Prayer" });
    expect(out.status).toBe("shrinking");
    expect(out.explanation).toMatch(/Shrinking/);
  });

  it("classifies as 'complete' when target met", async () => {
    prismaMock.prayer.count.mockResolvedValue(500);
    const out = await getGrowthAudit({ contentType: "Prayer" });
    expect(out.status).toBe("complete");
    expect(out.completionPct).toBe(100);
  });

  it("surfaces top contributing hosts from active IngestionSource rows", async () => {
    prismaMock.prayer.count.mockResolvedValue(100);
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      { host: "vatican.va", completedItems: 80 },
      { host: "usccb.org", completedItems: 60 },
    ] as unknown as never);
    const out = await getGrowthAudit({ contentType: "Prayer" });
    expect(out.topContributingHosts).toHaveLength(2);
    expect(out.topContributingHosts[0].host).toBe("vatican.va");
    expect(out.topContributingHosts[0].saved).toBe(80);
  });

  it("returns a sentinel result for unknown content types", async () => {
    const out = await getGrowthAudit({ contentType: "NotAType" });
    expect(out.target).toBe(0);
    expect(out.explanation).toMatch(/Unknown\s+content\s+type/);
  });
});
