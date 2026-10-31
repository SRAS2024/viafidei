/**
 * Parish directory upkeep: the continuous address-dedup maintenance and the
 * end-of-month refresh sweep. Pins the window gating, the finish-early behavior,
 * the "email only when something changed" report, the escalate-when-stuck path,
 * and the address de-duplication.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/admin-worker/communion-verifier", () => ({
  inspectParishWebsite: vi.fn(async () => ({ verdict: { status: "unknown" }, details: {} })),
}));
vi.mock("@/lib/email/admin-send", () => ({
  sendAdminWorkerParishRefreshReport: vi.fn(async () => ({ ok: true, delivery: "sent" })),
  sendCriticalFailureAlert: vi.fn(async () => ({ ok: true, delivery: "sent" })),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import {
  isMonthEndWindow,
  runParishMonthlyRefresh,
  runParishAddressMaintenance,
} from "@/lib/admin-worker/parish-refresh";
import { inspectParishWebsite } from "@/lib/admin-worker/communion-verifier";
import { writeAdminWorkerLog } from "@/lib/admin-worker/logs";
import {
  sendAdminWorkerParishRefreshReport,
  sendCriticalFailureAlert,
} from "@/lib/email/admin-send";

const mockedInspect = vi.mocked(inspectParishWebsite);
const mockedReport = vi.mocked(sendAdminWorkerParishRefreshReport);
const mockedAlert = vi.mocked(sendCriticalFailureAlert);

/** A prisma stub with a working AdminWorkerMemory store so state persists across
 * runs (the cursor + monthly counters live there). `keepers` answer the shared
 * duplicate rule's address-key probe (published rows by key, earlier ids). */
function makePrisma(
  rows: Array<Record<string, unknown>>,
  keepers: Array<Record<string, unknown>> = [],
) {
  const store = new Map<string, { memoryValue: unknown; lastUsedAt: Date }>();
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  /** What another lane wrote after the batch was read (id → payload). */
  const fresh = new Map<string, unknown>();
  const prisma = {
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
          update: { memoryValue: unknown };
        }) => {
          store.set(where.memoryType_memoryKey.memoryKey, {
            memoryValue: update.memoryValue,
            lastUsedAt: new Date(),
          });
          return {};
        },
      ),
    },
    publishedContent: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.addressKey === undefined) return rows;
        const id = (where.id ?? {}) as { lt?: string };
        return keepers.filter(
          (k) => k.addressKey === where.addressKey && (!id.lt || String(k.id) < id.lt),
        );
      }),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        return row ? { payload: fresh.get(where.id) ?? row.payload } : null;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push({ id: where.id, data });
          return {};
        },
      ),
    },
  } as unknown as PrismaClient;
  return { prisma, updates, store, fresh };
}

const IN_WINDOW = new Date(2026, 6, 26); // 26 July 2026 (last 7 days of a 31-day month)
const OUT_OF_WINDOW = new Date(2026, 6, 1); // 1 July 2026
const LAST_DAY = new Date(2026, 6, 31); // 31 July 2026

beforeEach(() => {
  delete process.env.ADMIN_WORKER_SKIP_NETWORK;
  process.env.ADMIN_WORKER_PARISH_REFRESH_BATCH = "50";
  mockedInspect.mockReset();
  mockedInspect.mockResolvedValue({ verdict: { status: "unknown" }, details: {} } as never);
  mockedReport.mockClear();
  mockedAlert.mockClear();
});
afterEach(() => {
  delete process.env.ADMIN_WORKER_PARISH_REFRESH_BATCH;
});

describe("isMonthEndWindow", () => {
  it("is true only in the last 7 days of the month", () => {
    expect(isMonthEndWindow(IN_WINDOW)).toBe(true);
    expect(isMonthEndWindow(LAST_DAY)).toBe(true);
    expect(isMonthEndWindow(OUT_OF_WINDOW)).toBe(false);
    expect(isMonthEndWindow(new Date(2026, 6, 24))).toBe(false); // 24th → not yet
  });
});

