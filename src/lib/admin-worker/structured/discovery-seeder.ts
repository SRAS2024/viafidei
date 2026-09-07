/**
 * Structured discovery seeder — bridges Wikidata's coverage to the content types
 * that have NO structured ingestor of their own AND whose accuracy rules require
 * approved sources rather than an encyclopedic abstract: apparitions (a Church
 * approval status), novenas (verbatim nine-day prayer text), and prayers
 * (verbatim prayer text). Their text/status can't be safely auto-published from
 * structured data — but Wikidata DOES know which of them exist and carries their
 * **authoritative source URLs** — official shrine/confraternity websites (P856)
 * and "described at URL" references (P973). This seeder pulls those URLs and adds
 * them to the worker's own candidate queue, tagged with the predicted content
 * type, so the live extraction pipeline (discovery → fetch → extract →
 * cross-source verify → strict QA) can build them from the right sources instead
 * of waiting to stumble across one.
 *
 * The descriptive types (devotion, Marian title, spiritual practice) and the
 * factual ones (pope, saint, doctor, rite, church document) are NOT seeded here:
 * each has its own structured ingestor (`ingestors.ts`) that publishes it
 * directly — the descriptive ones reading the entity's own official source first
 * and Wikipedia only as a last resort, citing every source for cross-reference.
 *
 * It is DISCOVERY ONLY — it never publishes. Every candidate still passes the
 * full extraction + verification + QA gauntlet before anything goes live.
 * Keyless, bounded, self-throttled, network-gated, and idempotent (candidate
 * URLs dedup on insert).
 *
 * The queries are P31-INDEXED. The earlier label-CONTAINS scan ("every
 * instance-of type whose English label contains 'novena'") walked every
 * class label in Wikidata, timed out at 60 s+ (HTTP 504), and — because the
 * seeder shares one client identity with the ingest lane — exhausted the
 * per-client WDQS budget so the SAINT ingest got 429s right after it.
 */

import type { ChecklistContentType, PrismaClient } from "@prisma/client";

import { bindingValue, runSparql } from "./wikidata";
import { persistSourceCooldown, readSourceCooldownMs } from "./source-cooldown";

const THROTTLE_MS = 30 * 60 * 1000; // every ~30 min is plenty for seeding
const THROTTLE_KEY = "discovery-seeder-lastrun";
const CURSOR_PREFIX = "discovery-seed-cursor:";

interface SeedQuery {
  id: string;
  contentType: ChecklistContentType;
  /**
   * Returns entities of the type with their official website (P856),
   * described-at URL (P973), and English Wikipedia article. Discovery may
   * over-reach because the downstream classifier + QA decide what actually
   * publishes — but the enumeration itself must hit an index.
   */
  sparql(limit: number, offset: number): string;
}

/**
 * Seed query over `?x wdt:P31 ?type` for an explicit list of class items
 * (optionally with subclasses via P279*).
 */
function seedSparql(typePattern: string): (limit: number, offset: number) => string {
  return (limit, offset) =>
    `SELECT ?x (SAMPLE(?website) AS ?site) (SAMPLE(?described) AS ?desc) (SAMPLE(?article) AS ?art) WHERE {
  ${typePattern}
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
    id: "seed-apparitions",
    contentType: "APPARITION",
    // Marian apparition (Q507850) and its subclasses.
    sparql: seedSparql(`?x wdt:P31/wdt:P279* wd:Q507850 .`),
  },
  {
    id: "seed-novenas",
    contentType: "NOVENA",
    // novena (Q1122496).
    sparql: seedSparql(`?x wdt:P31 wd:Q1122496 .`),
  },
  {
    id: "seed-prayers",
    contentType: "PRAYER",
    // Catholic prayer (Q5053303) · Christian prayer (Q3627146) · litany (Q240709).
    sparql: seedSparql(
      `VALUES ?type { wd:Q5053303 wd:Q3627146 wd:Q240709 }
  ?x wdt:P31 ?type .`,
    ),
  },
];

/** The registered seed ids (for tests / diagnostics). */
export const DISCOVERY_SEED_IDS = SEED_QUERIES.map((s) => s.id);

/** The SPARQL a seed would issue (for tests / diagnostics). */
export function discoverySeedSparql(id: string, limit = 15, offset = 0): string | null {
  const seed = SEED_QUERIES.find((s) => s.id === id);
  return seed ? seed.sparql(limit, offset) : null;
}

export interface DiscoverySeedResult {
  enabled: boolean;
  entities: number;
  enqueued: number;
  bySeed: Record<string, number>;
  /** Set when a seed's SPARQL failed (its cursor was left unchanged). */
  sourceFailure: string | null;
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
    sourceFailure: null,
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
  // Share the ingest lane's cool-down: if the query service is throttling this
  // client, seeding can wait — it must not be the thing that starves the
  // SAINT ingest of its query budget.
  const coolingMs = await readSourceCooldownMs(prisma);
  if (coolingMs > 0) {
    out.detail = `structured source cooling for ${Math.ceil(coolingMs / 1000)}s; seeding skipped.`;
    return out;
  }

  const batch = opts.batch ?? 15;
  const { discoverCandidate } = await import("../web-navigator");

  for (const seed of SEED_QUERIES) {
    const offset = await readCursor(prisma, seed.id);
    let rows: Awaited<ReturnType<typeof runSparql>> = null;
    try {
      rows = await runSparql(seed.sparql(batch, offset));
    } catch {
      rows = null;
    }
    out.bySeed[seed.id] = 0;
    if (rows === null) {
      // Failure ≠ end of corpus: keep this seed's cursor, persist the
      // cool-down, and stop issuing further queries this pass.
      out.sourceFailure = seed.id;
      await persistSourceCooldown(prisma);
      break;
    }
    out.entities += rows.length;

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

  out.detail = `seeded ${out.enqueued} candidate URL(s) from ${out.entities} entit(y/ies) across ${SEED_QUERIES.length} type(s)${
    out.sourceFailure ? ` (source failed at ${out.sourceFailure}; cursor held)` : ""
  }.`;
  return out;
}
