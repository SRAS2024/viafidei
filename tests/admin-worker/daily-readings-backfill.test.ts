/**
 * Autonomous daily-readings backfill — proves the Admin Worker fills a forward
 * window, stores verified text for covered days, self-corrects drifted rows,
 * and never downgrades a verified day. Pure unit test over a mocked Prisma.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import { backfillDailyReadings } from "@/lib/admin-worker/daily-readings";

const D = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoOf = (d: Date) => d.toISOString().slice(0, 10);

function makePrisma(existing: Array<Record<string, unknown>>) {
  const creates: Array<Record<string, unknown>> = [];
  const updates: Array<{ data: Record<string, unknown> }> = [];
  const prisma = {
    dailyReading: {
      findMany: vi.fn(async () => existing),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        creates.push(a.data);
        return a.data;
      }),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
        updates.push(a);
        return {};
      }),
    },
  } as unknown as PrismaClient;
  return { prisma, creates, updates };
}

describe("backfillDailyReadings", () => {
  it("fills the window: a covered solemnity is PUBLISHED with text, others REVIEW", async () => {
    const { prisma, creates } = makePrisma([]);
    const r = await backfillDailyReadings(prisma, { from: D("2025-12-24"), days: 3 });
    expect(r.scanned).toBe(3);
    expect(r.created).toBe(3);
    expect(r.published).toBe(1); // 2025-12-25 = the Nativity
    expect(r.review).toBe(2);

    const nativity = creates.find((c) => isoOf(c.date as Date) === "2025-12-25")!;
    expect(nativity.status).toBe("PUBLISHED");
    expect((nativity.sections as Array<{ body: string | null }>).some((s) => s.body)).toBe(true);
  });

  it("self-corrects: upgrades a stale REVIEW row to PUBLISHED once coverage exists", async () => {
    const { prisma, updates } = makePrisma([
      {
        date: D("2025-12-25"),
        status: "REVIEW",
        seasonLabel: "stale",
        sundayCycle: "?",
        weekdayCycle: "?",
        color: "?",
        sourceConfidence: 0,
        sections: [],
      },
    ]);
    const r = await backfillDailyReadings(prisma, { from: D("2025-12-25"), days: 1 });
    expect(r.updated).toBe(1);
    expect(updates[0].data.status).toBe("PUBLISHED");
  });

  it("never downgrades a PUBLISHED day to REVIEW", async () => {
    const { prisma, updates, creates } = makePrisma([
      {
        date: D("2025-12-24"), // an uncovered weekday → engine would say REVIEW
        status: "PUBLISHED",
        seasonLabel: "Advent",
        sundayCycle: "C",
        weekdayCycle: "II",
        color: "Violet",
        sourceConfidence: 0.75,
        sections: [{ kind: "GOSPEL", label: "Gospel", citation: "x", body: "y" }],
      },
    ]);
    const r = await backfillDailyReadings(prisma, { from: D("2025-12-24"), days: 1 });
    expect(updates.length).toBe(0);
    expect(creates.length).toBe(0);
    expect(r.unchanged).toBe(1);
  });

  it("is idempotent: an already-correct row is left untouched", async () => {
    const first = makePrisma([]);
    await backfillDailyReadings(first.prisma, { from: D("2025-12-24"), days: 1 });
    const created = first.creates[0];

    const second = makePrisma([created]); // feed the freshly-created row back in
    const r = await backfillDailyReadings(second.prisma, { from: D("2025-12-24"), days: 1 });
    expect(r.unchanged).toBe(1);
    expect(second.updates.length).toBe(0);
    expect(second.creates.length).toBe(0);
  });
});
