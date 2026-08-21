/**
 * Adaptive source acquisition (spec §16, and the "eyes" of §14).
 *
 * The worker already owns every reader it needs — a static fetcher, a headless
 * renderer, structured-data extractors, Wikidata/Wikipedia/Overpass ingestors,
 * RSS and sitemap discovery, a PDF extractor, and a durable source-read cache.
 * What it lacked was a single place that decides *which* of them to use for a
 * given target, cheapest-first, and that remembers what actually worked.
 *
 * This planner does exactly that and nothing else — it never fetches. It
 * returns an ordered plan of methods with an estimated cost, so the caller
 * (dispatcher stage, file ingestion, a manual operator pass) can walk the plan
 * and stop as soon as it has what it needs:
 *
 *   1. `durable-read`      reuse the stored source read (free)
 *   2. `conditional-http`  revalidate with ETag / If-Modified-Since (cheap)
 *   3. `structured-api`    a JSON/SPARQL/Overpass endpoint (cheap, precise)
 *   4. `feed`              RSS / Atom (cheap, change-oriented)
 *   5. `sitemap`           XML sitemap / sitemap index (cheap, navigational)
 *   6. `static-http`       plain HTML GET (normal)
 *   7. `pdf`               PDF document extraction (heavier)
 *   8. `dynamic-browser`   headless Chromium render (expensive — last resort)
 *   9. `archive`           archived copy when the origin is gone
 *
 * Learning: outcomes are recorded into the existing per-method strategy memory
 * (`method-memory.ts`, dimension "acquisition") plus a per-host preference in
 * `AdminWorkerMemory`, so "for this host, the JSON endpoint always works" and
 * "this host needs a browser" become durable knowledge rather than a fresh
 * guess every pass. No new tables, no new environment variables.
 */

import type { PrismaClient } from "@prisma/client";

import { senseUrl, type UrlChangeSense } from "./change-sensing";
import { rankMethods, recordMethodOutcome } from "./method-memory";

export type AcquisitionMethod =
  | "durable-read"
  | "conditional-http"
  | "structured-api"
  | "feed"
  | "sitemap"
  | "static-http"
  | "pdf"
  | "dynamic-browser"
  | "archive"
  | "operator-file";

/** Relative cost of each reader: local CPU + memory + network + wall time. */
export const METHOD_COST: Record<AcquisitionMethod, number> = {
  "durable-read": 0.01,
  "conditional-http": 0.05,
  "structured-api": 0.15,
  feed: 0.15,
  sitemap: 0.2,
  "static-http": 0.3,
  pdf: 0.6,
  "dynamic-browser": 1.0,
  archive: 0.5,
  "operator-file": 0.1,
};

const MEMORY_TYPE = "GENERIC" as const;
const HOST_STRATEGY_PREFIX = "acquisition.host.";
const DIMENSION = "acquisition";

export interface AcquisitionStep {
  method: AcquisitionMethod;
  /** 0..1 estimated probability this method yields usable material. */
  successProbability: number;
  /** Relative resource cost (see METHOD_COST). */
  cost: number;
  /** successProbability / cost — higher is better value. */
  value: number;
  reason: string;
}

export interface AcquisitionPlan {
  url: string;
  host: string;
  contentType: string | null;
  steps: AcquisitionStep[];
  /** The change sense used to build the plan. */
  sense: UrlChangeSense;
  /** True when nothing needs fetching at all right now. */
  satisfiedByCache: boolean;
  rationale: string;
}

export interface HostStrategyMemory {
  preferred: AcquisitionMethod | null;
  /** Methods that repeatedly failed for this host. */
  discouraged: AcquisitionMethod[];
  /** Whether static HTML was observed to be JS-only (needs a browser). */
  requiresBrowser: boolean;
  /** Structured endpoints observed to work for this host. */
  structuredEndpoints: string[];
  updatedAt: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

export async function recallHostStrategy(
  prisma: PrismaClient,
  host: string,
): Promise<HostStrategyMemory | null> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: {
        memoryType_memoryKey: {
          memoryType: MEMORY_TYPE,
          memoryKey: `${HOST_STRATEGY_PREFIX}${host}`,
        },
      },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = row?.memoryValue;
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const rec = v as Record<string, unknown>;
  return {
    preferred: (rec.preferred as AcquisitionMethod) ?? null,
    discouraged: Array.isArray(rec.discouraged) ? (rec.discouraged as AcquisitionMethod[]) : [],
    requiresBrowser: rec.requiresBrowser === true,
    structuredEndpoints: Array.isArray(rec.structuredEndpoints)
      ? (rec.structuredEndpoints as string[])
      : [],
    updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : new Date(0).toISOString(),
  };
}

