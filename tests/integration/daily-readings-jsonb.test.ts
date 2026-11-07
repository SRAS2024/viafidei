/**
 * Integration proof: a day's sections can go through a REAL jsonb column, where Postgres
 * puts their keys in its own order, without the backfill taking that for a change. The
 * unit tests imitate the reordering; this is the column. Before the comparison ignored
 * key order, every scan rewrote the whole three-year window and bumped verifiedAt.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  backfillDailyReadings,
  fetchReadingsForDate,
  refreshDailyReadings,
} from "@/lib/admin-worker/daily-readings";
import { prisma } from "@/lib/db/client";

// Years ahead, so nothing else in the test database has rows here.
const FROM = new Date("2031-03-03T00:00:00Z");
const DAYS = 3;
const WINDOW = {
  calendar: "roman-ordinary",
  locale: "en",
  date: { gte: FROM, lt: new Date(FROM.getTime() + DAYS * 86_400_000) },
};

type Section = { kind: string; label: string; citation: string | null; body: string | null };

async function cleanup() {
  await prisma.dailyReading.deleteMany({ where: WINDOW });
  await prisma.adminWorkerLog.deleteMany({
    where: { eventName: { in: ["daily_readings_backfill", "daily_readings_published"] } },
  });
}

const rows = () => prisma.dailyReading.findMany({ where: WINDOW, orderBy: { date: "asc" } });
const scan = () => backfillDailyReadings(prisma, { from: FROM, days: DAYS });
// A rewrite in the same millisecond would look like no rewrite at all.
const aMoment = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("daily-readings backfill against a real jsonb column (integration)", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("the column really does hand a section's keys back in another order", async () => {
    const first = await scan();
    expect(first).toMatchObject({ created: DAYS, failed: 0 });
    const [row] = await rows();
    const written = await fetchReadingsForDate(FROM, WINDOW);
    expect(row!.sections).toEqual(written!.sections);
    expect(JSON.stringify(row!.sections)).not.toBe(JSON.stringify(written!.sections));
  });

  it("a second scan writes nothing", async () => {
    await scan();
    const before = await rows();
    expect(before.some((r) => r.status === "PUBLISHED")).toBe(true);

    await aMoment();
    const second = await scan();
    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: DAYS, failed: 0 });
    // updatedAt and verifiedAt included: nothing about these rows moved.
    expect(await rows()).toEqual(before);
  });

  it("a real change to a section is corrected once, then left alone", async () => {
    await scan();
    const [row] = await rows();
    const correct = row!.sections as Section[];
    await prisma.dailyReading.update({
      where: { id: row!.id },
      data: {
        sections: correct.map((s, i) => (i === 0 ? { ...s, body: "Out of date." } : s)) as never,
      },
    });

    const fixed = await scan();
    expect(fixed).toMatchObject({ updated: 1, unchanged: DAYS - 1 });
    const [after] = await rows();
    expect(after!.sections).toEqual(correct);

    await aMoment();
    const again = await scan();
    expect(again).toMatchObject({ updated: 0, unchanged: DAYS });
    const [settled] = await rows();
    expect(settled!.updatedAt).toEqual(after!.updatedAt);
  });

  it("a stale source link, which the readings page shows, is corrected once", async () => {
    await scan();
    const [row] = await rows();
    await prisma.dailyReading.update({
      where: { id: row!.id },
      data: { sourceUrl: "https://bible.usccb.org/an-old-link.cfm" },
    });

    const fixed = await scan();
    expect(fixed).toMatchObject({ updated: 1, unchanged: DAYS - 1 });
    const [after] = await rows();
    expect(after!.sourceUrl).toBe(row!.sourceUrl);
    expect((await scan()).updated).toBe(0);
  });

  it("a row the scan leaves alone is still re-verified by the day's own refresh", async () => {
    // The scan used to bump verifiedAt on every row, which kept the refresh from ever
    // re-verifying today. Now the row goes stale after a day, as the refresh expects.
    await scan();
    const [row] = await rows();
    const yesterday = new Date(Date.now() - 21 * 60 * 60 * 1000);
    await prisma.dailyReading.update({ where: { id: row!.id }, data: { verifiedAt: yesterday } });

    expect(await scan()).toMatchObject({ updated: 0, unchanged: DAYS });
    const [left] = await rows();
    expect(left!.verifiedAt).toEqual(yesterday);

    const refreshed = await refreshDailyReadings(prisma, { date: FROM });
    expect(refreshed.status).toBe("published");
    const [verified] = await rows();
    expect(verified!.verifiedAt!.getTime()).toBeGreaterThan(yesterday.getTime());
    expect((await refreshDailyReadings(prisma, { date: FROM })).status).toBe("fresh");
  });

  it("the day's own refresh and the scan agree, so neither rewrites the other's row", async () => {
    const refreshed = await refreshDailyReadings(prisma, { date: FROM });
    expect(refreshed.status).toBe("published");
    const before = await rows();

    await aMoment();
    const res = await backfillDailyReadings(prisma, { from: FROM, days: 1 });
    expect(res).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(await rows()).toEqual(before);
  });
});