describe("runParishMonthlyRefresh", () => {
  it("does nothing outside the end-of-month window", async () => {
    const { prisma } = makePrisma([]);
    const out = await runParishMonthlyRefresh(prisma, { now: OUT_OF_WINDOW });
    expect(out.window).toBe(false);
    expect(prisma.publishedContent.findMany).not.toHaveBeenCalled();
  });

  it("is idle in skip-network mode", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const { prisma } = makePrisma([]);
    const out = await runParishMonthlyRefresh(prisma, { now: IN_WINDOW });
    expect(out.window).toBe(true);
    expect(prisma.publishedContent.findMany).not.toHaveBeenCalled();
  });

  it("refreshes changed Mass times, finishes, and emails a report when something changed", async () => {
    mockedInspect.mockResolvedValue({
      verdict: { status: "in-communion" },
      details: { massTimes: "Sunday 9:00 am (updated)" },
    } as never);
    const { prisma, updates } = makePrisma([
      {
        id: "p1",
        slug: "a",
        title: "A",
        payload: { address: "1 Main", city: "X", website: "https://a.example", massTimes: "OLD" },
      },
    ]);

    const out = await runParishMonthlyRefresh(prisma, { now: IN_WINDOW });

    expect(out.done).toBe(true); // short batch ⇒ whole catalog covered
    expect(out.updatedThisRun).toBe(1);
    expect(updates[0]?.data.payload).toMatchObject({ massTimes: "Sunday 9:00 am (updated)" });
    expect(mockedReport).toHaveBeenCalledTimes(1);
    expect(mockedReport.mock.calls[0]![0]).toMatchObject({
      parishesUpdated: 1,
      parishesChecked: 1,
    });
  });

  it("finishes WITHOUT emailing when nothing changed", async () => {
    mockedInspect.mockResolvedValue({
      verdict: { status: "in-communion" },
      details: { massTimes: "SAME" },
    } as never);
    const { prisma } = makePrisma([
      {
        id: "p1",
        slug: "a",
        title: "A",
        payload: { address: "1 Main", city: "X", website: "https://a.example", massTimes: "SAME" },
      },
    ]);
    const out = await runParishMonthlyRefresh(prisma, { now: IN_WINDOW });
    expect(out.done).toBe(true);
    expect(out.updatedThisRun).toBe(0);
    expect(mockedReport).not.toHaveBeenCalled();
  });

  it("escalates when it reaches the last day without finishing", async () => {
    // A full batch (== batch size) means the catalog isn't finished, so on the
    // last day the sweep is behind → escalate once.
    process.env.ADMIN_WORKER_PARISH_REFRESH_BATCH = "1";
    const { prisma } = makePrisma([
      { id: "p1", slug: "a", title: "A", payload: { address: "1 Main", city: "X" } },
    ]);
    const out = await runParishMonthlyRefresh(prisma, { now: LAST_DAY });
    expect(out.done).toBe(false);
    expect(mockedAlert).toHaveBeenCalledTimes(1);
    expect(mockedAlert.mock.calls[0]![0].kind).toMatch(/parish/i);
  });
});

