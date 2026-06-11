/**
 * Structured discovery seeder — bridges Wikidata's coverage to the content types
 * that have NO structured ingestor of their own.
 *
 * A devotion's practice text, a Marian title's theology, and an apparition's
 * approval status can't be safely auto-published from structured data (their
 * accuracy rules require approved sources, not a Wikipedia abstract). But
 * Wikidata DOES know which devotions / Marian titles / apparitions exist, and it
 * carries their **authoritative source URLs** — official shrine/confraternity
 * websites (P856) and "described at URL" references (P973). This seeder pulls
 * those URLs and adds them to the worker's own candidate queue, tagged with the
 * predicted content type, so the live extraction pipeline (discovery → fetch →
 * extract → cross-source verify → strict QA) can build them from the right
 * sources instead of waiting to stumble across one.
 *
 * It is DISCOVERY ONLY — it never publishes. Every candidate still passes the
 * full extraction + verification + QA gauntlet before anything goes live, so a
 * broad, label-based query is safe here (the gates do the precision). Keyless,
 * bounded, self-throttled, network-gated, and idempotent (candidate URLs dedup
 * on insert).
 */

import type { ChecklistContentType, PrismaClient } from "@prisma/client";

import { runSparql, bindingValue } from "./wikidata";

const THROTTLE_MS = 30 * 60 * 1000; // every ~30 min is plenty for seeding
const THROTTLE_KEY = "discovery-seeder-lastrun";
const CURSOR_PREFIX = "discovery-seed-cursor:";

interface SeedQuery {
  id: string;
  contentType: ChecklistContentType;
  /**
   * Returns entities of the type with their official website (P856),
   * described-at URL (P973), and English Wikipedia article. The instance-of
   * filter is intentionally label-based + broad: discovery may over-reach
   * because the downstream classifier + QA decide what actually publishes.
   */
  sparql(limit: number, offset: number): string;
}

function seedSparql(typeLabelFilter: string): (limit: number, offset: number) => string {
  return (limit, offset) =>
    `SELECT ?x (SAMPLE(?website) AS ?site) (SAMPLE(?described) AS ?desc) (SAMPLE(?article) AS ?art) WHERE {
  ?x wdt:P31 ?type .
  ?type rdfs:label ?tl . FILTER(LANG(?tl) = "en") FILTER(${typeLabelFilter})
  OPTIONAL { ?x wdt:P856 ?website . }
  OPTIONAL { ?x wdt:P973 ?described . }
  OPTIONAL { ?article schema:about ?x ; schema:isPartOf <https://en.wikipedia.org/> . }
}
GROUP BY ?x
ORDER BY ?x
LIMIT ${limit} OFFSET ${offset}`;
}

const SEED_QUERIES: SeedQuery[] = [
  {
    id: "seed-devotions",
    contentType: "DEVOTION",
    sparql: seedSparql(`CONTAINS(LCASE(?tl), "devotion")`),
  },
  {
    id: "seed-marian-titles",
    contentType: "MARIAN_TITLE",
    sparql: seedSparql(
      `CONTAINS(LCASE(?tl), "title of mary") || CONTAINS(LCASE(?tl), "marian title") || CONTAINS(LCASE(?tl), "title of the blessed virgin")`,
    ),
  },
  {
    id: "seed-apparitions",
    contentType: "APPARITION",
    sparql: seedSparql(`CONTAINS(LCASE(?tl), "apparition")`),
  },
  {
    id: "seed-novenas",
    contentType: "NOVENA",
    sparql: seedSparql(`CONTAINS(LCASE(?tl), "novena")`),
  },
  {
    id: "seed-prayers",
    contentType: "PRAYER",
    sparql: seedSparql(
      `CONTAINS(LCASE(?tl), "catholic prayer") || CONTAINS(LCASE(?tl), "christian prayer") || CONTAINS(LCASE(?tl), "litany")`,
    ),
  },
  {
    id: "seed-spiritual-practices",
    contentType: "SPIRITUAL_PRACTICE",
    sparql: seedSparql(
      `CONTAINS(LCASE(?tl), "spiritual practice") || CONTAINS(LCASE(?tl), "christian pilgrimage")`,
    ),
  },
  {
    id: "seed-rites",
    contentType: "RITE",
    sparql: seedSparql(
      `CONTAINS(LCASE(?tl), "catholic rite") || CONTAINS(LCASE(?tl), "liturgical rite") || CONTAINS(LCASE(?tl), "church sui iuris")`,
    ),
  },
];

