/**
 * Autonomous daily-readings backfill — proves the Admin Worker fills a
 * three-year window from the Lectionary tables, publishes ORDINARY WEEKDAYS
 * (the old 0.7 confidence ratio rejected every three-section weekday, so only
 * Sundays and solemnities could ever reach the page), never writes an empty
 * skeleton over readings it could resolve, never downgrades a verified day,
 * and COUNTS database failures instead of reporting a mis-pointed database as
 * success. Pure unit test over a mocked Prisma.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import { backfillDailyReadings } from "@/lib/admin-worker/daily-readings";
import { registerReadingsSource, resetReadingsSources } from "@/lib/admin-worker/readings-source";
import { writeAdminWorkerLog } from "@/lib/admin-worker/logs";

const D = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoOf = (d: Date) => d.toISOString().slice(0, 10);

type Section = { kind: string; label: string; citation: string | null; body: string | null };

afterEach(() => {
  resetReadingsSources();
  vi.mocked(writeAdminWorkerLog).mockClear();
});

function makePrisma(existing: Array<Record<string, unknown>>, opts: { failWrites?: string } = {}) {
  const creates: Array<Record<string, unknown>> = [];
  const updates: Array<{ data: Record<string, unknown> }> = [];
  const fail = opts.failWrites;
  const prisma = {
    dailyReading: {
      findMany: vi.fn(async () => existing),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        if (fail) throw new Error(fail);
        creates.push(a.data);
        return a.data;
      }),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
        if (fail) throw new Error(fail);
        updates.push(a);
        return {};
      }),
    },
  } as unknown as PrismaClient;
  return { prisma, creates, updates };
}

describe("backfillDailyReadings", () => {
  it("fills the window with PUBLISHED rows carrying real text", async () => {
    const { prisma, creates } = makePrisma([]);
    const r = await backfillDailyReadings(prisma, { from: D("2025-12-24"), days: 3 });
    expect(r.scanned).toBe(3);
    expect(r.created).toBe(3);
    expect(r.failed).toBe(0);

    const nativity = creates.find((c) => isoOf(c.date as Date) === "2025-12-25")!;
    expect(nativity.status).toBe("PUBLISHED");
    expect((nativity.sections as Section[]).some((s) => s.body)).toBe(true);
  });

  it("publishes an ORDINARY WEEKDAY (the old ratio gate rejected every one)", async () => {
    const { prisma, creates } = makePrisma([]);
    // A plain Tuesday in Ordinary Time: First Reading, Psalm, Acclamation,
    // Gospel — the shape that used to score below 0.7 and stay in REVIEW.
    const r = await backfillDailyReadings(prisma, { from: D("2026-09-08"), days: 1 });
    expect(r.published).toBe(1);
    expect(r.review).toBe(0);
    const row = creates[0];
    expect(row.status).toBe("PUBLISHED");
    const sections = row.sections as Section[];
    expect(sections.length).toBeGreaterThanOrEqual(3);
    expect(sections.some((s) => s.body)).toBe(true);
  });

  it("never writes a citation-less skeleton for a day the tables cover", async () => {
    const { prisma, creates } = makePrisma([]);
    await backfillDailyReadings(prisma, { from: D("2026-02-17"), days: 5 });
    for (const row of creates) {
      const sections = row.sections as Section[];
      expect(sections.length).toBeGreaterThan(0);
      for (const s of sections) {
        expect(s.citation, `${isoOf(row.date as Date)} ${s.kind}`).toBeTruthy();
      }
    }
  });

  it("stores the citations even when a day resolves to no verified text", async () => {
    // A source that yields citations but no bodies (the Douay store cannot
    // align every book) — the row stays REVIEW but must still carry the day.
    registerReadingsSource({
      name: "citations-only",
      priority: 999,
      async resolve() {
        return {
          sections: [
            { kind: "FIRST_READING", label: "First Reading", citation: "Sir 5:1-8", body: null },
            { kind: "GOSPEL", label: "Gospel", citation: "Mk 9:41-50", body: null },
          ],
          confidence: 0,
        };
      },
    });
    const { prisma, creates } = makePrisma([]);
    const r = await backfillDailyReadings(prisma, { from: D("2026-02-24"), days: 1 });
    expect(r.review).toBe(1);
    expect(creates[0].status).toBe("REVIEW");
    expect((creates[0].sections as Section[])[0].citation).toBe("Sir 5:1-8");
  });

  it("self-corrects: upgrades a stale REVIEW row to PUBLISHED", async () => {
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
    // Force the day to resolve citation-only, which would otherwise be REVIEW.
    registerReadingsSource({
      name: "citations-only",
      priority: 999,
      async resolve() {
        return {
          sections: [{ kind: "GOSPEL", label: "Gospel", citation: "Mk 1:1", body: null }],
          confidence: 0,
        };
      },
    });
    const { prisma, updates, creates } = makePrisma([
      {
        date: D("2025-12-24"),
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

  it("counts write failures and THROWS when nothing landed (a dead database is not success)", async () => {
    const { prisma } = makePrisma([], { failWrites: "connect ECONNREFUSED 127.0.0.1:5432" });
    await expect(backfillDailyReadings(prisma, { from: D("2025-12-24"), days: 3 })).rejects.toThrow(
      /wrote nothing/,
    );
    // The failure is logged at WARN with the first error, not swallowed.
    const call = vi.mocked(writeAdminWorkerLog).mock.calls.at(-1)![1];
    expect(call.severity).toBe("WARN");
    expect(call.message).toMatch(/ECONNREFUSED/);
  });

  it("reports partial failures without throwing when some rows did land", async () => {
    let calls = 0;
    const prisma = {
      dailyReading: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async (a: { data: Record<string, unknown> }) => {
          calls += 1;
          if (calls === 2) throw new Error("unique constraint");
          return a.data;
        }),
        update: vi.fn(async () => ({})),
      },
    } as unknown as PrismaClient;
    const r = await backfillDailyReadings(prisma, { from: D("2025-12-24"), days: 3 });
    expect(r.created).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.firstError).toMatch(/unique constraint/);
  });

  it("defaults to a three-year window (a year back, two years forward)", async () => {
    const { prisma } = makePrisma([]);
    const r = await backfillDailyReadings(prisma, { days: 1096 });
    expect(r.scanned).toBe(1096);
    // Every day of three years resolves to a formulary — no empty skeletons.
    expect(r.published + r.review).toBe(1096);
    expect(r.review).toBeLessThan(r.published);
  });
});