describe("runParishAddressMaintenance", () => {
  const NOW = Date.UTC(2026, 9, 31, 12);
  const KEY = "1 main st x";

  it("unpublishes a parish at the same address within 250 m of an earlier one, saying why", async () => {
    const { prisma, updates } = makePrisma(
      [
        {
          id: "z2",
          slug: "b",
          title: "Dup",
          latitude: 41.8899,
          longitude: 12.4824,
          addressKey: KEY,
          payload: {
            address: "1 Main St",
            city: "X",
            _meta: { websiteVerification: { status: "unknown" } },
          },
        },
      ],
      [
        {
          id: "z1",
          slug: "a",
          title: "Keeper",
          addressKey: KEY,
          latitude: 41.89,
          longitude: 12.4825,
        },
      ],
    );

    const out = await runParishAddressMaintenance(prisma, { force: true, now: () => NOW });

    expect(out.duplicatesRemoved).toBe(1);
    expect(updates[0]?.id).toBe("z2");
    expect(updates[0]?.data).toMatchObject({ isPublished: false });
    const payload = updates[0]?.data.payload as { _meta: Record<string, unknown> };
    expect(payload._meta.dedup).toEqual({
      keeperId: "z1",
      keeperSlug: "a",
      key: KEY,
      rule: "address-key+within-250m",
      at: NOW,
      distanceM: 14,
    });
    // Existing provenance is kept alongside.
    expect(payload._meta.websiteVerification).toEqual({ status: "unknown" });
    expect(updates[0]?.data.contentChecksum).toEqual(expect.any(String));
    // The log names keeper and victim.
    const log = vi.mocked(writeAdminWorkerLog).mock.calls.at(-1)![1] as {
      safeMetadata: { pairs: Array<Record<string, string>> };
    };
    expect(log.safeMetadata.pairs).toEqual([
      {
        victimId: "z2",
        victimSlug: "b",
        keeperId: "z1",
        keeperSlug: "a",
        rule: "address-key+within-250m",
      },
    ]);
  });

  it("keeps a same-key parish that is 3 km from the earlier one", async () => {
    const { prisma, updates } = makePrisma(
      [
        {
          id: "z2",
          slug: "b",
          title: "Other",
          latitude: 41.8899,
          longitude: 12.4824,
          addressKey: KEY,
          payload: { address: "1 Main St", city: "X", addressKey: KEY },
        },
      ],
      [
        {
          id: "z1",
          slug: "a",
          title: "Keeper",
          addressKey: KEY,
          latitude: 41.9029,
          longitude: 12.4534,
        },
      ],
    );

    const out = await runParishAddressMaintenance(prisma, { force: true, now: () => NOW });

    expect(out.duplicatesRemoved).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it("uses the name when a row has no coordinates", async () => {
    const { prisma, updates } = makePrisma(
      [{ id: "z2", slug: "b", title: "St. Mary", payload: { address: "1 Main St", city: "X" } }],
      [
        {
          id: "z1",
          slug: "a",
          title: "Saint Mary Church",
          addressKey: KEY,
          latitude: 1,
          longitude: 1,
        },
      ],
    );
    const out = await runParishAddressMaintenance(prisma, { force: true, now: () => NOW });
    expect(out.duplicatesRemoved).toBe(1);
    expect(
      (updates[0]?.data.payload as { _meta: { dedup: { rule: string } } })._meta.dedup.rule,
    ).toBe("address-key+same-name");
  });

  it("clears a stale city-only key instead of deduping on it (the Rome case)", async () => {
    const { prisma, updates } = makePrisma(
      [
        {
          id: "z2",
          slug: "chiesa",
          title: "Chiesa",
          addressKey: "rome",
          latitude: 41.89,
          longitude: 12.48,
          payload: { city: "Rome", addressKey: "rome" },
        },
      ],
      [
        {
          id: "z1",
          slug: "first",
          title: "First",
          addressKey: "rome",
          latitude: 41.89,
          longitude: 12.48,
        },
      ],
    );

    const out = await runParishAddressMaintenance(prisma, { force: true, now: () => NOW });

    expect(out.duplicatesRemoved).toBe(0);
    expect(out.keyed).toBe(1);
    expect(updates[0]?.data).toMatchObject({ addressKey: null });
    expect(updates[0]?.data.isPublished).toBeUndefined();
    expect((updates[0]?.data.payload as Record<string, unknown>).addressKey).toBeUndefined();
  });

  it("writes onto the row as it is now, and skips one whose address changed meanwhile", async () => {
    const { prisma, updates, fresh } = makePrisma([
      { id: "z1", slug: "a", title: "A", payload: { address: "1 Main St", city: "X" } },
      { id: "z2", slug: "b", title: "B", payload: { address: "2 Main St", city: "X" } },
    ]);
    // Another lane filled a phone on z1, and a different street on z2.
    fresh.set("z1", { address: "1 Main St", city: "X", phone: "+1 555 0100" });
    fresh.set("z2", { address: "2 High St", city: "X" });

    const out = await runParishAddressMaintenance(prisma, { force: true, now: () => NOW });

    expect(out.keyed).toBe(1);
    expect(updates.map((u) => u.id)).toEqual(["z1"]);
    expect(updates[0]!.data.payload).toMatchObject({ phone: "+1 555 0100", addressKey: KEY });
  });

  it("stamps a missing addressKey when there is no duplicate", async () => {
    const { prisma, updates } = makePrisma([
      { id: "z1", slug: "a", title: "A", payload: { address: "1 Main St", city: "X" } },
    ]);

    const out = await runParishAddressMaintenance(prisma, { force: true, now: () => NOW });

    expect(out.keyed).toBe(1);
    expect(out.duplicatesRemoved).toBe(0);
    const payload = updates[0]?.data.payload as Record<string, unknown>;
    expect(payload.addressKey).toBe(KEY);
    expect(updates[0]?.data.addressKey).toBe(KEY);
  });

  it("restarts its walk under a new cursor key now that keys changed meaning", async () => {
    const { prisma, store } = makePrisma([]);
    store.set("parish-address-maint", {
      memoryValue: { cursorId: "m500" },
      lastUsedAt: new Date(),
    });
    await runParishAddressMaintenance(prisma, { force: true, now: () => NOW });
    const where = vi.mocked(prisma.publishedContent.findMany).mock.calls[0]![0]!.where as Record<
      string,
      unknown
    >;
    expect(where.id).toBeUndefined();
    expect(store.has("parish-address-maint-v2")).toBe(true);
  });
});
