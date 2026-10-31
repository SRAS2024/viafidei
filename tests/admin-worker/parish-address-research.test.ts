/**
 * The `research-parish-addresses` lane. Pins:
 *   - the plan for one answer: blanks are filled (street in the country's
 *     order, locality, state, validated postal code, country), a differing
 *     non-empty street or city is left alone, a disagreeing country code is
 *     replaced on evidence, a "parish" tagged as a chapel becomes a chapel, and
 *     only a machine-written summary is regenerated;
 *   - the run: due rows come from one bounded SQL selection, are looked up 50
 *     per request, written enrich-only through the protection gate (replace
 *     only with evidence), excluded rows are unpublished (never deleted) with
 *     an audit trail and a one-year osm-skip, and every attempt is recorded in
 *     `_meta.addressResearch` so a row is not looked up again before it is due.
 * Network is mocked with real Nominatim answers (tests/fixtures).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/content-protection", () => ({
  applyProtectedContentUpdate: vi.fn(async () => ({ applied: true, kind: "enrich" })),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));

import type { PrismaClient } from "@prisma/client";

import { applyProtectedContentUpdate } from "@/lib/admin-worker/content-protection";
import { writeAdminWorkerLog } from "@/lib/admin-worker/logs";
import type { NominatimPlace } from "@/lib/admin-worker/nominatim-lookup";
import {
  planAddressResearch,
  runParishAddressResearch,
} from "@/lib/admin-worker/parish-address-research";

const mockedProtect = vi.mocked(applyProtectedContentUpdate);
const mockedLog = vi.mocked(writeAdminWorkerLog);

const SAMPLE = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/nominatim-lookup-sample.json"), "utf8"),
) as Array<Record<string, unknown>>;

const NOW = Date.UTC(2026, 9, 31, 13, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function placeFrom(raw: Record<string, unknown>): NominatimPlace {
  return {
    osmType: raw.osm_type as NominatimPlace["osmType"],
    osmId: Number(raw.osm_id),
    sourceRef: `osm:${String(raw.osm_type)}/${String(raw.osm_id)}`,
    category: String(raw.category ?? "amenity"),
    type: String(raw.type ?? "place_of_worship"),
    name: String(raw.name ?? ""),
    address: (raw.address ?? {}) as Record<string, string>,
    extratags: (raw.extratags ?? {}) as Record<string, string>,
  };
}

const sample = (osmType: string, osmId: number) =>
  SAMPLE.find((p) => p.osm_type === osmType && p.osm_id === osmId)!;

const ROME = sample("way", 124282254); // Via del Velabro, 00153 Roma
const CHAPEL = sample("way", 698048027); // building=chapel, Obersaxen-Mundaun (CH)

const OLD_SUMMARY = (name: string, where: string) =>
  `${name} is a Catholic parish${where ? ` in ${where}` : ""}, listed in OpenStreetMap as a Catholic place of worship (denomination "catholic").`;

describe("planAddressResearch", () => {
  it("fills a street-less row's street, locality, state, postal code and country", () => {
    const title = "Chiesa di Sant'Eligio dei Ferrari";
    const plan = planAddressResearch(
      { title },
      { title, designation: "parish", summary: OLD_SUMMARY(title, ""), addressKey: "rome" },
      placeFrom(ROME),
      NOW,
    );
    expect(plan.filled.sort()).toEqual(
      ["address", "city", "country", "countryCode", "postalCode", "state"].sort(),
    );
    expect(plan.proposed).toMatchObject({
      address: "Via del Velabro",
      city: "Roma",
      state: "Lazio",
      postalCode: "00153",
      countryCode: "IT",
      country: "Italy",
      // The stale city-only key is replaced by the real one.
      addressKey: "del velabro via 00153 lazio",
    });
    // The machine sentence learns its place.
    expect(plan.corrected).toEqual(["summary"]);
    expect(plan.proposed.summary).toBe(
      `${title} is a Catholic parish in Roma, Italy, listed in OpenStreetMap as a Catholic place of worship.`,
    );
    expect(plan.meta).toMatchObject({
      status: "complete",
      missing: [],
      precision: "street",
      sources: ["osm", "nominatim"],
      attempts: 1,
      lastAttemptAt: NOW,
    });
    expect((plan.proposed._meta as Record<string, unknown>).addressResearch).toEqual(plan.meta);
  });

  it("leaves a differing non-empty street and city alone", () => {
    const plan = planAddressResearch(
      { title: "S. Eligio" },
      {
        title: "S. Eligio",
        address: "Via Petroselli 3",
        city: "Rome",
        countryCode: "IT",
        country: "Italy",
      },
      placeFrom(ROME),
      NOW,
    );
    expect(plan.proposed.address).toBe("Via Petroselli 3");
    expect(plan.proposed.city).toBe("Rome");
    expect(plan.filled.sort()).toEqual(["postalCode", "state"]);
    expect(plan.corrected).toEqual([]);
  });

  it("replaces a tile-fallback country on the lookup's evidence and rewrites the machine summary", () => {
    const houston: NominatimPlace = {
      ...placeFrom(sample("node", 357617634)),
      address: {
        road: "Fannin Street",
        city: "Houston",
        state: "Texas",
        postcode: "77002",
        country_code: "us",
      },
    };
    const title = "Co-Cathedral of the Sacred Heart";
    const plan = planAddressResearch(
      { title },
      {
        title,
        designation: "parish",
        city: "Houston",
        countryCode: "MX",
        country: "Mexico",
        summary: OLD_SUMMARY(title, "Houston, Mexico"),
      },
      houston,
      NOW,
    );
    expect(plan.countryCorrection).toEqual({ from: "MX", to: "US" });
    expect(plan.corrected).toEqual(expect.arrayContaining(["countryCode", "country", "summary"]));
    expect(plan.proposed).toMatchObject({
      countryCode: "US",
      country: "United States",
      address: "Fannin Street",
      postalCode: "77002",
      state: "Texas",
    });
    expect(plan.proposed.summary).toBe(
      `${title} is a Catholic parish in Houston, United States, listed in OpenStreetMap as a Catholic place of worship.`,
    );
    expect(plan.meta.countryCorrectedFrom).toBe("MX");
  });

  it("re-designates a 'parish' that OSM tags as a chapel", () => {
    const title = "Kapelle St. Georg";
    const plan = planAddressResearch(
      { title },
      { title, designation: "parish", summary: OLD_SUMMARY(title, "") },
      placeFrom(CHAPEL),
      NOW,
    );
    expect(plan.proposed.designation).toBe("chapel");
    expect(plan.corrected).toContain("designation");
    expect(plan.proposed.summary).toBe(
      `${title} is a Catholic chapel in Obersaxen-Mundaun, Switzerland, listed in OpenStreetMap as a Catholic place of worship.`,
    );
  });

  it("never touches a summary a person wrote, nor a designation other than parish", () => {
    const title = "Kapelle St. Georg";
    const plan = planAddressResearch(
      { title },
      { title, designation: "shrine", summary: "A pilgrimage chapel above the Rhine valley." },
      placeFrom(CHAPEL),
      NOW,
    );
    expect(plan.proposed.summary).toBe("A pilgrimage chapel above the Rhine valley.");
    expect(plan.proposed.designation).toBe("shrine");
    expect(plan.corrected).toEqual([]);
  });

  it("is partial (retry in 7 days) when the answer has no postal code", () => {
    const ie = placeFrom(sample("way", 97157991)); // IE: no postcode, county as municipality
    const plan = planAddressResearch(
      { title: "Saint Colman's" },
      { title: "Saint Colman's" },
      ie,
      NOW,
    );
    expect(plan.meta.status).toBe("partial");
    expect(plan.meta.missing).toEqual(["city", "postalCode"]);
    expect(plan.meta.nextDueAt).toBe(NOW + 7 * DAY);
    expect(plan.proposed.city).toBeUndefined();
  });
});

// ── The run ─────────────────────────────────────────────────────────────────

type Row = { id: string; slug: string; title: string; sourceRef: string | null; payload: unknown };

function makePrisma(rows: Row[]) {
  const store = new Map<string, { memoryValue: unknown; lastUsedAt: Date }>();
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  /** What another lane wrote after selection (id → payload), and rows unpublished meanwhile. */
  const fresh = new Map<string, unknown>();
  const gone = new Set<string>();
  const queryRaw = vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => rows);
  const prisma = {
    $queryRaw: queryRaw,
    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
          const v = store.get(where.memoryType_memoryKey.memoryKey);
          return v ? { memoryValue: v.memoryValue, lastUsedAt: v.lastUsedAt } : null;
        },
      ),
      upsert: vi.fn(
        async ({
          where,
          update,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          update: { memoryValue?: unknown; lastUsedAt?: Date };
        }) => {
          const key = where.memoryType_memoryKey.memoryKey;
          store.set(key, {
            memoryValue: update.memoryValue ?? store.get(key)?.memoryValue ?? {},
            lastUsedAt: update.lastUsedAt ?? new Date(),
          });
          return {};
        },
      ),
    },
    publishedContent: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        return row
          ? { payload: fresh.get(where.id) ?? row.payload, isPublished: !gone.has(where.id) }
          : null;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push({ id: where.id, data });
          return {};
        },
      ),
    },
  } as unknown as PrismaClient;
  return { prisma, store, updates, queryRaw, fresh, gone };
}

