/**
 * Curated-set types never grow from Wikidata (StructuredIngestor.curatedSet).
 *
 * The maintenance floor made the DOCTOR and RITE ingestors run in production
 * for the first time. Their dedup against the curated rows rests on slug and
 * name alone — curated rows carry no Wikidata QID — and Wikidata's labels are
 * not the curated titles: run against the real curated Doctors, four of five
 * Wikidata-labelled Doctors ("Pope Gregory I", "Pope Leo I", "Basil of
 * Caesarea", "Albertus Magnus") went to the publish orchestrator as NEW pages
 * beside "Saint Gregory the Great", "Saint Leo the Great", "Saint Basil the
 * Great" and "Saint Albert the Great". Pinned here, against the real curated
 * corpus:
 *   - a curated-set ingestor publishes nothing: a row a curated title matches
 *     counts as live, every other row is held as `curated_set_unmatched`,
 *     remembered per QID and sampled in the ledger (that is how a newly
 *     declared Doctor reaches a curator);
 *   - the same holds when the maintenance floor picks the ingestor;
 *   - a held entity is not re-mapped on the next sweep;
 *   - only DOCTOR and RITE are curated-set types.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikidata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/structured/wikidata")>();
  return { ...actual, runSparql: vi.fn() };
});
vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({ kind: "published" })),
}));

import type { PrismaClient } from "@prisma/client";

import { ALL_CURATED_ENTRIES } from "@/lib/checklist";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import { runStructuredIngest } from "@/lib/admin-worker/structured/ingest";
import { STRUCTURED_INGESTORS } from "@/lib/admin-worker/structured/ingestors";
import {
  rejectionMemoKey,
  resetRejectionMemoryPruneClock,
  type RejectionMemo,
} from "@/lib/admin-worker/structured/reject-memory";
import { fetchSummaryForArticleUrl } from "@/lib/admin-worker/structured/wikipedia";
import { runSparql, type SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const mockedSparql = vi.mocked(runSparql);
const mockedSummary = vi.mocked(fetchSummaryForArticleUrl);
const mockedPublish = vi.mocked(runPublishOrchestrator);

const WD = "http://www.wikidata.org/entity/";
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;

beforeEach(() => {
  savedSkip = process.env[SKIP];
  process.env[SKIP] = "1";
  resetRejectionMemoryPruneClock();
  mockedSparql.mockReset();
  mockedSummary.mockReset();
  mockedSummary.mockResolvedValue(null);
  mockedPublish.mockClear();
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
  vi.useRealTimers();
});

/** The curated rows of a type, as the live index reads them (no QID). */
function curatedLive(contentType: string) {
  return ALL_CURATED_ENTRIES.filter((e) => e.contentType === contentType).map((e) => ({
    slug: e.slug,
    title: String(e.payload.title),
    sourceRef: null,
  }));
}

function binding(fields: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(fields)) b[k] = { type: "literal", value: v };
  return b;
}

type Where = {
  memoryType?: string;
  memoryKey?: { in?: string[]; startsWith?: string };
  lastUsedAt?: { lt: Date };
};

/** In-memory AdminWorkerMemory + the published rows of every type. */
function fakePrisma(opts: {
  liveByType: Record<string, Array<{ slug: string; title: string; sourceRef: null }>>;
  targets?: Record<string, number>;
}) {
  const memory = new Map<string, { memoryValue: unknown; lastUsedAt: Date | null }>();
  const matches = (key: string, where: Where) => {
    const lastUsedAt = memory.get(key)?.lastUsedAt;
    return (
      (!where.memoryKey?.in || where.memoryKey.in.includes(key)) &&
      (!where.memoryKey?.startsWith || key.startsWith(where.memoryKey.startsWith)) &&
      (!where.lastUsedAt || (lastUsedAt != null && lastUsedAt < where.lastUsedAt.lt))
    );
  };
  const prisma = {
    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) =>
          memory.get(where.memoryType_memoryKey.memoryKey) ?? null,
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          create: { memoryValue: unknown };
        }) => {
          memory.set(where.memoryType_memoryKey.memoryKey, {
            memoryValue: create.memoryValue,
            lastUsedAt: new Date(),
          });
          return {};
        },
      ),
      findMany: vi.fn(async ({ where }: { where: Where }) =>
        [...memory]
          .filter(([key]) => matches(key, where))
          .map(([memoryKey, r]) => ({ memoryKey, ...r })),
      ),
      deleteMany: vi.fn(async ({ where }: { where: Where }) => {
        let count = 0;
        for (const key of [...memory.keys()]) {
          if (where.memoryKey && matches(key, where)) {
            memory.delete(key);
            count += 1;
          }
        }
        return { count };
      }),
      createMany: vi.fn(
        async ({
          data,
        }: {
          data: Array<{ memoryKey: string; memoryValue: unknown; lastUsedAt: Date }>;
        }) => {
          for (const d of data) {
            memory.set(d.memoryKey, { memoryValue: d.memoryValue, lastUsedAt: d.lastUsedAt });
          }
          return { count: data.length };
        },
      ),
      count: vi.fn(async () => 0),
    },
    publishedContent: {
      findMany: vi.fn(
        async ({ where }: { where: { contentType: string } }) =>
          opts.liveByType[where.contentType] ?? [],
      ),
      count: vi.fn(
        async ({ where }: { where: { contentType: string } }) =>
          (opts.liveByType[where.contentType] ?? []).length,
      ),
    },
    contentGoal: {
      findUnique: vi.fn(async ({ where }: { where: { contentType: string } }) => ({
        desiredTarget: opts.targets?.[where.contentType] ?? 0,
      })),
    },
    checklistItem: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "ci" })),
    },
    adminWorkerLog: { create: vi.fn(async () => ({})) },
  };
  return { prisma: prisma as unknown as PrismaClient, memory };
}

