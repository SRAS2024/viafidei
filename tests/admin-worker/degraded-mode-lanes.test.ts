/**
 * Safe-degraded mode must not be a growth stop.
 *
 * Before: every content lane except OSM parishes was `activeOnly`, so a Python
 * brain crash, an 8 s stall or a TS/Python skew halted 14 of the 15 content
 * types, although the curated, structured and liturgical ingests never consult
 * the brain (they publish with `skipBrainScreens`) and the enrichments are
 * deterministic maintenance. These tests pin the per-lane contract:
 *   - with the brain degraded, the deterministic lanes run and the web-funnel
 *     discovery lanes are skipped;
 *   - a lane allowed to run while degraded never imports the brain bridge, and
 *     every publish it makes skips the brain screens, so the orchestrator runs
 *     exactly the same deterministic gates in both modes (no accuracy gate is
 *     lost by running it without the brain).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const hit = (name: string, value: unknown = {}) =>
  vi.fn(async () => {
    calls.push(name);
    return value;
  });

vi.mock("@/lib/admin-worker/curated-ingest", () => ({
  runCuratedIngest: hit("ingest-curated", { published: 2, updated: 0 }),
}));
vi.mock("@/lib/admin-worker/structured/ingest", () => ({
  runStructuredIngest: hit("ingest-structured", { published: 3 }),
}));
vi.mock("@/lib/admin-worker/liturgical-calendar-ingest", () => ({
  runLiturgicalCalendarIngest: hit("ingest-liturgical", { published: 1 }),
}));
vi.mock("@/lib/admin-worker/prayer-translation-backfill", () => ({
  runPrayerTranslationBackfill: hit("enrich-translations"),
}));
vi.mock("@/lib/admin-worker/human-review", () => ({
  runReviewAutoResolve: hit("enrich-reviews"),
}));
vi.mock("@/lib/admin-worker/pope-cleanup", () => ({
  pruneAntipopeRecords: hit("enrich-pope-cleanup"),
  pruneDuplicatePopeRecords: hit("enrich-pope-cleanup:duplicates"),
}));
vi.mock("@/lib/admin-worker/structured/discovery-seeder", () => ({
  runDiscoverySeeder: hit("discover-structured"),
}));
vi.mock("@/lib/admin-worker/parish-osm", () => ({
  runOsmParishDiscovery: hit("discover-parish-osm", { published: 4 }),
}));
vi.mock("@/lib/admin-worker/always-on-discovery", () => ({
  runAlwaysOnDiscovery: hit("discover-web"),
}));

import type { PrismaClient } from "@prisma/client";

import { runWorkerLanes } from "@/lib/admin-worker/lanes";
import { CONTENT_LANES } from "@/lib/admin-worker/worker-lanes";

function fakePrisma(): PrismaClient {
  const states = new Map<string, Record<string, unknown>>();
  return {
    adminWorkerLaneState: {
      findMany: async () => [...states.values()],
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { lane: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => {
        states.set(where.lane, { ...(states.get(where.lane) ?? create), ...update });
        return states.get(where.lane);
      },
    },
    adminWorkerLog: { create: async () => ({}) },
  } as unknown as PrismaClient;
}

const DETERMINISTIC = [
  "ingest-curated",
  "ingest-structured",
  "ingest-liturgical",
  "enrich-translations",
  "enrich-reviews",
  "enrich-pope-cleanup",
  "discover-parish-osm",
];

beforeEach(() => {
  calls.length = 0;
});

describe("content lanes while the Python brain is degraded", () => {
  it("runs the deterministic ingests and enrichments and keeps publishing", async () => {
    const res = await runWorkerLanes(fakePrisma(), CONTENT_LANES, {
      active: false,
      campaignPhase: "NORMAL",
    });

    expect([...res.ran].sort()).toEqual([...DETERMINISTIC].sort());
    expect([...res.skipped].sort()).toEqual(["discover-structured", "discover-web"]);
    expect(res.errored).toEqual([]);
    // Curated 2 + structured 3 + liturgical 1 + OSM 4.
    expect(res.published).toBe(10);
    expect(calls).not.toContain("discover-structured");
    expect(calls).not.toContain("discover-web");
  });

  it("runs every content lane once the brain is active again", async () => {
    const res = await runWorkerLanes(fakePrisma(), CONTENT_LANES, {
      active: true,
      campaignPhase: "NORMAL",
    });
    expect(res.ran.length).toBe(CONTENT_LANES.length);
    expect(res.skipped).toEqual([]);
  });
});

describe("a lane that runs while degraded never depends on the brain", () => {
  const read = (rel: string) =>
    readFileSync(join(process.cwd(), "src/lib/admin-worker", rel), "utf8");

  // What each degraded-safe lane executes (its module plus the publish helper
  // it delegates to). OSM parishes are pinned by their own tests.
  const MODULES: Record<string, string[]> = {
    "ingest-curated": ["curated-ingest.ts", "seed-curated-content.ts"],
    "ingest-structured": ["structured/ingest.ts"],
    "ingest-liturgical": ["liturgical-calendar-ingest.ts"],
    "enrich-translations": ["prayer-translation-backfill.ts", "prayer-translator.ts"],
    "enrich-reviews": ["human-review.ts"],
    "enrich-pope-cleanup": ["pope-cleanup.ts"],
  };
  const BRAIN_IMPORT =
    /(from|import\()\s*["'](\.{1,2}\/)+(intelligence|final-brain|proof-publishing|brain-mutex|brain)(\/[^"']*)?["']/;

  it("covers exactly the non-activeOnly lanes (except OSM)", () => {
    const ungated = CONTENT_LANES.filter((l) => !l.activeOnly).map((l) => l.name);
    expect(ungated.filter((n) => n !== "discover-parish-osm").sort()).toEqual(
      Object.keys(MODULES).sort(),
    );
  });

  it.each(Object.entries(MODULES))("%s imports no brain bridge", (_lane, files) => {
    for (const file of files) {
      expect(read(file), file).not.toMatch(BRAIN_IMPORT);
    }
  });

  it.each(Object.entries(MODULES))("%s publishes only with skipBrainScreens", (_lane, files) => {
    for (const file of files) {
      const src = read(file);
      const publishes = (src.match(/runPublishOrchestrator\(prisma/g) ?? []).length;
      const skips = (src.match(/skipBrainScreens: true/g) ?? []).length;
      expect(skips, file).toBeGreaterThanOrEqual(publishes);
    }
  });
});
