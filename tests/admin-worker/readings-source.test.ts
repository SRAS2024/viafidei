/**
 * Readings-source framework — proves the worker's pluggable ability to acquire
 * readings from the best source in priority order, ingest an authoritative
 * dataset, and never trust a malformed feed.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  acquireReadings,
  configureRemoteLectionarySource,
  ingestLectionaryDataset,
  listReadingsSources,
  registerReadingsSource,
  resetReadingsSources,
  clearRemoteLectionaryCache,
} from "@/lib/admin-worker/readings-source";

const opts = { calendar: "roman-ordinary", locale: "en" };

afterEach(() => {
  resetReadingsSources();
  clearRemoteLectionaryCache();
});

describe("acquireReadings", () => {
  it("uses the offline lectionary table for a covered day (Christmas)", async () => {
    const got = await acquireReadings(new Date("2025-12-25T00:00:00Z"), opts);
    expect(got?.source).toBe("lectionary-table");
    expect(got!.sections.find((s) => s.kind === "GOSPEL")!.body).toMatch(/Word/);
  });

  it("returns null for an uncovered day with no other source", async () => {
    expect(await acquireReadings(new Date("2026-02-17T00:00:00Z"), opts)).toBeNull();
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
});

describe("ingestLectionaryDataset", () => {
  it("normalises a valid dataset and drops malformed entries", () => {
    const map = ingestLectionaryDataset({
      entries: {
        "ordinary-7-tuesday": [
          { kind: "FIRST_READING", label: "First Reading", citation: "Sirach 2:1-11", body: "..." },
          { kind: "GOSPEL", label: "Gospel", citation: "Mark 9:30-37" },
        ],
        "bad-entry": [{ kind: "NOT_A_KIND", citation: "x" }], // dropped (invalid kind)
        "empty-entry": [{ kind: "GOSPEL" }], // dropped (no citation or body)
        "not-an-array": { kind: "GOSPEL" },
      },
    });
    expect(Object.keys(map)).toEqual(["ordinary-7-tuesday"]);
    expect(map["ordinary-7-tuesday"]).toHaveLength(2);
    expect(map["ordinary-7-tuesday"][1].citation).toBe("Mark 9:30-37");
  });

  it("returns an empty map for junk input (never throws)", () => {
    expect(ingestLectionaryDataset(null)).toEqual({});
    expect(ingestLectionaryDataset({})).toEqual({});
    expect(ingestLectionaryDataset({ entries: "nope" })).toEqual({});
  });
});

describe("remote lectionary dataset", () => {
  it("fills an otherwise-uncovered day from an injected dataset loader", async () => {
    configureRemoteLectionarySource({
      url: "https://example.test/lectionary.json",
      load: async () => ({
        entries: {
          "ordinary-6-tuesday": [
            {
              kind: "FIRST_READING",
              label: "First Reading",
              citation: "Sirach 2:1-11",
              body: "Son, when...",
            },
            { kind: "PSALM", label: "Responsorial Psalm", citation: "Psalm 37:3-4" },
            { kind: "GOSPEL", label: "Gospel", citation: "Mark 9:30-37", body: "They departed..." },
          ],
        },
      }),
    });
    const got = await acquireReadings(new Date("2026-02-17T00:00:00Z"), opts); // ordinary-6-tuesday
    expect(got?.source).toBe("remote-dataset");
    expect(got!.sections).toHaveLength(3);
    expect(got!.confidence).toBeCloseTo(2 / 3, 5);
  });

  it("falls back cleanly when the loader yields nothing", async () => {
    configureRemoteLectionarySource({
      url: "https://example.test/missing.json",
      load: async () => null,
    });
    expect(await acquireReadings(new Date("2026-02-17T00:00:00Z"), opts)).toBeNull();
  });
});