/** Answers with the given raw places when their ids are asked for. */
function nominatim(places: Array<Record<string, unknown>>) {
  return vi.fn(async (url: string) => {
    const ids = new URL(url).searchParams.get("osm_ids")!.split(",");
    return {
      ok: true,
      status: 200,
      json: async () =>
        places.filter((p) =>
          ids.includes(`${String(p.osm_type)[0]!.toUpperCase()}${String(p.osm_id)}`),
        ),
    };
  });
}

const KEYS = [
  "ADMIN_WORKER_SKIP_NETWORK",
  "ADMIN_WORKER_NOMINATIM_SPACING_MS",
  "ADMIN_WORKER_NOMINATIM_DAILY_BUDGET",
];
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.ADMIN_WORKER_NOMINATIM_SPACING_MS = "0";
  mockedProtect.mockClear();
  mockedProtect.mockResolvedValue({ applied: true, kind: "enrich" } as never);
  mockedLog.mockClear();
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const romeRow: Row = {
  id: "r1",
  slug: "chiesa-di-sant-eligio-dei-ferrari",
  title: "Chiesa di Sant'Eligio dei Ferrari",
  sourceRef: "osm:way/124282254",
  payload: {
    slug: "chiesa-di-sant-eligio-dei-ferrari",
    title: "Chiesa di Sant'Eligio dei Ferrari",
    city: "Rome",
    addressKey: "rome",
    latitude: 41.8899,
    longitude: 12.4824,
    citations: ["https://www.openstreetmap.org/way/124282254"],
  },
};