async function writeHostStrategy(
  prisma: PrismaClient,
  host: string,
  next: HostStrategyMemory,
): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: {
        memoryType_memoryKey: {
          memoryType: MEMORY_TYPE,
          memoryKey: `${HOST_STRATEGY_PREFIX}${host}`,
        },
      },
      create: {
        memoryType: MEMORY_TYPE,
        memoryKey: `${HOST_STRATEGY_PREFIX}${host}`,
        memoryValue: next as never,
        confidence: 0.6,
        lastUsedAt: new Date(),
      },
      update: { memoryValue: next as never, lastUsedAt: new Date() },
    })
    .catch(() => undefined);
}

/** Signals a caller may already know about the target before planning. */
export interface AcquisitionHints {
  contentType?: string | null;
  /** The URL looks like a PDF / the response advertised application/pdf. */
  isPdf?: boolean;
  /** A feed URL was discovered for this target. */
  feedUrl?: string | null;
  /** A sitemap covering this target is known. */
  sitemapUrl?: string | null;
  /** A structured (JSON / SPARQL / Overpass) endpoint is known. */
  structuredEndpoint?: string | null;
  /** A previous static read produced almost no prose (JS-rendered page). */
  staticBodyWasEmpty?: boolean;
  /** The origin returned 404/410 previously and an archive copy may exist. */
  originGone?: boolean;
  /** Skip the cache short-circuit (operator forced a fresh read). */
  force?: boolean;
}

/**
 * Build the ordered acquisition plan for one target.
 */
export async function planAcquisition(
  prisma: PrismaClient,
  input: { url: string; hints?: AcquisitionHints },
): Promise<AcquisitionPlan> {
  const hints = input.hints ?? {};
  const host = hostOf(input.url);
  const contentType = hints.contentType ?? null;

  const [sense, strategy, ranked] = await Promise.all([
    senseUrl(prisma, input.url, { force: hints.force }),
    recallHostStrategy(prisma, host),
    rankMethods(prisma, { dimension: DIMENSION, contentType }),
  ]);

  const learned = new Map(ranked.map((r) => [r.method as AcquisitionMethod, r]));

  const steps: AcquisitionStep[] = [];
  const push = (method: AcquisitionMethod, base: number, reason: string) => {
    if (strategy?.discouraged.includes(method)) return;
    const stat = learned.get(method);
    // Blend the prior with what this worker has actually observed.
    const probability = stat
      ? Math.max(0.05, Math.min(0.98, base * 0.4 + stat.ewma * 0.6))
      : Math.max(0.05, Math.min(0.98, base));
    const cost = METHOD_COST[method];
    steps.push({
      method,
      successProbability: Number(probability.toFixed(3)),
      cost,
      value: Number((probability / cost).toFixed(3)),
      reason: stat
        ? `${reason} (observed success ${(stat.ewma * 100).toFixed(0)}% over ${stat.attempts} attempt(s))`
        : reason,
    });
  };

  // 1. Free: the durable read still covers this URL.
  if (!sense.shouldRead) {
    push("durable-read", 0.95, `no re-read needed — ${sense.reason}`);
  }

  // 2. Cheap revalidation whenever we hold validators.
  if (sense.conditionalHeaders["If-None-Match"] || sense.conditionalHeaders["If-Modified-Since"]) {
    push(
      "conditional-http",
      0.9,
      "stored ETag/Last-Modified allows a 304 revalidation instead of a full download",
    );
  }

  // 3. Structured endpoints beat HTML whenever one exists.
  const structured = hints.structuredEndpoint ?? strategy?.structuredEndpoints[0] ?? null;
  if (structured) {
    push("structured-api", 0.85, `structured endpoint known for this host (${structured})`);
  }

  // 4/5. Change-oriented and navigational readers.
  if (hints.feedUrl) push("feed", 0.7, `feed advertised for this source (${hints.feedUrl})`);
  if (hints.sitemapUrl) push("sitemap", 0.6, `sitemap covers this target (${hints.sitemapUrl})`);

  // 6. Documents.
  if (hints.isPdf || /\.pdf($|\?)/i.test(input.url)) {
    push("pdf", 0.8, "target is a PDF document — use the PDF extractor, not the HTML parser");
  }

  // 7. The ordinary case.
  if (!hints.originGone) {
    const jsOnly = hints.staticBodyWasEmpty === true || strategy?.requiresBrowser === true;
    push(
      "static-http",
      jsOnly ? 0.2 : 0.75,
      jsOnly
        ? "static HTML previously came back empty for this host — likely a JS-rendered page"
        : "plain HTML GET is the cheapest complete reader for this target",
    );
    // 8. Expensive last resort.
    push(
      "dynamic-browser",
      jsOnly ? 0.8 : 0.35,
      jsOnly
        ? "host needs client-side rendering — headless Chromium is justified here"
        : "headless render only if the cheaper readers return no usable prose",
    );
  }

  // 9. Origin gone → archived copy.
  if (hints.originGone) {
    push("archive", 0.5, "origin returned gone/unreachable — try the archived copy");
  }

  // Preferred method from memory floats to the top when it is in the plan.
  steps.sort((a, b) => {
    if (strategy?.preferred) {
      if (a.method === strategy.preferred && b.method !== strategy.preferred) return -1;
      if (b.method === strategy.preferred && a.method !== strategy.preferred) return 1;
    }
    return b.value - a.value;
  });

  const satisfiedByCache = !sense.shouldRead && steps[0]?.method === "durable-read";

  return {
    url: input.url,
    host,
    contentType,
    steps,
    sense,
    satisfiedByCache,
    rationale: satisfiedByCache
      ? `Cache-satisfied: ${sense.reason}`
      : `Cheapest-first plan: ${steps.map((s) => s.method).join(" → ") || "no reader available"}.`,
  };
}

