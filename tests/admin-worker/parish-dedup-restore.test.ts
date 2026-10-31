/**
 * Undoing the old city-only address key. Pins:
 *   - only a row with NO recorded unpublish reason is a restore candidate
 *     (not-in-communion verdict, rollback ledger, human review, admin
 *     rejection, osm-skip, a deletion log, or this change's own markers all
 *     keep it down);
 *   - a candidate that is not a parish (a numbered Station of the Cross)
 *     stays unpublished with `_meta.excluded` and a one-year osm-skip;
 *   - a candidate is re-checked under the new rule: a true duplicate stays
 *     unpublished with `_meta.dedup`, anything else is republished through the
 *     orchestrator with `_meta.restored`;
 *   - the walk is cursor-based, capped, idempotent, fail-closed, and done once;
 *   - the one-time early re-sweep makes every non-empty tile swept before the
 *     fix due now and wakes a parked sweep.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));
vi.mock(import("@/lib/admin-worker/content-goals"), async (importOriginal) => ({
  ...(await importOriginal()),
  refreshContentGoals: vi.fn(async () => ({}) as never),
}));
vi.mock("@/lib/admin-worker/repair", () => ({
  flagSearchRefresh: vi.fn(async () => ({})),
  flagSitemapRefresh: vi.fn(async () => ({})),
  flagCacheRefresh: vi.fn(async () => ({})),
}));

import type { PrismaClient } from "@prisma/client";

import { refreshContentGoals } from "@/lib/admin-worker/content-goals";
import {
  recordedUnpublishReason,
  runParishDedupRestore,
  scheduleOsmResweepAfterKeyFix,
  type RecordedSignals,
} from "@/lib/admin-worker/parish-dedup-restore";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";

const mockedPublish = vi.mocked(runPublishOrchestrator);
const NOW = Date.UTC(2026, 9, 31, 13);
const UNPUBLISHED_AT = new Date(Date.UTC(2026, 8, 8, 3));

type Row = Record<string, unknown>;

function victim(id: string, over: Row = {}): Row {
  return {
    id,
    checklistItemId: `ci-${id}`,
    slug: `parrocchia-${id}-roma`,
    title: `Parrocchia ${id}`,
    sourceRef: `osm:way/${id.replace(/\D/g, "") || 1}`,
    authorityLevel: "COMMUNITY",
    latitude: 41.89,
    longitude: 12.48,
    unpublishedAt: UNPUBLISHED_AT,
    payload: {
      slug: `parrocchia-${id}-roma`,
      title: `Parrocchia ${id}`,
      city: "Rome",
      addressKey: "rome",
      latitude: 41.89,
      longitude: 12.48,
      citations: [`https://www.openstreetmap.org/way/${id}`],
    },
    ...over,
  };
}

function makePrisma(opts: {
  unpublished?: Row[];
  published?: Row[];
  ledger?: string[];
  reviews?: string[];
  rejectedItems?: string[];
  logs?: string[];
  failSignals?: boolean;
  tiles?: Record<string, Row>;
}) {
  const store = new Map<string, { memoryValue: unknown; lastUsedAt: Date }>();
  for (const [k, v] of Object.entries(opts.tiles ?? {}))
    store.set(k, { memoryValue: v, lastUsedAt: new Date() });
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const unpublished = opts.unpublished ?? [];
  const published = opts.published ?? [];
  const prisma = {
    publishedContent: {
      findMany: vi.fn(
        async ({ where, take }: { where: Record<string, unknown>; take?: number }) => {
          if (where.isPublished === false) {
            const gt = (where.id as { gt?: string } | undefined)?.gt;
            return unpublished.filter((r) => !gt || String(r.id) > gt).slice(0, take);
          }
          if (where.addressKey !== undefined)
            return published.filter((r) => r.addressKey === where.addressKey);
          const lat = where.latitude as { gte: number; lte: number };
          const lon = where.longitude as { gte: number; lte: number };
          return published.filter(
            (r) =>
              Number(r.latitude) >= lat.gte &&
              Number(r.latitude) <= lat.lte &&
              Number(r.longitude) >= lon.gte &&
              Number(r.longitude) <= lon.lte,
          );
        },
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push({ id: where.id, data });
          return {};
        },
      ),
    },
    adminWorkerRollbackLedger: {
      findMany: vi.fn(async () => {
        if (opts.failSignals) throw new Error("db down");
        return (opts.ledger ?? []).map((contentId) => ({ contentId }));
      }),
    },
    humanReviewQueue: {
      findMany: vi.fn(async () => (opts.reviews ?? []).map((contentTitle) => ({ contentTitle }))),
    },
    checklistItem: {
      findMany: vi.fn(async () =>
        (opts.rejectedItems ?? []).map((id) => ({
          id,
          rejectedReason: "Unpublished by admin.",
          rejectedAt: null,
          rejectedByUsername: null,
        })),
      ),
    },
    adminWorkerLog: {
      findMany: vi.fn(async () =>
        (opts.logs ?? []).map((relatedEntityId) => ({ relatedEntityId })),
      ),
    },
    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
          const v = store.get(where.memoryType_memoryKey.memoryKey);
          return v ? { memoryValue: v.memoryValue, lastUsedAt: v.lastUsedAt } : null;
        },
      ),
      findMany: vi.fn(
        async ({
          where,
          take,
        }: {
          where: { memoryKey: { in?: string[]; startsWith?: string; gt?: string } };
          take?: number;
        }) => {
          const f = where.memoryKey;
          const keys = [...store.keys()]
            .filter((k) =>
              f.in ? f.in.includes(k) : k.startsWith(f.startsWith ?? "") && (!f.gt || k > f.gt),
            )
            .sort();
          return keys
            .slice(0, take ?? keys.length)
            .map((k) => ({ memoryKey: k, memoryValue: store.get(k)!.memoryValue }));
        },
      ),
      upsert: vi.fn(
        async ({
          where,
          update,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          update: { memoryValue: unknown };
        }) => {
          store.set(where.memoryType_memoryKey.memoryKey, {
            memoryValue: update.memoryValue,
            lastUsedAt: new Date(),
          });
          return {};
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          data: { memoryValue: unknown };
        }) => {
          store.set(where.memoryType_memoryKey.memoryKey, {
            memoryValue: data.memoryValue,
            lastUsedAt: new Date(),
          });
          return {};
        },
      ),
    },
  } as unknown as PrismaClient;
  return { prisma, store, updates };
}

beforeEach(() => {
  mockedPublish.mockReset();
  mockedPublish.mockResolvedValue({ kind: "published" } as never);
  vi.mocked(refreshContentGoals).mockClear();
});

describe("recordedUnpublishReason", () => {
  const none: RecordedSignals = {
    ledger: new Set(),
    reviews: new Set(),
    rejectedItems: new Set(),
    skips: new Set(),
    logged: new Set(),
  };
  const row = victim("v1") as Parameters<typeof recordedUnpublishReason>[0];

  it("finds no reason for a row the old maintenance unpublished silently", () => {
    expect(recordedUnpublishReason(row, none)).toBeNull();
  });

  it("names every recorded reason that keeps a row down", () => {
    const meta = (m: Row) => ({ ...row, payload: { ...(row.payload as Row), _meta: m } });
    expect(
      recordedUnpublishReason(meta({ websiteVerification: { status: "not-in-communion" } }), none),
    ).toBe("not-in-communion");
    expect(recordedUnpublishReason(meta({ dedup: { keeperId: "k" } }), none)).toBe(
      "already-handled",
    );
    expect(recordedUnpublishReason(meta({ excluded: { reason: "cross" } }), none)).toBe(
      "already-handled",
    );
    expect(recordedUnpublishReason(meta({ restored: { at: 1 } }), none)).toBe("already-handled");
    expect(recordedUnpublishReason(row, { ...none, ledger: new Set(["v1"]) })).toBe(
      "rollback-ledger",
    );
    expect(recordedUnpublishReason(row, { ...none, reviews: new Set([String(row.slug)]) })).toBe(
      "human-review",
    );
    expect(recordedUnpublishReason(row, { ...none, rejectedItems: new Set(["ci-v1"]) })).toBe(
      "checklist-rejected",
    );
    expect(recordedUnpublishReason(row, { ...none, skips: new Set([String(row.sourceRef)]) })).toBe(
      "osm-skip",
    );
    expect(recordedUnpublishReason(row, { ...none, logged: new Set(["v1"]) })).toBe(
      "logged-unpublish",
    );
    expect(recordedUnpublishReason({ ...row, unpublishedAt: null }, none)).toBe(
      "no-unpublish-time",
    );
  });
});

describe("runParishDedupRestore", () => {
  it("republishes a silently unpublished street-less parish through the orchestrator", async () => {
    // The Rome case: keyed "rome" like the published keeper, 3 km away.
    const { prisma } = makePrisma({
      unpublished: [victim("v1")],
      published: [
        {
          id: "k1",
          slug: "san-pietro",
          title: "San Pietro",
          addressKey: "rome",
          latitude: 41.9022,
          longitude: 12.4539,
        },
      ],
    });

    const out = await runParishDedupRestore(prisma, { now: () => NOW });

    expect(out).toMatchObject({ examined: 1, restored: 1, deduped: 0, skipped: 0, done: true });
    expect(out.restoredSlugs).toEqual(["parrocchia-v1-roma"]);
    expect(mockedPublish).toHaveBeenCalledTimes(1);
    const input = mockedPublish.mock.calls[0]![1];
    expect(input).toMatchObject({
      contentType: "PARISH",
      contentId: "ci-v1",
      slug: "parrocchia-v1-roma",
      title: "Parrocchia v1",
      authorityLevel: "COMMUNITY",
      skipBrainScreens: true,
      skipPostPublishSideEffects: true,
    });
    const payload = input.payload as Record<string, unknown>;
    // The stale city-only key is gone; the row says why it came back.
    expect(payload.addressKey).toBeUndefined();
    expect((payload._meta as { restored: { at: number; reason: string } }).restored).toEqual({
      at: NOW,
      reason: expect.stringContaining("city-only address key"),
    });
    // Side effects once per run.
    expect(refreshContentGoals).toHaveBeenCalledTimes(1);
  });

  it("keeps a true duplicate down and records which row it duplicates", async () => {
    const key = "9 del velabro via 00153 lazio";
    const dup = victim("v2", {
      payload: {
        slug: "parrocchia-v2-roma",
        title: "Parrocchia v2",
        address: "Via del Velabro 9",
        postalCode: "00153",
        state: "Lazio",
        city: "Roma",
        citations: ["https://www.openstreetmap.org/way/2"],
      },
    });
    const { prisma, updates } = makePrisma({
      unpublished: [dup],
      published: [
        {
          id: "k2",
          slug: "sant-eligio",
          title: "Sant'Eligio",
          addressKey: key,
          latitude: 41.8901,
          longitude: 12.4801,
        },
      ],
    });

    const out = await runParishDedupRestore(prisma, { now: () => NOW });

    expect(out).toMatchObject({ restored: 0, deduped: 1 });
    expect(mockedPublish).not.toHaveBeenCalled();
    expect(updates[0]!.data.isPublished).toBeUndefined();
    const meta = (updates[0]!.data.payload as { _meta: { dedup: Row } })._meta.dedup;
    expect(meta).toMatchObject({
      keeperId: "k2",
      keeperSlug: "sant-eligio",
      key,
      rule: "address-key+within-250m",
      at: NOW,
    });
    expect(out.dedupPairs).toEqual([
      {
        victimId: "v2",
        victimSlug: "parrocchia-v2-roma",
        keeperId: "k2",
        keeperSlug: "sant-eligio",
        rule: "address-key+within-250m",
      },
    ]);
  });

  it("restores a different church on the same street when the street has no house number", async () => {
    const key = "corso del via 00186 lazio";
    const lata = victim("v4", {
      title: "Santa Maria in Via Lata",
      latitude: 41.8972,
      longitude: 12.4822,
      payload: {
        slug: "parrocchia-v4-roma",
        title: "Santa Maria in Via Lata",
        address: "Via del Corso",
        postalCode: "00186",
        state: "Lazio",
        city: "Roma",
        latitude: 41.8972,
        longitude: 12.4822,
        citations: ["https://www.openstreetmap.org/way/4"],
      },
    });
    const { prisma } = makePrisma({
      unpublished: [lata],
      published: [
        {
          id: "k4",
          slug: "san-marcello-al-corso",
          title: "San Marcello al Corso",
          addressKey: key,
          latitude: 41.899,
          longitude: 12.4822,
        },
      ],
    });

    const out = await runParishDedupRestore(prisma, { now: () => NOW });

    expect(out).toMatchObject({ restored: 1, deduped: 0 });
    expect((mockedPublish.mock.calls[0]![1].payload as Row).addressKey).toBe(key);
  });

  it("keeps a numbered Station of the Cross down as excluded instead of restoring it", async () => {
    // Heiloo's stations were street-less and clustered, so the city-only key
    // took them down; their distinct names would pass the new duplicate rule.
    const stations = ["Statie I", "Statie II"].map((title, i) =>
      victim(`s${i + 1}`, {
        title,
        sourceRef: `osm:node/90${i + 1}`,
        latitude: 52.6 + i / 10_000,
        longitude: 4.7,
        payload: {
          slug: `statie-${i + 1}-heiloo`,
          title,
          city: "Heiloo",
          addressKey: "heiloo",
          latitude: 52.6 + i / 10_000,
          longitude: 4.7,
          citations: [`https://www.openstreetmap.org/node/90${i + 1}`],
        },
      }),
    );
    const { prisma, store, updates } = makePrisma({ unpublished: [...stations, victim("v9")] });

    const out = await runParishDedupRestore(prisma, { now: () => NOW });

    expect(out).toMatchObject({ examined: 3, excluded: 2, restored: 1, deduped: 0 });
    expect(out.excludedSlugs).toEqual(["parrocchia-s1-roma", "parrocchia-s2-roma"]);
    // Only the parish comes back.
    expect(mockedPublish).toHaveBeenCalledTimes(1);
    expect(mockedPublish.mock.calls[0]![1].slug).toBe("parrocchia-v9-roma");
    for (const id of ["s1", "s2"]) {
      const update = updates.find((u) => u.id === id)!;
      expect(update.data.isPublished).toBeUndefined();
      expect(update.data.addressKey).toBeNull(); // the stale city-only key goes
      const payload = update.data.payload as { _meta: { excluded: Row }; addressKey?: string };
      expect(payload._meta.excluded).toEqual({
        reason: "stations-of-the-cross",
        evidence: expect.stringContaining("Statie I"),
        at: NOW,
      });
      expect(payload.addressKey).toBeUndefined();
    }
    // Discovery stays away for a year.
    const skip = store.get("osm-skip:osm:node/901")!.memoryValue as {
      retryAfter: number;
      reason: string;
    };
    expect(skip.reason).toBe("excluded: stations-of-the-cross");
    expect(skip.retryAfter).toBeGreaterThan(Date.now() + 360 * 24 * 60 * 60 * 1000);
    const state = store.get("parish-dedup-restore-v1")!.memoryValue as { totals: Row };
    expect(state.totals).toMatchObject({ excluded: 2, restored: 1 });
  });

  it("keeps the same church mapped twice (same name within 250 m) down too", async () => {
    const { prisma } = makePrisma({
      unpublished: [victim("v3", { title: "Parrocchia di San Lino" })],
      published: [
        { id: "k3", slug: "san-lino", title: "San Lino", latitude: 41.8905, longitude: 12.4801 },
      ],
    });
    const out = await runParishDedupRestore(prisma, { now: () => NOW });
    expect(out.deduped).toBe(1);
    expect(out.dedupPairs[0]!.rule).toBe("same-name-within-250m");
  });

  it("leaves every row with a recorded unpublish reason alone", async () => {
    const rows = ["a1", "a2", "a3", "a4", "a5", "a6"].map((id) => victim(id));
    (rows[0]!.payload as Row)._meta = { websiteVerification: { status: "not-in-communion" } };
    const { prisma, store } = makePrisma({
      unpublished: rows,
      ledger: ["a2"],
      reviews: ["parrocchia-a3-roma"],
      rejectedItems: ["ci-a4"],
      logs: ["a5"],
    });
    store.set("osm-skip:parrocchia-a6-roma", {
      memoryValue: { retryAfter: Date.now() + 1e9, reason: "not in communion" },
      lastUsedAt: new Date(),
    });

    const out = await runParishDedupRestore(prisma, { now: () => NOW });

    expect(out).toMatchObject({ examined: 6, skipped: 6, restored: 0, deduped: 0 });
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it("walks with a capped, persisted cursor and finishes exactly once", async () => {
    const { prisma, store } = makePrisma({
      unpublished: [victim("b1"), victim("b2"), victim("b3")],
    });

    const first = await runParishDedupRestore(prisma, { now: () => NOW, batch: 2 });
    expect(first).toMatchObject({ examined: 2, done: false });
    expect((store.get("parish-dedup-restore-v1")!.memoryValue as Row).cursorId).toBe("b2");

    const second = await runParishDedupRestore(prisma, { now: () => NOW, batch: 2 });
    expect(second).toMatchObject({ examined: 1, done: true });
    const state = store.get("parish-dedup-restore-v1")!.memoryValue as {
      totals: Row;
      done: boolean;
    };
    expect(state.done).toBe(true);
    expect(state.totals).toMatchObject({ examined: 3, restored: 3 });

    const findMany = vi.mocked(prisma.publishedContent.findMany);
    const calls = findMany.mock.calls.length;
    const third = await runParishDedupRestore(prisma, { now: () => NOW, batch: 2 });
    expect(third).toMatchObject({ done: true, examined: 0 });
    expect(findMany.mock.calls.length).toBe(calls); // idempotent: no further reads
  });

  it("fails closed when a recorded reason cannot be read", async () => {
    const { prisma, store } = makePrisma({ unpublished: [victim("c1")], failSignals: true });
    const out = await runParishDedupRestore(prisma, { now: () => NOW });
    expect(out.ran).toBe(false);
    expect(out.restored).toBe(0);
    expect(mockedPublish).not.toHaveBeenCalled();
    expect(store.has("parish-dedup-restore-v1")).toBe(false);
  });

  it("counts a republish the gate refuses as blocked", async () => {
    mockedPublish.mockResolvedValue({ kind: "blocked", blockedBy: "gate", reason: "x" } as never);
    const { prisma } = makePrisma({ unpublished: [victim("d1")] });
    const out = await runParishDedupRestore(prisma, { now: () => NOW });
    expect(out).toMatchObject({ restored: 0, blocked: 1 });
    expect(refreshContentGoals).not.toHaveBeenCalled();
  });
});

describe("scheduleOsmResweepAfterKeyFix", () => {
  const FIX = NOW;
  const swept = (over: Row = {}) => ({
    status: "SWEPT",
    elementCount: 120,
    lastSweptAt: FIX - 30 * 86_400_000,
    nextDueAt: FIX + 60 * 86_400_000,
    ...over,
  });

  it("makes every non-empty tile swept before the fix due now, and wakes the sweep", async () => {
    const { prisma, store } = makePrisma({
      tiles: {
        "osm-tile:m:rome": swept(),
        "osm-tile:t:1:45:9": swept({ elementCount: 0 }), // empty: dropped nothing
        "osm-tile:t:1:46:9": swept({ lastSweptAt: FIX + 1000 }), // swept under the new rule
        "osm-tile:t:1:47:9": swept({ status: "FAILED" }),
        "osm-tile:t:1:48:9": swept({ nextDueAt: FIX - 1 }), // already due
        "osm-tile:t:2:30:-96": swept(),
        "osm-tile-cursor": { pos: 812, size: 3000, idleUntil: FIX + 86_400_000, dryScanned: 3000 },
      },
    });

    const out = await scheduleOsmResweepAfterKeyFix(prisma, { now: FIX });

    expect(out).toEqual({ done: true, scheduled: 2 });
    expect((store.get("osm-tile:m:rome")!.memoryValue as Row).nextDueAt).toBe(FIX);
    expect((store.get("osm-tile:t:2:30:-96")!.memoryValue as Row).nextDueAt).toBe(FIX);
    expect((store.get("osm-tile:t:1:45:9")!.memoryValue as Row).nextDueAt).toBe(
      FIX + 60 * 86_400_000,
    );
    expect((store.get("osm-tile:t:1:46:9")!.memoryValue as Row).nextDueAt).toBe(
      FIX + 60 * 86_400_000,
    );
    // The parked cursor wakes up; its position is kept.
    expect(store.get("osm-tile-cursor")!.memoryValue).toMatchObject({
      pos: 812,
      idleUntil: null,
      dryScanned: 0,
    });
    // Done once.
    expect(await scheduleOsmResweepAfterKeyFix(prisma, { now: FIX + 5000 })).toEqual({
      done: true,
      scheduled: 0,
    });
  });

  it("works through the tiles in bounded batches with the first call's fix time", async () => {
    const { prisma, store } = makePrisma({
      tiles: {
        "osm-tile:a": swept(),
        "osm-tile:b": swept(),
        "osm-tile:c": swept({ lastSweptAt: FIX + 10 }), // after the first call's fix time
      },
    });
    expect(await scheduleOsmResweepAfterKeyFix(prisma, { now: FIX, batch: 2 })).toEqual({
      done: false,
      scheduled: 2,
    });
    expect((store.get("osm-resweep-after-addresskey-fix-v1")!.memoryValue as Row).afterKey).toBe(
      "osm-tile:b",
    );
    expect(await scheduleOsmResweepAfterKeyFix(prisma, { now: FIX + 100, batch: 2 })).toEqual({
      done: true,
      scheduled: 0,
    });
  });
});
