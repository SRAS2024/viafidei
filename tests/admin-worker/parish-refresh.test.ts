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
import {
  sendAdminWorkerParishRefreshReport,
  sendCriticalFailureAlert,
} from "@/lib/email/admin-send";

const mockedInspect = vi.mocked(inspectParishWebsite);
const mockedReport = vi.mocked(sendAdminWorkerParishRefreshReport);
const mockedAlert = vi.mocked(sendCriticalFailureAlert);

/** A prisma stub with a working AdminWorkerMemory store so state persists across
 * runs (the cursor + monthly counters live there). */
function makePrisma(rows: Array<Record<string, unknown>>) {
  const store = new Map<string, { memoryValue: unknown; lastUsedAt: Date }>();
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
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
      findMany: vi.fn(async () => rows),
      findFirst: vi.fn(async () => null),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push({ id: where.id, data });
          return {};
        },
      ),
    },
  } as unknown as PrismaClient;
  return { prisma, updates, store };
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
  it("unpublishes a parish whose address duplicates an earlier one", async () => {
    const { prisma, updates } = makePrisma([
      { id: "z2", slug: "b", title: "Dup", payload: { address: "1 Main St", city: "X" } },
    ]);
    // An EARLIER published parish already sits at this address.
    (prisma.publishedContent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "z1" });

    const out = await runParishAddressMaintenance(prisma, { force: true });

    expect(out.duplicatesRemoved).toBe(1);
    expect(updates[0]?.data).toMatchObject({ isPublished: false });
  });

  it("stamps a missing addressKey when there is no duplicate", async () => {
    const { prisma, updates } = makePrisma([
      { id: "z1", slug: "a", title: "A", payload: { address: "1 Main St", city: "X" } },
    ]);
    (prisma.publishedContent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const out = await runParishAddressMaintenance(prisma, { force: true });

    expect(out.keyed).toBe(1);
    expect(out.duplicatesRemoved).toBe(0);
    const payload = updates[0]?.data.payload as Record<string, unknown>;
    expect(payload.addressKey).toBeTruthy();
  });
});
