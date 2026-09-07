/**
 * Keyless Liturgical Calendar ingest (open Liturgical Calendar API → General
 * Roman Calendar). These tests pin the mapper (feasts of the Lord + solemnities
 * always become LITURGICAL records that pass the real schema; fixed dates get a
 * feastDate, movable ones are flagged; the saints' memorials become records
 * only when no SAINT page covers them; one season record per season) and the
 * runner (publishes what is not yet live, throttles only after a successful
 * fetch, and skips the brain screens for this deterministic API data).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import {
  mapLiturgicalEvent,
  mapLiturgicalSeasons,
  normaliseSaintName,
  runLiturgicalCalendarIngest,
  saintPagePredicate,
} from "@/lib/admin-worker/liturgical-calendar-ingest";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";

const mockedPublish = vi.mocked(runPublishOrchestrator);

const KEYS = [
  "ADMIN_WORKER_SKIP_NETWORK",
  "ADMIN_WORKER_LITURGICAL_API",
  "LITURGICAL_CALENDAR_API_URL",
];
let saved: Record<string, string | undefined>;
const realFetch = global.fetch;

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  mockedPublish.mockReset();
  mockedPublish.mockResolvedValue({ kind: "published" } as never);
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

const ASSUMPTION = {
  name: "The Assumption of the Blessed Virgin Mary",
  date: "2024-08-15T00:00:00+00:00",
  grade: 6,
  grade_lcl: "Solemnity",
  color_lcl: ["white"],
  liturgical_season: "ORDINARY_TIME",
  liturgical_season_lcl: "Ordinary Time",
  event_key: "Assumption",
};
const EASTER = {
  name: "Easter Sunday of the Resurrection of the Lord",
  date: "2024-03-31T00:00:00+00:00",
  grade: 7,
  grade_lcl: "Higher Solemnity",
  color_lcl: ["white"],
  liturgical_season: "EASTER",
  liturgical_season_lcl: "Easter",
  event_key: "Easter",
};
const MEMORIAL = {
  name: "Saint Rose of Lima",
  date: "2024-08-23T00:00:00+00:00",
  grade: 3,
  grade_lcl: "Memorial",
  liturgical_season: "ORDINARY_TIME",
  event_key: "StRoseLima",
};

const FIXED = new Set(["Assumption", "Transfiguration"]);
const isFixed = (k: string) => FIXED.has(k);

describe("mapLiturgicalEvent", () => {
  it("maps a fixed-date solemnity to a SCHEMA-VALID LITURGICAL record", () => {
    const entry = mapLiturgicalEvent(ASSUMPTION, isFixed);
    expect(entry).not.toBeNull();
    expect(entry!.slug).toBe("liturgical-the-assumption-of-the-blessed-virgin-mary");
    expect(entry!.payload.kind).toBe("solemnity");
    expect(entry!.payload.feastDate).toBe("08-15");
    expect(entry!.payload.movableFeast).toBe(false);
    expect(entry!.payload.season).toBe("ordinary_time");
    expect(validatePayload("LITURGICAL", entry!.payload).ok).toBe(true);
  });

  it("flags a movable solemnity (no fixed feastDate)", () => {
    const entry = mapLiturgicalEvent(EASTER, isFixed);
    expect(entry!.payload.kind).toBe("solemnity");
    expect(entry!.payload.movableFeast).toBe(true);
    expect(entry!.payload.feastDate).toBeUndefined();
    expect(entry!.payload.season).toBe("easter");
    expect(validatePayload("LITURGICAL", entry!.payload).ok).toBe(true);
  });

  it("skips saints' memorials without a saint-page predicate (left to SAINT pages)", () => {
    expect(mapLiturgicalEvent(MEMORIAL, isFixed)).toBeNull();
  });

  it("emits a schema-valid memorial when NO SAINT page covers the celebration", () => {
    const entry = mapLiturgicalEvent(MEMORIAL, isFixed, { hasSaintPage: () => false });
    expect(entry).not.toBeNull();
    expect(entry!.payload.kind).toBe("memorial");
    expect(entry!.payload.rank).toBe("memorial");
    expect(String(entry!.payload.body)).toContain("is a memorial (Memorial)");
    expect(validatePayload("LITURGICAL", entry!.payload).ok).toBe(true);
  });

  it("maps grade 2 to optional_memorial and grade 4 to feast, and skips commemorations", () => {
    const opt = mapLiturgicalEvent(
      {
        ...MEMORIAL,
        name: "Saint Bartholomew the Apostle",
        grade: 2,
        grade_lcl: "Optional Memorial",
      },
      isFixed,
      { hasSaintPage: () => false },
    );
    expect(opt!.payload.kind).toBe("optional_memorial");
    expect(String(opt!.payload.body)).toContain("is an optional memorial");
    expect(validatePayload("LITURGICAL", opt!.payload).ok).toBe(true);
    const feast = mapLiturgicalEvent(
      { ...MEMORIAL, name: "Saint Andrew, Apostle", grade: 4, grade_lcl: "Feast" },
      isFixed,
      { hasSaintPage: () => false },
    );
    expect(feast!.payload.kind).toBe("feast");
    expect(
      mapLiturgicalEvent({ ...MEMORIAL, grade: 1 }, isFixed, { hasSaintPage: () => false }),
    ).toBeNull();
  });

  it("leaves a memorial to the SAINT page when one exists", () => {
    const hasSaintPage = saintPagePredicate(["Saint Rose of Lima", "St. Thérèse of Lisieux"]);
    expect(mapLiturgicalEvent(MEMORIAL, isFixed, { hasSaintPage })).toBeNull();
    expect(hasSaintPage("Saint Rose of Lima, Virgin")).toBe(true);
    expect(hasSaintPage("Saint Therese of the Child Jesus, Virgin and Doctor")).toBe(false);
    expect(hasSaintPage("Saints Cornelius, Pope, and Cyprian, Bishop, Martyrs")).toBe(false);
    expect(normaliseSaintName("Saint Rose of Lima, Virgin")).toBe("rose of lima");
    expect(normaliseSaintName("St. Thérèse of Lisieux")).toBe("therese of lisieux");
  });
});

describe("mapLiturgicalSeasons", () => {
  it("emits one schema-valid liturgical_season record per season with the year's boundaries", () => {
    const seasons = mapLiturgicalSeasons([ASSUMPTION, EASTER, MEMORIAL], 2024);
    expect(seasons.map((s) => s.payload.season).sort()).toEqual(["easter", "ordinary_time"]);
    const ot = seasons.find((s) => s.payload.season === "ordinary_time")!;
    expect(ot.slug).toBe("liturgical-season-ordinary-time");
    expect(ot.payload.kind).toBe("liturgical_season");
    expect(String(ot.payload.body)).toContain("August 15");
    expect(String(ot.payload.body)).toContain("August 23");
    expect(String(ot.payload.body)).toContain("2 celebration(s)");
    expect(validatePayload("LITURGICAL", ot.payload).ok).toBe(true);
    const easter = seasons.find((s) => s.payload.season === "easter")!;
    expect(validatePayload("LITURGICAL", easter.payload).ok).toBe(true);
  });
});

function makePrisma() {
  return {
    adminWorkerMemory: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
    publishedContent: {
      findMany: vi.fn(async () => [] as Array<{ slug: string; title: string }>),
    },
    checklistItem: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "ci1" })),
    },
    adminWorkerLog: { create: vi.fn(async () => ({})) },
  } as unknown as PrismaClient;
}

describe("runLiturgicalCalendarIngest", () => {
  it("publishes seasons, solemnities/feasts AND uncovered memorials, skipping the brain screens", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ litcal: [ASSUMPTION, EASTER, MEMORIAL] }),
    })) as unknown as typeof global.fetch;
    const prisma = makePrisma();

    const out = await runLiturgicalCalendarIngest(prisma, { force: true });

    expect(out.enabled).toBe(true);
    expect(out.fetched).toBe(3);
    // 2 seasons (ordinary_time, easter) + 2 great celebrations + 1 memorial
    // (no SAINT page for Rose of Lima in this catalog).
    expect(out.published).toBe(5);
    expect(out.skipped).toBe(0);
    expect(mockedPublish).toHaveBeenCalledTimes(5);
    for (const call of mockedPublish.mock.calls) {
      expect(call[1].skipBrainScreens).toBe(true);
      expect(call[1].contentType).toBe("LITURGICAL");
    }
    const kinds = mockedPublish.mock.calls
      .map((c) => (c[1].payload as { kind: string }).kind)
      .sort();
    expect(kinds).toEqual(
      ["solemnity", "solemnity", "liturgical_season", "liturgical_season", "memorial"].sort(),
    );
    // Throttle stamped AFTER the successful fetch.
    expect((prisma.adminWorkerMemory as { upsert: unknown }).upsert).toHaveBeenCalledTimes(1);
  });

  it("leaves a memorial to its live SAINT page", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ litcal: [ASSUMPTION, MEMORIAL] }),
    })) as unknown as typeof global.fetch;
    const prisma = makePrisma();
    (prisma.publishedContent as { findMany: unknown }).findMany = vi.fn(
      async ({ where }: { where?: { contentType?: string } }) =>
        where?.contentType === "SAINT" ? [{ title: "Saint Rose of Lima" }] : [],
    );

    const out = await runLiturgicalCalendarIngest(prisma, { force: true });
    // 1 season (ordinary_time) + the Assumption; the memorial is skipped.
    expect(out.published).toBe(2);
    expect(out.skipped).toBe(1);
    const kinds = mockedPublish.mock.calls.map((c) => (c[1].payload as { kind: string }).kind);
    expect(kinds).not.toContain("memorial");
  });

  it("does NOT burn the 24h throttle when the calendar API returns nothing", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof global.fetch;
    const prisma = makePrisma();
    const out = await runLiturgicalCalendarIngest(prisma, { force: true });
    expect(out.detail).toBe("calendar API returned nothing");
    expect((prisma.adminWorkerMemory as { upsert: unknown }).upsert).not.toHaveBeenCalled();
  });

  it("is throttled by a recent successful run (read-only check)", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ litcal: [ASSUMPTION] }),
    })) as unknown as typeof global.fetch;
    const prisma = makePrisma();
    (prisma.adminWorkerMemory as { findUnique: unknown }).findUnique = vi.fn(async () => ({
      lastUsedAt: new Date(),
    }));
    const out = await runLiturgicalCalendarIngest(prisma);
    expect(out.detail).toBe("throttled");
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it("is a no-op when disabled (skip-network)", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const prisma = makePrisma();
    const out = await runLiturgicalCalendarIngest(prisma, { force: true });
    expect(out.enabled).toBe(false);
    expect(out.published).toBe(0);
  });
});