export interface DiscoverySeedResult {
  enabled: boolean;
  entities: number;
  enqueued: number;
  bySeed: Record<string, number>;
  detail: string;
}

export function discoverySeederEnabled(): boolean {
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return false;
  const v = (process.env.ADMIN_WORKER_DISCOVERY_SEEDER ?? "").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

async function readCursor(prisma: PrismaClient, id: string): Promise<number> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: {
        memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: `${CURSOR_PREFIX}${id}` },
      },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = row?.memoryValue as { offset?: number } | null;
  return typeof v?.offset === "number" && v.offset >= 0 ? v.offset : 0;
}

async function writeCursor(prisma: PrismaClient, id: string, offset: number): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: {
        memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: `${CURSOR_PREFIX}${id}` },
      },
      update: { memoryValue: { offset }, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: `${CURSOR_PREFIX}${id}`,
        memoryValue: { offset },
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

async function throttleOk(prisma: PrismaClient): Promise<boolean> {
  const where = {
    memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: THROTTLE_KEY },
  };
  const row = await prisma.adminWorkerMemory
    .findUnique({ where, select: { lastUsedAt: true } })
    .catch(() => null);
  const last = row?.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
  if (Date.now() - last < THROTTLE_MS) return false;
  await prisma.adminWorkerMemory
    .upsert({
      where,
      update: { lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: THROTTLE_KEY,
        memoryValue: {},
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
  return true;
}

/**
 * Seed the candidate queue with authoritative source URLs for the gap content
 * types. Bounded per pass and self-throttled. Returns how many entities were
 * read and how many candidate URLs were accepted (after the candidate guard).
 */
export async function runDiscoverySeeder(
  prisma: PrismaClient,
  opts: { batch?: number; force?: boolean } = {},
): Promise<DiscoverySeedResult> {
  const out: DiscoverySeedResult = {
    enabled: discoverySeederEnabled(),
    entities: 0,
    enqueued: 0,
    bySeed: {},
    detail: "",
  };
  if (!out.enabled) {
    out.detail = "discovery seeder disabled (skip-network or opt-out).";
    return out;
  }
  if (!opts.force && !(await throttleOk(prisma))) {
    out.detail = "throttled";
    return out;
  }

  const batch = opts.batch ?? 15;
  const { discoverCandidate } = await import("../web-navigator");

  for (const seed of SEED_QUERIES) {
    const offset = await readCursor(prisma, seed.id);
    let rows: Awaited<ReturnType<typeof runSparql>> = [];
    try {
      rows = await runSparql(seed.sparql(batch, offset));
    } catch {
      rows = [];
    }
    out.entities += rows.length;
    out.bySeed[seed.id] = 0;

    for (const row of rows) {
      // Official website + described-at URL are authoritative; the Wikipedia
      // article is a lower-priority fallback the crawler can follow links from.
      const targets: Array<{ url: string; usefulness: number }> = [];
      const site = bindingValue(row, "site");
      const desc = bindingValue(row, "desc");
      const art = bindingValue(row, "art");
      if (site) targets.push({ url: site, usefulness: 0.6 });
      if (desc && desc !== site) targets.push({ url: desc, usefulness: 0.55 });
      if (art) targets.push({ url: art, usefulness: 0.4 });

      for (const t of targets.slice(0, 3)) {
        try {
          const r = await discoverCandidate(prisma, {
            url: t.url,
            sourceHost: "",
            discoveryMethod: "API",
            predictedContentType: seed.contentType,
            predictedUsefulness: t.usefulness,
          });
          if (r) {
            out.enqueued += 1;
            out.bySeed[seed.id] += 1;
          }
        } catch {
          // best-effort — a rejected/unreachable source is expected
        }
      }
    }

    // Walk forward; wrap to re-sweep at the end of the corpus.
    const nextOffset = rows.length < batch ? 0 : offset + rows.length;
    await writeCursor(prisma, seed.id, nextOffset);
  }

  out.detail = `seeded ${out.enqueued} candidate URL(s) from ${out.entities} entit(y/ies) across ${SEED_QUERIES.length} type(s).`;
  return out;
}