describe("runParishAddressResearch", () => {
  it("is idle under skip-network", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const { prisma, queryRaw } = makePrisma([romeRow]);
    const out = await runParishAddressResearch(prisma, { force: true });
    expect(out.ran).toBe(false);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("selects due OSM parishes missing an address field, never-researched first", async () => {
    const { prisma, queryRaw } = makePrisma([]);
    await runParishAddressResearch(prisma, {
      force: true,
      now: () => NOW,
      fetchImpl: nominatim([]) as never,
    });
    const sql = (queryRaw.mock.calls[0]![0] as TemplateStringsArray).join("?");
    expect(sql).toContain(`"isPublished" = true`);
    expect(sql).toContain(`"sourceRef" LIKE 'osm:%'`);
    for (const field of ["address", "city", "postalCode", "countryCode"]) {
      expect(sql).toContain(`'${field}'`);
    }
    expect(sql).toContain("nextDueAt");
    expect(sql).toMatch(/ORDER BY \("payload"->'_meta'->'addressResearch'\) IS NULL DESC/);
    // ≤ 10 requests × 50 ids.
    expect(queryRaw.mock.calls[0]).toContain(500);
    expect(queryRaw.mock.calls[0]).toContain(NOW);
  });

  it("fills blanks enrich-only and records the research state", async () => {
    const { prisma } = makePrisma([romeRow]);
    const fetchImpl = nominatim([ROME]);

    const out = await runParishAddressResearch(prisma, {
      force: true,
      now: () => NOW,
      fetchImpl: fetchImpl as never,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ scanned: 1, requests: 1, completed: 1, countryCorrected: 0 });
    expect(mockedProtect).toHaveBeenCalledTimes(1);
    const input = mockedProtect.mock.calls[0]![1];
    expect(input.contentId).toBe("r1");
    // A street fill is an enrichment: the differing city "Rome" is kept as is.
    expect(input.proposedPayload).toMatchObject({
      address: "Via del Velabro",
      city: "Rome",
      postalCode: "00153",
      addressKey: "del velabro via 00153 lazio",
    });
    expect(input.allowReplace).toBe(false);
    expect(input.evidenceCount).toBe(1);
    expect(input.reason).toContain("W124282254");
    // One INFO log per run with the counts.
    const info = mockedLog.mock.calls.find((c) => c[1].eventName === "parish_address_research")!;
    expect(info[1].severity).toBe("INFO");
    expect(info[1].safeMetadata).toMatchObject({
      scanned: 1,
      completed: 1,
      partial: 0,
      needsResearch: 0,
      countryCorrected: 0,
      excluded: 0,
      requests: 1,
    });
  });

  it("replaces a disagreeing country with allowReplace and logs one WARN sample", async () => {
    const houston = {
      osm_type: "node",
      osm_id: 4242,
      category: "amenity",
      type: "place_of_worship",
      name: "Co-Cathedral of the Sacred Heart",
      address: {
        road: "Fannin Street",
        city: "Houston",
        state: "Texas",
        postcode: "77002",
        country_code: "us",
      },
      extratags: {},
    };
    const { prisma } = makePrisma([
      {
        id: "h1",
        slug: "co-cathedral-of-the-sacred-heart-houston",
        title: "Co-Cathedral of the Sacred Heart",
        sourceRef: "osm:node/4242",
        payload: {
          slug: "co-cathedral-of-the-sacred-heart-houston",
          title: "Co-Cathedral of the Sacred Heart",
          city: "Houston",
          countryCode: "MX",
          country: "Mexico",
          latitude: 29.7487,
          longitude: -95.3693,
          citations: ["https://www.openstreetmap.org/node/4242"],
        },
      },
    ]);

    const out = await runParishAddressResearch(prisma, {
      force: true,
      now: () => NOW,
      fetchImpl: nominatim([houston]) as never,
    });

    expect(out.countryCorrected).toBe(1);
    const input = mockedProtect.mock.calls[0]![1];
    expect(input.allowReplace).toBe(true);
    expect(input.qualityScore).toBeGreaterThanOrEqual(0.8);
    expect(input.proposedPayload).toMatchObject({ countryCode: "US", country: "United States" });
    const warn = mockedLog.mock.calls.filter((c) => c[1].severity === "WARN");
    expect(warn).toHaveLength(1);
    expect(warn[0]![1].eventName).toBe("parish_country_corrected");
    expect(warn[0]![1].safeMetadata).toMatchObject({
      corrected: 1,
      samples: [
        { slug: "co-cathedral-of-the-sacred-heart-houston", from: "MX", to: "US", osm: "N4242" },
      ],
    });
  });

  it("marks an object Nominatim no longer returns as needing research (meta only)", async () => {
    const { prisma, updates } = makePrisma([romeRow]);

    const out = await runParishAddressResearch(prisma, {
      force: true,
      now: () => NOW,
      fetchImpl: nominatim([]) as never,
    });

    expect(out.needsResearch).toBe(1);
    expect(mockedProtect).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
    const payload = updates[0]!.data.payload as {
      _meta: { addressResearch: Record<string, unknown> };
      addressKey?: string;
    };
    expect(payload._meta.addressResearch).toMatchObject({
      status: "needs_research",
      attempts: 1,
      nextDueAt: NOW + 90 * DAY,
    });
    // The stale city-only key goes with it; the freshness marker is restamped.
    expect(payload.addressKey).toBeUndefined();
    expect(updates[0]!.data.addressKey).toBeNull();
    expect(updates[0]!.data.contentChecksum).toEqual(expect.any(String));
  });

  it("unpublishes — never deletes — a wayside shrine, with the reason and a one-year skip", async () => {
    const shrine = {
      osm_type: "node",
      osm_id: 9001,
      category: "historic",
      type: "wayside_shrine",
      name: "Bildstock",
      address: { road: "Feldweg", village: "Irgendwo", postcode: "56727", country_code: "de" },
      extratags: { denomination: "roman_catholic" },
    };
    const { prisma, updates, store } = makePrisma([
      {
        id: "s1",
        slug: "bildstock-irgendwo",
        title: "Bildstock",
        sourceRef: "osm:node/9001",
        payload: { title: "Bildstock" },
      },
    ]);

    const out = await runParishAddressResearch(prisma, {
      force: true,
      now: () => NOW,
      fetchImpl: nominatim([shrine]) as never,
    });

    expect(out.excluded).toBe(1);
    expect(mockedProtect).not.toHaveBeenCalled();
    expect(updates[0]!.data).toMatchObject({ isPublished: false });
    expect((updates[0]!.data.payload as { _meta: { excluded: unknown } })._meta.excluded).toEqual({
      reason: "wayside-shrine",
      evidence: "historic=wayside_shrine (OSM N9001, Nominatim lookup)",
      at: NOW,
    });
    const skip = store.get("osm-skip:osm:node/9001")!.memoryValue as {
      retryAfter: number;
      reason: string;
    };
    expect(skip.retryAfter).toBeGreaterThan(Date.now() + 360 * DAY);
    expect(skip.reason).toBe("excluded: wayside-shrine");
  });

  it("excludes a numbered Station of the Cross by name even without an answer", async () => {
    const { prisma, updates } = makePrisma([
      {
        id: "st2",
        slug: "2e-statie-hoofddorp",
        title: "2e Statie",
        sourceRef: "osm:node/77",
        payload: {},
      },
    ]);
    const out = await runParishAddressResearch(prisma, {
      force: true,
      now: () => NOW,
      fetchImpl: nominatim([]) as never,
    });
    expect(out.excluded).toBe(1);
    expect(updates[0]!.data.isPublished).toBe(false);
  });

  it("asks nothing and writes nothing when the daily budget is spent", async () => {
    process.env.ADMIN_WORKER_NOMINATIM_DAILY_BUDGET = "1";
    const { prisma, store, updates } = makePrisma([romeRow]);
    const today = new Date().toISOString().slice(0, 10);
    store.set(`nominatim-lookup:${today}`, { memoryValue: { used: 1 }, lastUsedAt: new Date() });
    const fetchImpl = nominatim([ROME]);

    const out = await runParishAddressResearch(prisma, {
      force: true,
      now: () => NOW,
      fetchImpl: fetchImpl as never,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(out.requests).toBe(0);
    expect(updates).toHaveLength(0);
    expect(mockedProtect).not.toHaveBeenCalled();
    expect(out.detail).toContain("budget");
  });

  it("records the attempt — and nothing else — when the payload would not validate", async () => {
    const { prisma, updates } = makePrisma([
      { ...romeRow, payload: { title: "No slug, no citation" } },
    ]);
    await runParishAddressResearch(prisma, {
      force: true,
      now: () => NOW,
      fetchImpl: nominatim([ROME]) as never,
    });
    expect(mockedProtect).not.toHaveBeenCalled();
    const payload = updates[0]!.data.payload as Record<string, unknown>;
    expect(payload.address).toBeUndefined();
    expect(
      (payload._meta as { addressResearch: { attempts: number } }).addressResearch.attempts,
    ).toBe(1);
  });

  it("records the attempt when the gate refuses the update", async () => {
    mockedProtect.mockResolvedValueOnce({
      applied: false,
      kind: "replace",
      blocked: true,
    } as never);
    const { prisma, updates } = makePrisma([romeRow]);
    await runParishAddressResearch(prisma, {
      force: true,
      now: () => NOW,
      fetchImpl: nominatim([ROME]) as never,
    });
    expect(updates).toHaveLength(1);
    const meta = (updates[0]!.data.payload as { _meta: { addressResearch: { attempts: number } } })
      ._meta.addressResearch;
    expect(meta.attempts).toBe(1);
  });

  it("plans from the row as it is now, so another lane's fill is never undone", async () => {
    const { prisma, fresh } = makePrisma([romeRow]);
    fresh.set("r1", { ...(romeRow.payload as Record<string, unknown>), phone: "+39 06 0000 0000" });
    await runParishAddressResearch(prisma, {
      force: true,
      now: () => NOW,
      fetchImpl: nominatim([ROME]) as never,
    });
    expect(mockedProtect.mock.calls[0]![1].proposedPayload.phone).toBe("+39 06 0000 0000");
  });

  it("skips a row unpublished since it was selected", async () => {
    const { prisma, updates, gone } = makePrisma([romeRow]);
    gone.add("r1");
    await runParishAddressResearch(prisma, {
      force: true,
      now: () => NOW,
      fetchImpl: nominatim([ROME]) as never,
    });
    expect(mockedProtect).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("self-throttles between runs", async () => {
    const { prisma } = makePrisma([]);
    const fetchImpl = nominatim([]);
    const first = await runParishAddressResearch(prisma, {
      now: () => NOW,
      fetchImpl: fetchImpl as never,
    });
    const second = await runParishAddressResearch(prisma, {
      now: () => NOW + 1000,
      fetchImpl: fetchImpl as never,
    });
    expect(first.ran).toBe(true);
    expect(second.ran).toBe(false);
    expect(second.detail).toBe("throttled");
  });
});
