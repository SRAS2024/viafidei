/**
 * Structured ingestor selection: the maintenance floor.
 *
 * pickIngestor scores gap / (1 + zeroStreak), so a type at or over its target
 * scores 0 and was never picked while any other ingestor had a gap — the open
 * types at target stopped growing and the fixed-count ones (a newly declared
 * doctor, a newly elected pope) were never re-checked while SAINT's gap stays
 * in the thousands. Every ingestor now gets at least one run per
 * INGESTOR_MAINTENANCE_FLOOR_MS; otherwise the gap ranking is unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikidata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/structured/wikidata")>();
  return { ...actual, runSparql: vi.fn(async () => []) };
});
vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));

import type { PrismaClient } from "@prisma/client";

import {
  INGESTOR_MAINTENANCE_FLOOR_MS,
  runStructuredIngest,
} from "@/lib/admin-worker/structured/ingest";

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;
beforeEach(() => {
  savedSkip = process.env[SKIP];
  process.env[SKIP] = "1";
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
});

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// Production-shaped goals: SAINT far from target, the rest at or over it.
const LIVE: Record<string, number> = {
  SAINT: 2_780,
  POPE: 267,
  CHURCH_DOCUMENT: 200,
  DOCTOR: 37,
  RITE: 35,
  DEVOTION: 100,
  MARIAN_TITLE: 59,
  SPIRITUAL_PRACTICE: 52,
};
const TARGET: Record<string, number> = {
  SAINT: 10_000,
  POPE: 267,
  CHURCH_DOCUMENT: 200,
  DOCTOR: 37,
  RITE: 24,
  DEVOTION: 100,
  MARIAN_TITLE: 50,
  SPIRITUAL_PRACTICE: 50,
};

interface CursorFixture {
  /** How long ago the ingestor last ran (its cursor row's lastUsedAt). */
  ranAgoMs: number;
  zeroStreak?: number;
  exhaustedUntil?: number;
}

function prismaWith(
  cursors: Record<string, CursorFixture>,
  live: Record<string, number> = LIVE,
): PrismaClient {
  const now = Date.now();
  return {
    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
          const id = where.memoryType_memoryKey.memoryKey.replace("structured-cursor:", "");
          const c = cursors[id];
          if (!c) return null;
          return {
            lastUsedAt: new Date(now - c.ranAgoMs),
            memoryValue: {
              offset: 0,
              zeroStreak: c.zeroStreak ?? 0,
              exhaustedUntil: c.exhaustedUntil ?? null,
            },
          };
        },
      ),
      upsert: vi.fn(async () => ({})),
    },
    publishedContent: {
      count: vi.fn(
        async ({ where }: { where: { contentType: string } }) => live[where.contentType] ?? 0,
      ),
      findMany: vi.fn(async () => []),
    },
    contentGoal: {
      findUnique: vi.fn(async ({ where }: { where: { contentType: string } }) => ({
        desiredTarget: TARGET[where.contentType] ?? 0,
      })),
    },
    adminWorkerLog: { create: vi.fn(async () => ({})) },
  } as unknown as PrismaClient;
}

/** Every ingestor ran `ago` ms ago, with per-id overrides. */
function allRan(ago: number, overrides: Record<string, CursorFixture> = {}) {
  const ids = [
    "wikidata-popes",
    "wikidata-saints",
    "wikidata-church-documents",
    "wikidata-doctors",
    "wikidata-rites",
    "wikidata-devotions",
    "wikidata-marian-titles",
    "wikidata-spiritual-practices",
  ];
  return Object.fromEntries(ids.map((id) => [id, overrides[id] ?? { ranAgoMs: ago }]));
}

describe("pickIngestor — maintenance floor", () => {
  it("defaults to six hours", () => {
    expect(INGESTOR_MAINTENANCE_FLOOR_MS).toBe(6 * HOUR);
  });

  it("without an overdue ingestor, the biggest gap still wins (SAINT)", async () => {
    const out = await runStructuredIngest(prismaWith(allRan(HOUR)), {});
    expect(out.contentType).toBe("SAINT");
  });

  it("an at-target ingestor idle past the floor runs ahead of the biggest gap", async () => {
    const cursors = allRan(HOUR, {
      "wikidata-saints": { ranAgoMs: MIN },
      "wikidata-doctors": { ranAgoMs: 7 * HOUR },
    });
    const out = await runStructuredIngest(prismaWith(cursors), {});
    expect(out.contentType).toBe("DOCTOR");
  });

  it("once it has run, the gap ranking resumes", async () => {
    const cursors = allRan(HOUR, {
      "wikidata-saints": { ranAgoMs: MIN },
      "wikidata-doctors": { ranAgoMs: 2 * MIN },
    });
    const out = await runStructuredIngest(prismaWith(cursors), {});
    expect(out.contentType).toBe("SAINT");
  });

  it("orders several overdue ingestors by score, then least recently used", async () => {
    // DEVOTION is overdue AND below target, so it outranks the overdue
    // at-target RITE; between equal scores the longer-idle one goes first.
    const live = { ...LIVE, DEVOTION: 60 };
    const withGap = allRan(HOUR, {
      "wikidata-saints": { ranAgoMs: MIN },
      "wikidata-rites": { ranAgoMs: 9 * HOUR },
      "wikidata-devotions": { ranAgoMs: 7 * HOUR },
    });
    expect((await runStructuredIngest(prismaWith(withGap, live), {})).contentType).toBe("DEVOTION");

    const tied = allRan(HOUR, {
      "wikidata-saints": { ranAgoMs: MIN },
      "wikidata-rites": { ranAgoMs: 9 * HOUR },
      "wikidata-doctors": { ranAgoMs: 7 * HOUR },
    });
    expect((await runStructuredIngest(prismaWith(tied), {})).contentType).toBe("RITE");
  });

  it("never wakes an ingestor that is resting after a full sweep", async () => {
    const cursors = allRan(HOUR, {
      "wikidata-saints": { ranAgoMs: MIN },
      "wikidata-doctors": { ranAgoMs: 7 * HOUR, exhaustedUntil: Date.now() + HOUR },
    });
    const out = await runStructuredIngest(prismaWith(cursors), {});
    expect(out.contentType).toBe("SAINT");
  });
});
