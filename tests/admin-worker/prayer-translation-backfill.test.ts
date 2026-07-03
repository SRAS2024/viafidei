/**
 * Prayer translation backfill: fills Latin + Greek on published prayers using
 * the worker's OWN deterministic engine only. These tests pin the keyless
 * canonical path (authentic received text written directly to the payload) and
 * that there is NO external AI/machine-translation fallback — a prayer the
 * corpus can't resolve is simply left as-is (or routed to human review only when
 * ADMIN_WORKER_REQUIRE_HUMAN_REVIEW=1, without any machine draft).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import { runPrayerTranslationBackfill } from "@/lib/admin-worker/prayer-translation-backfill";

let savedReviewEnv: string | undefined;
beforeEach(() => {
  savedReviewEnv = process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW;
  delete process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW; // default: fully autonomous
});
afterEach(() => {
  vi.restoreAllMocks();
  if (savedReviewEnv === undefined) delete process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW;
  else process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW = savedReviewEnv;
});

// A stock segment that resolves to authentic Latin + Greek via the deterministic
// corpus (no network, no AI).
const KYRIE = "Lord, have mercy.\nChrist, have mercy.\nLord, have mercy.";

function makePrisma(rows: Array<{ id: string; title: string; slug?: string; payload: unknown }>) {
  // The live-row write routes through the content-protection gate
  // (applyProtectedContentUpdate → snapshotPublishedContent): read via findUnique,
  // write a PublishedContentVersion snapshot, bump version, then update payload.
  const store = rows.map((r) => ({
    contentType: "PRAYER",
    slug: r.slug ?? r.id,
    subtitle: null as string | null,
    version: 1,
    contentChecksum: "old" as string | null,
    ...r,
  }));
  const update = vi.fn(
    async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = store.find((r) => r.id === where.id);
      if (row) {
        if (data.version && typeof data.version === "object") {
          row.version += (data.version as { increment: number }).increment;
        }
        if (typeof data.payload !== "undefined") row.payload = data.payload;
        if (typeof data.title === "string") row.title = data.title;
        if ("contentChecksum" in data) row.contentChecksum = data.contentChecksum as string | null;
      }
      return row ?? {};
    },
  );
  const create = vi.fn(async () => ({}));
  return {
    update,
    create,
    prisma: {
      adminWorkerMemory: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
      publishedContent: {
        findMany: vi.fn(async () => rows),
        findUnique: vi.fn(
          async ({ where }: { where: { id: string } }) =>
            store.find((r) => r.id === where.id) ?? null,
        ),
        update,
      },
      publishedContentVersion: { create: vi.fn(async () => ({ id: "v1" })) },
      humanReviewQueue: { findFirst: vi.fn(async () => null), create },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient,
  };
}

/** The payload-bearing update call (the content write, not the version bump). */
function payloadUpdate(update: ReturnType<typeof vi.fn>) {
  return update.mock.calls
    .map((c) => c[0] as { data?: { payload?: Record<string, unknown>; contentChecksum?: string } })
    .find((arg) => arg?.data?.payload);
}

describe("runPrayerTranslationBackfill", () => {
  it("fills canonical Latin + Greek directly (keyless, deterministic)", async () => {
    const { prisma, update } = makePrisma([
      { id: "p1", title: "Kyrie", slug: "kyrie", payload: { body: KYRIE } },
    ]);

    const out = await runPrayerTranslationBackfill(prisma, { force: true });

    expect(out.scanned).toBe(1);
    expect(out.filledCanonical).toBeGreaterThanOrEqual(2); // latin + greek
    const data = payloadUpdate(update)?.data as {
      payload: Record<string, string>;
      contentChecksum: string;
    };
    expect(data).toBeTruthy();
    expect(data.payload.latin).toContain("Kyrie, eleison.");
    expect(data.payload.greek).toContain("Κύριε");
    // The freshness marker must be recomputed with the new payload.
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

  it("leaves an unresolvable prayer UNFILLED — no external AI, no write (full autonomy)", async () => {
    const { prisma, update, create } = makePrisma([
      {
        id: "p2",
        title: "Obscure Prayer",
        slug: "obscure-prayer",
        payload: { body: "An entirely novel prayer text the corpus cannot resolve." },
      },
    ]);

    const out = await runPrayerTranslationBackfill(prisma, { force: true });

    // The corpus couldn't resolve it → nothing filled, nothing written, no AI call.
    expect(out.filledCanonical).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