/**
 * Record what actually happened so the next plan is better. Updates both the
 * per-method strategy stats and the per-host preference memory.
 */
export async function recordAcquisitionOutcome(
  prisma: PrismaClient,
  input: {
    url: string;
    method: AcquisitionMethod;
    ok: boolean;
    contentType?: string | null;
    reason?: string;
    /** Set when the static body turned out to be a JS shell. */
    observedJsOnly?: boolean;
    /** Set when a structured endpoint proved usable for this host. */
    structuredEndpoint?: string | null;
  },
): Promise<void> {
  const host = hostOf(input.url);
  await recordMethodOutcome(prisma, {
    dimension: DIMENSION,
    method: input.method,
    contentType: input.contentType ?? null,
    ok: input.ok,
    reason: input.reason,
  });
  if (!host) return;

  const prior = (await recallHostStrategy(prisma, host)) ?? {
    preferred: null,
    discouraged: [],
    requiresBrowser: false,
    structuredEndpoints: [],
    updatedAt: new Date(0).toISOString(),
  };

  const discouraged = new Set(prior.discouraged);
  if (input.ok) discouraged.delete(input.method);

  const structuredEndpoints = new Set(prior.structuredEndpoints);
  if (input.structuredEndpoint && input.ok) structuredEndpoints.add(input.structuredEndpoint);

  const next: HostStrategyMemory = {
    // A method that just worked becomes the host's preferred entry point.
    preferred: input.ok ? input.method : prior.preferred,
    discouraged: Array.from(discouraged).slice(0, 8),
    requiresBrowser: input.observedJsOnly === true ? true : prior.requiresBrowser,
    structuredEndpoints: Array.from(structuredEndpoints).slice(0, 8),
    updatedAt: new Date().toISOString(),
  };
  await writeHostStrategy(prisma, host, next);
}

/**
 * Mark a method as unproductive for a host after repeated failures, so the
 * planner stops offering it. Called by callers that see a hard, repeated
 * failure (not a single transient one).
 */
export async function discourageMethod(
  prisma: PrismaClient,
  input: { url: string; method: AcquisitionMethod; reason: string },
): Promise<void> {
  const host = hostOf(input.url);
  if (!host) return;
  const prior = (await recallHostStrategy(prisma, host)) ?? {
    preferred: null,
    discouraged: [],
    requiresBrowser: false,
    structuredEndpoints: [],
    updatedAt: new Date(0).toISOString(),
  };
  const discouraged = new Set(prior.discouraged);
  discouraged.add(input.method);
  await writeHostStrategy(prisma, host, {
    ...prior,
    preferred: prior.preferred === input.method ? null : prior.preferred,
    discouraged: Array.from(discouraged).slice(0, 8),
    updatedAt: new Date().toISOString(),
  });
}