/**
 * The Doctors as Wikidata labels them. Most labels are the curated title
 * without "Saint"; the nine below are not — eight are curated Doctors under a
 * different name, and one (John Henry Newman, declared in 2025) is the newly
 * declared Doctor a sweep exists to notice.
 */
const DOCTOR_LABELS_MATCHING_CURATED = [
  "Athanasius of Alexandria",
  "Ephrem the Syrian",
  "Hilary of Poitiers",
  "Cyril of Jerusalem",
  "Gregory of Nazianzus",
  "John Chrysostom",
  "Jerome",
  "Augustine of Hippo",
  "Cyril of Alexandria",
  "Peter Chrysologus",
  "Isidore of Seville",
  "John of Damascus",
  "Peter Damian",
  "Anselm of Canterbury",
  "Bernard of Clairvaux",
  "Anthony of Padua",
  "Bonaventure",
  "Thomas Aquinas",
  "Catherine of Siena",
  "Teresa of Ávila",
  "Peter Canisius",
  "John of the Cross",
  "Robert Bellarmine",
  "Lawrence of Brindisi",
  "Francis de Sales",
  "Thérèse of Lisieux",
  "John of Ávila",
  "Hildegard of Bingen",
  "Gregory of Narek",
];
const DOCTOR_LABELS_NOT_MATCHING = [
  "Pope Gregory I",
  "Pope Leo I",
  "Basil of Caesarea",
  "Albertus Magnus",
  "Ambrose",
  "Bede",
  "Irenaeus",
  "Alphonsus Maria de' Liguori",
  "John Henry Newman",
];

function doctorRows(): SparqlBinding[] {
  return [...DOCTOR_LABELS_MATCHING_CURATED, ...DOCTOR_LABELS_NOT_MATCHING].map((label, i) =>
    binding({
      d: `${WD}${label === "Pope Gregory I" ? "Q9620" : `Q${910_000 + i}`}`,
      label,
      art: `https://en.wikipedia.org/wiki/${encodeURIComponent(label.replace(/ /g, "_"))}`,
    }),
  );
}

const qidOfLabel = (label: string) => {
  const row = doctorRows().find((r) => r.label?.value === label);
  return row?.d?.value.replace(WD, "") ?? "";
};

describe("curated-set ingestors", () => {
  it("are exactly DOCTOR and RITE", () => {
    expect(
      STRUCTURED_INGESTORS.filter((i) => i.curatedSet)
        .map((i) => i.contentType)
        .sort(),
    ).toEqual(["DOCTOR", "RITE"]);
  });
});

