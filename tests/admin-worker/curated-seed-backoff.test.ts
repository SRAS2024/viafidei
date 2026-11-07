/**
 * Curated seeding cost + failure memory (seed-curated-content.ts).
 *
 * Measured before: every pass loaded the (contentType, slug) of EVERY published
 * row — the parish directory included, heading for 200k — to check ~1,200
 * curated entries; an entry that could not publish was retried on every pass
 * with nothing but a string in `errors`; and each run re-seeded the 15 goal
 * rows and refreshed them, although the loop already refreshes once per pass.
 * Pinned here:
 *   - the live check asks only for the curated slugs of each type;
 *   - a failing entry is remembered with its reason and retried on a doubling
 *     backoff, reported once per attempt, and forgotten when it publishes, when
 *     the corpus changes (it may have been fixed) or when it leaves the corpus;
 *   - the worker path leaves goal rows to the loop; the operator seed still
 *     finalizes them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));
vi.mock("@/lib/checklist", () => ({
  ALL_CURATED_ENTRIES: [],
  validatePayload: vi.fn((_type: string, payload: Record<string, unknown>) =>
    payload.broken ? { ok: false } : { ok: true, data: payload },
  ),
}));
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(),
}));
vi.mock("@/lib/admin-worker/content-goals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-worker/content-goals")>()),
  seedContentGoals: vi.fn(async () => 15),
  refreshContentGoals: vi.fn(async () => ({ total: 15, changed: 0, unmet: 0 })),
}));

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import type { CuratedEntry } from "@/lib/checklist/knowledge";
import { refreshContentGoals, seedContentGoals } from "@/lib/admin-worker/content-goals";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import {
  CURATED_FAILURES_KEY,
  CURATED_RETRY_BASE_MS,
  curatedKnowledgeFingerprint,
  curatedRetryDelayMs,
  seedCuratedContent,
} from "@/lib/admin-worker/seed-curated-content";

const mockedPublish = vi.mocked(runPublishOrchestrator);
const HOUR = 60 * 60 * 1000;
const T0 = Date.parse("2026-10-31T06:00:00Z");

function entry(contentType: string, slug: string, extra: Record<string, unknown> = {}) {
  return {
    contentType,
    slug,
    authorityLevel: "VATICAN",
    citations: ["https://www.vatican.va/"],
    payload: { slug, title: slug, ...extra },
  } as unknown as CuratedEntry;
}

interface Live {
  contentType: string;
  slug: string;
}

function fakePrisma(corpus: readonly CuratedEntry[], live: Live[] = []) {
  const memory = new Map<string, unknown>();
  // The corpus is already synced, so the re-publish-on-change step is a no-op.
  memory.set("curated-knowledge-fingerprint", { fingerprint: curatedKnowledgeFingerprint(corpus) });
  const liveWheres: unknown[] = [];
  const prisma = {
    publishedContent: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            isPublished: boolean;
            OR?: Array<{ contentType: string; slug: { in: string[] } }>;
          };
        }) => {
          liveWheres.push(where);
          return live.filter((r) =>
            (where.OR ?? []).some(
              (c) => c.contentType === r.contentType && c.slug.in.includes(r.slug),
            ),
          );
        },
      ),
    },
    checklistItem: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "ci" })),
    },
    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
          const v = memory.get(where.memoryType_memoryKey.memoryKey);
          return v ? { memoryValue: v } : null;
        },
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          create: { memoryValue: unknown };
        }) => {
          memory.set(where.memoryType_memoryKey.memoryKey, create.memoryValue);
          return {};
        },
      ),
    },
  };
  return { prisma: prisma as unknown as PrismaClient, memory, live, liveWheres };
}

function failureMemos(memory: Map<string, unknown>) {
  return (
    (memory.get(CURATED_FAILURES_KEY) ?? { entries: {} }) as {
      entries: Record<string, { attempts: number; nextAttemptAt: number; reason: string }>;
    }
  ).entries;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedPublish.mockImplementation(async (_prisma, input) =>
    input.slug.startsWith("refused")
      ? { kind: "blocked", blockedBy: "safety", reason: "publish safety: incomplete_prayer" }
      : {
          kind: "published",
          publishedContentId: `pc-${input.slug}`,
          slug: input.slug,
          route: `/x/${input.slug}`,
          reason: "ok",
        },
  );
});

describe("curatedRetryDelayMs", () => {
  it("doubles from one hour and caps at a day", () => {
    expect(curatedRetryDelayMs(1)).toBe(CURATED_RETRY_BASE_MS);
    expect(curatedRetryDelayMs(2)).toBe(2 * HOUR);
    expect(curatedRetryDelayMs(5)).toBe(16 * HOUR);
    expect(curatedRetryDelayMs(6)).toBe(24 * HOUR);
    expect(curatedRetryDelayMs(40)).toBe(24 * HOUR);
  });
});

describe("seedCuratedContent — live check", () => {
  it("asks only for the curated slugs of each type, in one query", async () => {
    const corpus = [
      entry("PRAYER", "our-father"),
      entry("PRAYER", "hail-mary"),
      entry("SAINT", "saint-joseph"),
    ];
    const { prisma, liveWheres } = fakePrisma(corpus, [
      { contentType: "PRAYER", slug: "our-father" },
      { contentType: "PRAYER", slug: "hail-mary" },
      { contentType: "SAINT", slug: "saint-joseph" },
    ]);

    const res = await seedCuratedContent(prisma, { entries: corpus, nowMs: T0 });

    expect(res.alreadyPublished).toBe(3);
    expect(mockedPublish).not.toHaveBeenCalled();
    expect(liveWheres).toEqual([
      {
        isPublished: true,
        OR: [
          { contentType: "PRAYER", slug: { in: ["our-father", "hail-mary"] } },
          { contentType: "SAINT", slug: { in: ["saint-joseph"] } },
        ],
      },
    ]);
  });
});

describe("seedCuratedContent — failure memory", () => {
  const worker = { honorBackoff: true, finalizeGoals: false } as const;

  it("remembers a failing entry and leaves it alone until its backoff elapses", async () => {
    const corpus = [entry("PRAYER", "good"), entry("PRAYER", "broken", { broken: true })];
    const { prisma, memory, live } = fakePrisma(corpus);

    const first = await seedCuratedContent(prisma, { ...worker, entries: corpus, nowMs: T0 });
    expect(first.published).toBe(1);
    expect(first.failures).toEqual([
      {
        contentType: "PRAYER",
        slug: "broken",
        reason: "invalid payload (fails the strict content schema)",
        attempts: 1,
        nextAttemptAt: T0 + HOUR,
      },
    ]);
    expect(failureMemos(memory)["PRAYER:broken"].attempts).toBe(1);
    live.push({ contentType: "PRAYER", slug: "good" });

    // Inside the window: not attempted, not reported again.
    vi.mocked(validatePayload).mockClear();
    const second = await seedCuratedContent(prisma, {
      ...worker,
      entries: corpus,
      nowMs: T0 + 30 * 60 * 1000,
    });
    expect(second.deferred).toBe(1);
    expect(second.failures).toEqual([]);
    expect(validatePayload).not.toHaveBeenCalled();

    // Window over: one more attempt, and the next wait doubles.
    const third = await seedCuratedContent(prisma, {
      ...worker,
      entries: corpus,
      nowMs: T0 + HOUR + 1,
    });
    expect(third.deferred).toBe(0);
    expect(third.failures?.[0]).toMatchObject({
      slug: "broken",
      attempts: 2,
      nextAttemptAt: T0 + HOUR + 1 + 2 * HOUR,
    });
  });

  it("records a refused publish with the orchestrator's reason", async () => {
    const corpus = [entry("PRAYER", "refused-prayer")];
    const { prisma, memory } = fakePrisma(corpus);

    const res = await seedCuratedContent(prisma, { ...worker, entries: corpus, nowMs: T0 });

    expect(res.skipped).toBe(1);
    expect(res.failures?.[0].reason).toBe("blocked: publish safety: incomplete_prayer");
    expect(failureMemos(memory)["PRAYER:refused-prayer"].reason).toContain("incomplete_prayer");
  });

  it("forgets the failure once the entry publishes", async () => {
    const corpus = [entry("PRAYER", "flaky")];
    const { prisma, memory } = fakePrisma(corpus);
    mockedPublish.mockRejectedValueOnce(new Error("connection reset"));

    const first = await seedCuratedContent(prisma, { ...worker, entries: corpus, nowMs: T0 });
    expect(first.failed).toBe(1);
    expect(first.failures?.[0].reason).toBe("threw: connection reset");

    const second = await seedCuratedContent(prisma, {
      ...worker,
      entries: corpus,
      nowMs: T0 + 2 * HOUR,
    });
    expect(second.published).toBe(1);
    expect(failureMemos(memory)).toEqual({});
  });

  it("gives every failing entry a fresh attempt when the corpus changes", async () => {
    const corpus = [entry("PRAYER", "broken", { broken: true })];
    const { prisma, memory } = fakePrisma(corpus);
    await seedCuratedContent(prisma, { ...worker, entries: corpus, nowMs: T0 });

    // The entry was fixed in the repository: new fingerprint, fresh attempt.
    const fixed = [entry("PRAYER", "broken")];
    const res = await seedCuratedContent(prisma, {
      ...worker,
      entries: fixed,
      nowMs: T0 + 60 * 1000,
    });
    expect(res.deferred).toBe(0);
    expect(res.published).toBe(1);
    expect(failureMemos(memory)).toEqual({});
  });

  it("counts a fix made only inside a nested field as the corpus changing", async () => {
    const days = (prayerText: string) => ({ days: [{ day: 1, prayerText }] });
    const corpus = [entry("PRAYER", "refused-novena", days("Before."))];
    const { prisma } = fakePrisma(corpus);
    await seedCuratedContent(prisma, { ...worker, entries: corpus, nowMs: T0 });
    expect(mockedPublish).toHaveBeenCalledTimes(1);

    // Well inside the backoff, so only a new fingerprint can bring this attempt.
    const fixed = [entry("PRAYER", "refused-novena", days("After."))];
    const res = await seedCuratedContent(prisma, {
      ...worker,
      entries: fixed,
      nowMs: T0 + 60 * 1000,
    });
    expect(res.deferred).toBe(0);
    expect(mockedPublish).toHaveBeenCalledTimes(2);
  });

  it("drops the memo of an entry that left the corpus", async () => {
    const corpus = [entry("PRAYER", "gone", { broken: true }), entry("PRAYER", "kept")];
    const { prisma, memory } = fakePrisma(corpus);
    await seedCuratedContent(prisma, { ...worker, entries: corpus, nowMs: T0 });
    expect(Object.keys(failureMemos(memory))).toEqual(["PRAYER:gone"]);

    // Same fingerprint would keep it; a corpus without the entry forgets it.
    const smaller = [entry("PRAYER", "kept")];
    await seedCuratedContent(prisma, { ...worker, entries: smaller, nowMs: T0 + 1000 });
    expect(failureMemos(memory)).toEqual({});
  });

  it("the operator seed attempts everything but still records the outcome", async () => {
    const corpus = [entry("PRAYER", "broken", { broken: true })];
    const { prisma, memory } = fakePrisma(corpus);
    await seedCuratedContent(prisma, { ...worker, entries: corpus, nowMs: T0 });

    const res = await seedCuratedContent(prisma, { entries: corpus, nowMs: T0 + 1000 });
    expect(res.deferred).toBe(0);
    expect(res.failures?.[0].attempts).toBe(2);
    expect(failureMemos(memory)["PRAYER:broken"].attempts).toBe(2);
  });
});

describe("seedCuratedContent — goal rows", () => {
  it("the worker path leaves goal seeding and refresh to the loop", async () => {
    const corpus = [entry("PRAYER", "our-father")];
    const { prisma } = fakePrisma(corpus);
    await seedCuratedContent(prisma, { entries: corpus, finalizeGoals: false, nowMs: T0 });
    expect(seedContentGoals).not.toHaveBeenCalled();
    expect(refreshContentGoals).not.toHaveBeenCalled();
  });

  it("the operator seed still seeds and refreshes them once", async () => {
    const corpus = [entry("PRAYER", "our-father")];
    const { prisma } = fakePrisma(corpus);
    await seedCuratedContent(prisma, { entries: corpus, nowMs: T0 });
    expect(seedContentGoals).toHaveBeenCalledTimes(1);
    expect(refreshContentGoals).toHaveBeenCalledTimes(1);
  });
});
