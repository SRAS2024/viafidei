/**
 * Prayer translation backfill: fills Latin + Greek on published prayers using
 * the layered engine. These tests pin the keyless canonical path (authentic
 * received text written directly to the payload) and the machine path being
 * review-gated by default (a proposal is filed, not written).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/translation-provider", () => ({
  machineTranslationEnabled: vi.fn(() => false),
  autoPublishMachineTranslations: vi.fn(() => false),
  proposeMachineTranslation: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import { runPrayerTranslationBackfill } from "@/lib/admin-worker/prayer-translation-backfill";
import {
  autoPublishMachineTranslations,
  machineTranslationEnabled,
  proposeMachineTranslation,
} from "@/lib/admin-worker/translation-provider";

const mockedEnabled = vi.mocked(machineTranslationEnabled);
const mockedAuto = vi.mocked(autoPublishMachineTranslations);
const mockedPropose = vi.mocked(proposeMachineTranslation);

beforeEach(() => {
  mockedEnabled.mockReturnValue(false);
  mockedAuto.mockReturnValue(false);
  mockedPropose.mockReset();
  mockedPropose.mockResolvedValue(null);
});
afterEach(() => vi.restoreAllMocks());

// Three stock segments that all resolve to authentic Latin + Greek.
const KYRIE = "Lord, have mercy.\nChrist, have mercy.\nLord, have mercy.";

function makePrisma(rows: Array<{ id: string; title: string; payload: unknown }>) {
  const update = vi.fn(async () => ({}));
  const create = vi.fn(async () => ({}));
  return {
    update,
    create,
    prisma: {
      adminWorkerMemory: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
      publishedContent: { findMany: vi.fn(async () => rows), update },
      humanReviewQueue: { findFirst: vi.fn(async () => null), create },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient,
  };
}

describe("runPrayerTranslationBackfill", () => {
  it("fills canonical Latin + Greek directly (keyless, accurate)", async () => {
    const { prisma, update } = makePrisma([
      { id: "p1", title: "Kyrie", slug: "kyrie", payload: { body: KYRIE } },
    ]);

    const out = await runPrayerTranslationBackfill(prisma, { force: true });

    expect(out.scanned).toBe(1);
    expect(out.filledCanonical).toBeGreaterThanOrEqual(2); // latin + greek
    expect(update).toHaveBeenCalledTimes(1);
    const data = (
      update.mock.calls[0][0] as {
        data: { payload: Record<string, string>; contentChecksum: string };
      }
    ).data;
    expect(data.payload.latin).toContain("Kyrie, eleison.");
    expect(data.payload.greek).toContain("Κύριε");
    // The freshness marker must be recomputed with the new payload, or cache
    // verification would fail against the stored row.
    expect(data.contentChecksum).toMatch(/^[0-9a-f]{16}$/);
  });

  it("skips prayers that already have both translations", async () => {
    const { prisma, update } = makePrisma([
      { id: "p1", title: "Done", slug: "done", payload: { body: KYRIE, latin: "x", greek: "y" } },
    ]);
    const out = await runPrayerTranslationBackfill(prisma, { force: true });
    expect(out.scanned).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("routes a machine proposal to review (does not write it) by default", async () => {
    mockedEnabled.mockReturnValue(true);
    mockedAuto.mockReturnValue(false);
    mockedPropose.mockResolvedValue({
      text: "Oratio ignota",
      source: "machine",
      provider: "ai",
      accurate: false,
    });
    // A body the canonical engine cannot resolve.
    const { prisma, update, create } = makePrisma([
      {
        id: "p2",
        title: "Obscure Prayer",
        slug: "obscure-prayer",
        payload: { body: "An entirely novel prayer text here." },
      },
    ]);

    const out = await runPrayerTranslationBackfill(prisma, { force: true });

    expect(out.filledCanonical).toBe(0);
    expect(out.routedToReview).toBe(2); // latin + greek proposals filed
    expect(create).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();
  });

  it("writes machine output directly when autopublish is enabled", async () => {
    mockedEnabled.mockReturnValue(true);
    mockedAuto.mockReturnValue(true);
    mockedPropose.mockResolvedValue({
      text: "Oratio",
      source: "machine",
      provider: "ai",
      accurate: false,
    });
    const { prisma, update } = makePrisma([
      {
        id: "p3",
        title: "Obscure",
        slug: "obscure",
        payload: { body: "An entirely novel prayer text here." },
      },
    ]);

    const out = await runPrayerTranslationBackfill(prisma, { force: true });

    expect(out.filledMachine).toBe(2);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