describe("DOCTOR ingestor against the real curated Doctors", () => {
  it("publishes nothing: curated titles match as live, every other Doctor is held", async () => {
    expect(curatedLive("DOCTOR")).toHaveLength(37);
    mockedSparql.mockResolvedValue(doctorRows());
    const { prisma, memory } = fakePrisma({ liveByType: { DOCTOR: curatedLive("DOCTOR") } });

    const out = await runStructuredIngest(prisma, { contentType: "DOCTOR", batch: 100 });

    expect(mockedPublish).not.toHaveBeenCalled();
    expect(out.published).toBe(0);
    expect(out.alreadyPublished).toBe(DOCTOR_LABELS_MATCHING_CURATED.length);
    expect(out.skipReasons).toEqual({ curated_set_unmatched: DOCTOR_LABELS_NOT_MATCHING.length });
    // The held Doctors are named in the ledger sample, QID included.
    expect(out.skipSamples).toContain("curated_set_unmatched: Pope Gregory I (Q9620)");
    expect(out.skipSamples.some((s) => s.includes("John Henry Newman"))).toBe(true);
    // Each one is remembered, so the next sweep does not map it again.
    expect(out.rejectionsRemembered).toBe(DOCTOR_LABELS_NOT_MATCHING.length);
    const memo = memory.get(rejectionMemoKey("wikidata-doctors", "Q9620"))?.memoryValue as
      | RejectionMemo
      | undefined;
    expect(memo).toMatchObject({ code: "curated_set_unmatched", attempts: 1 });
    expect(memory.has(rejectionMemoKey("wikidata-doctors", qidOfLabel("Thomas Aquinas")))).toBe(
      false,
    );
  });

  it("a held Doctor waits out its backoff instead of being mapped on the next sweep", async () => {
    const t0 = Date.parse("2026-10-31T06:00:00Z");
    vi.useFakeTimers({ now: t0, toFake: ["Date"] });
    mockedSparql.mockResolvedValue(doctorRows());
    const { prisma, memory } = fakePrisma({ liveByType: { DOCTOR: curatedLive("DOCTOR") } });
    await runStructuredIngest(prisma, { contentType: "DOCTOR", batch: 100 });

    // Past the full-sweep rest, before the memo's day is up.
    memory.delete("structured-cursor:wikidata-doctors");
    vi.setSystemTime(t0 + 7 * 60 * MIN);
    mockedSummary.mockClear();
    const again = await runStructuredIngest(prisma, { contentType: "DOCTOR", batch: 100 });

    expect(mockedPublish).not.toHaveBeenCalled();
    expect(again.rejectionsDeferred).toBe(DOCTOR_LABELS_NOT_MATCHING.length);
    expect(again.skipReasons).toEqual({});
    expect(mockedSummary).not.toHaveBeenCalled();

    // A day later the wait is over: still held, never published.
    vi.setSystemTime(t0 + DAY + MIN);
    memory.delete("structured-cursor:wikidata-doctors");
    const later = await runStructuredIngest(prisma, { contentType: "DOCTOR", batch: 100 });
    expect(mockedPublish).not.toHaveBeenCalled();
    expect(later.skipReasons).toEqual({ curated_set_unmatched: DOCTOR_LABELS_NOT_MATCHING.length });
  });

  it("publishes nothing when the maintenance floor picks DOCTOR", async () => {
    mockedSparql.mockResolvedValue(doctorRows());
    const { prisma, memory } = fakePrisma({
      liveByType: { DOCTOR: curatedLive("DOCTOR") },
      targets: { SAINT: 10_000, DOCTOR: 37 },
    });
    // Every other ingestor ran a minute ago; DOCTOR never has (no cursor row),
    // so the floor puts it ahead of SAINT's gap.
    for (const ing of STRUCTURED_INGESTORS) {
      if (ing.contentType === "DOCTOR") continue;
      memory.set(`structured-cursor:${ing.id}`, {
        memoryValue: { offset: 0, zeroStreak: 0 },
        lastUsedAt: new Date(Date.now() - MIN),
      });
    }

    const out = await runStructuredIngest(prisma, {});

    expect(out.contentType).toBe("DOCTOR");
    expect(mockedPublish).not.toHaveBeenCalled();
    expect(out.skipReasons.curated_set_unmatched).toBe(DOCTOR_LABELS_NOT_MATCHING.length);
  });
});

describe("RITE ingestor against the real curated rite registry", () => {
  const CATHOLIC =
    "is a liturgical rite of the Catholic Church, celebrated in full communion with the Holy See by the faithful who keep it.";
  const ORTHODOX =
    "is the liturgical tradition of the Eastern Orthodox Church, celebrated by the Russian Orthodox and other national churches.";
  const rite = (qid: string, label: string) =>
    binding({
      r: `${WD}${qid}`,
      label,
      art: `https://en.wikipedia.org/wiki/${label.replace(/ /g, "_")}`,
    });

  it("publishes nothing: registry rites match as live, the rest are held or screened out", async () => {
    mockedSparql.mockResolvedValue([
      rite("Q920001", "Roman Rite"),
      rite("Q920002", "Byzantine Rite"),
      rite("Q920003", "Ambrosian Rite"),
      rite("Q920004", "Mozarabic Rite"),
      rite("Q920005", "Antiochene Rite"),
      rite("Q920006", "Anglican Use"),
      rite("Q920007", "Rite of Braga"),
      rite("Q920008", "Gallican Rite"),
      rite("Q920009", "Russian Orthodox liturgy"),
    ]);
    mockedSummary.mockImplementation(async (url: string) => {
      const title = decodeURIComponent(url.split("/wiki/")[1] ?? "").replace(/_/g, " ");
      return {
        extract: `The ${title} ${title.includes("Orthodox") ? ORTHODOX : CATHOLIC}`,
        url,
        lang: "en",
      };
    });
    const { prisma } = fakePrisma({ liveByType: { RITE: curatedLive("RITE") } });

    const out = await runStructuredIngest(prisma, { contentType: "RITE", batch: 100 });

    expect(mockedPublish).not.toHaveBeenCalled();
    expect(out.published).toBe(0);
    expect(out.alreadyPublished).toBe(4);
    expect(out.skipReasons).toEqual({ curated_set_unmatched: 4, not_catholic_context: 1 });
    expect(out.skipSamples).toContain("curated_set_unmatched: Antiochene Rite (Q920005)");
  });
});
