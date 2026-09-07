/**
 * Readings-source framework — the worker acquires each day's readings from the
 * committed Lectionary tables, offline, for EVERY day (not just the principal
 * solemnities the old seed table carried), in the compact row shape the
 * DailyReading column stores. The phantom LECTIONARY_DATA_URL adapter is gone;
 * the registry stays so a genuinely external source could be added.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  acquireReadings,
  initReadingsSources,
  listReadingsSources,
  registerReadingsSource,
  resetReadingsSources,
} from "@/lib/admin-worker/readings-source";

const opts = { calendar: "roman-ordinary", locale: "en" };

afterEach(() => {
  resetReadingsSources();
});

describe("acquireReadings", () => {
  it("uses the offline lectionary table for a solemnity (Christmas)", async () => {
    const got = await acquireReadings(new Date("2025-12-25T00:00:00Z"), opts);
    expect(got?.source).toBe("lectionary-table");
    expect(got!.lectionaryNumber).toBe("16");
    expect(got!.sections.find((s) => s.kind === "GOSPEL")!.body).toMatch(/Word/);
  });

  it("covers an ordinary weekday too — the day the old table had no entry for", async () => {
    const got = await acquireReadings(new Date("2026-02-17T00:00:00Z"), opts); // ordinary-6-tuesday
    expect(got?.source).toBe("lectionary-table");
    expect(got!.sections.length).toBeGreaterThanOrEqual(3);
    expect(got!.sections.every((s) => s.citation)).toBe(true);
  });

  it("honours the weekday cycle: the same date in Year I and Year II differ", async () => {
    // 2026-02-17 is Year II; 2027-02-16 (also ordinary-6-tuesday) is Year I.
    const yearII = await acquireReadings(new Date("2026-02-17T00:00:00Z"), opts);
    const yearI = await acquireReadings(new Date("2027-02-16T00:00:00Z"), opts);
    const first = (r: typeof yearI) =>
      r!.sections.find((s) => s.kind === "FIRST_READING")!.citation;
    expect(first(yearI)).not.toBe(first(yearII));
  });

  it("returns the compact stored shape only (no alternatives / notes persisted)", async () => {
    const got = await acquireReadings(new Date("2025-12-25T00:00:00Z"), opts);
    for (const section of got!.sections) {
      expect(Object.keys(section).sort()).toEqual(["body", "citation", "kind", "label"]);
    }
  });

  it("declines a calendar or locale it does not serve", async () => {
    expect(
      await acquireReadings(new Date("2025-12-25T00:00:00Z"), {
        calendar: "byzantine",
        locale: "en",
      }),
    ).toBeNull();
    expect(
      await acquireReadings(new Date("2025-12-25T00:00:00Z"), {
        calendar: "roman-ordinary",
        locale: "la",
      }),
    ).toBeNull();
  });

  it("tries higher-priority sources first", async () => {
    registerReadingsSource({
      name: "test-override",
      priority: 999,
      async resolve() {
        return {
          sections: [{ kind: "GOSPEL", label: "Gospel", citation: "Test 1:1", body: "override" }],
          confidence: 1,
        };
      },
    });
    const got = await acquireReadings(new Date("2025-12-25T00:00:00Z"), opts);
    expect(got?.source).toBe("test-override");
    expect(listReadingsSources()[0].name).toBe("test-override");
  });

  it("survives a source that throws (fail-open to the next source)", async () => {
    registerReadingsSource({
      name: "broken",
      priority: 500,
      async resolve() {
        throw new Error("boom");
      },
    });
    const got = await acquireReadings(new Date("2025-12-25T00:00:00Z"), opts);
    expect(got?.source).toBe("lectionary-table");
  });
});

describe("initReadingsSources", () => {
  it("leaves the table source registered and reads no environment variable", () => {
    initReadingsSources();
    expect(listReadingsSources().map((s) => s.name)).toEqual(["lectionary-table"]);
  });
});
