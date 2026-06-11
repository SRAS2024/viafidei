/**
 * Keyless Liturgical Calendar ingest (open Liturgical Calendar API → General
 * Roman Calendar). These tests pin the mapper (only feasts of the Lord +
 * solemnities, grade ≥ 5, become LITURGICAL records that pass the real schema;
 * fixed dates get a feastDate, movable ones are flagged; saints' memorials are
 * skipped) and the runner (publishes the solemnities/feasts, skips the rest).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import {
  mapLiturgicalEvent,
  runLiturgicalCalendarIngest,
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

  it("skips saints' memorials (grade < 5 → left to SAINT pages)", () => {
    expect(mapLiturgicalEvent(MEMORIAL, isFixed)).toBeNull();
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
  it("publishes solemnities/feasts and skips memorials", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ litcal: [ASSUMPTION, EASTER, MEMORIAL] }),
    })) as unknown as typeof global.fetch;
    const prisma = makePrisma();

    const out = await runLiturgicalCalendarIngest(prisma, { force: true });

    expect(out.enabled).toBe(true);
    expect(out.fetched).toBe(3);
    expect(out.published).toBe(2);
    expect(out.skipped).toBe(1);
    expect(mockedPublish).toHaveBeenCalledTimes(2);
  });

  it("is a no-op when disabled (skip-network)", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const prisma = makePrisma();
    const out = await runLiturgicalCalendarIngest(prisma, { force: true });
    expect(out.enabled).toBe(false);
    expect(out.published).toBe(0);
  });
});
