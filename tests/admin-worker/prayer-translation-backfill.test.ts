/**
 * Prayer translation backfill: fills Latin + Greek on published prayers using
 * the worker's OWN deterministic engine only. These tests pin the keyless
 * canonical path (authentic received text written directly to the payload) and
 * that there is NO external AI/machine-translation fallback — a prayer the
 * corpus can't resolve is simply left as-is (or routed to human review only when
 * ADMIN_WORKER_REQUIRE_HUMAN_REVIEW=1, without any machine draft).
 *
 * They also pin the retirement path for the June 2026 machine translations
 * (`machineTranslated`): authentic text replaces a marked language when the
 * corpus resolves it, and nothing is ever deleted or overwritten otherwise.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import { prayerKnowledge } from "@/lib/checklist/knowledge/prayers";
import { runPrayerTranslationBackfill } from "@/lib/admin-worker/prayer-translation-backfill";
import { translatePrayerLanguages } from "@/lib/admin-worker/prayer-translator";

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

/** The curated Our Father, whose authentic Latin and Greek the corpus holds. */
const OUR_FATHER = String(
  (prayerKnowledge.find((p) => p.slug === "our-father")!.payload as Record<string, unknown>).body,
);

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

  it("replaces machine-translated Latin/Greek with the authentic text and clears the marker", async () => {
    // The June 2026 lane machine-translated languages the corpus could not
    // resolve and marked them. Once the corpus CAN render the received text,
    // that text must win — the old "already has latin" test made it impossible.
    const { prisma, update } = makePrisma([
      {
        id: "p3",
        title: "Our Father",
        slug: "our-father",
        payload: {
          body: OUR_FATHER,
          latin: "Pater noster machina",
          greek: "Μηχανή",
          machineTranslated: ["latin", "greek"],
          summary: "kept",
        },
      },
    ]);

    const out = await runPrayerTranslationBackfill(prisma, { force: true });

    expect(out.upgradedMachine).toBe(2);
    expect(out.filledCanonical).toBe(0);
    const data = payloadUpdate(update)?.data as { payload: Record<string, unknown> };
    expect(data.payload.latin).toMatch(/^Pater noster, qui es in caelis/);
    expect(data.payload.greek).toMatch(/^Πάτερ ἡμῶν/);
    expect(data.payload).not.toHaveProperty("machineTranslated");
    // Nothing else in the payload moves.
    expect(data.payload.summary).toBe("kept");
    expect(data.payload.body).toBe(OUR_FATHER);
  });

  it("keeps a machine translation the corpus cannot replace, and never deletes it", async () => {
    const { prisma, update } = makePrisma([
      {
        id: "p4",
        title: "Novel Prayer",
        slug: "novel-prayer",
        payload: {
          body: "An entirely novel prayer text the corpus cannot resolve.",
          latin: "Oratio machina",
          machineTranslated: ["latin"],
        },
      },
    ]);
    const out = await runPrayerTranslationBackfill(prisma, { force: true });
    expect(out.scanned).toBe(1);
    expect(out.upgradedMachine).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("never overwrites an unmarked (authentic) translation, even one that differs", async () => {
    const { prisma, update } = makePrisma([
      {
        id: "p5",
        title: "Our Father",
        slug: "our-father",
        payload: { body: OUR_FATHER, latin: "Pater noster (an older printing)", greek: "Πάτερ" },
      },
    ]);
    const out = await runPrayerTranslationBackfill(prisma, { force: true });
    expect(out.scanned).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("writes nothing when a stale marker sits over text that is already authentic", async () => {
    // litany-of-saint-joseph in production: a curated update replaced the
    // machine Latin with the official text but left "latin" in the marker.
    const authentic = translatePrayerLanguages(OUR_FATHER);
    const { prisma, update } = makePrisma([
      {
        id: "p6",
        title: "Our Father",
        slug: "our-father",
        payload: {
          body: OUR_FATHER,
          latin: authentic.latin,
          greek: authentic.greek,
          machineTranslated: ["latin"],
        },
      },
    ]);
    const out = await runPrayerTranslationBackfill(prisma, { force: true });
    expect(out.filledCanonical + out.upgradedMachine).toBe(0);
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
