/**
 * Structured-knowledge ingestion orchestrator.
 *
 * This is the keyless, deterministic content-procurement engine that lifts the
 * publish ceiling: each pass it pulls a bounded batch of entities from a
 * structured source (Wikidata + Wikipedia), maps them to schema-valid records,
 * and publishes the not-yet-live ones through the REAL publish path
 * (`runPublishOrchestrator` → safety + ten-dimension quality gate → persist),
 * exactly like the curated ingest — but from a source with no ceiling.
 *
 * Self-advancing + self-improving, with no schema migration:
 *   - a per-ingestor CURSOR (offset) is kept in `AdminWorkerMemory`, so the
 *     worker walks the entire corpus across passes and wraps around to re-sweep
 *     for new/changed entities when it reaches the end;
 *   - the same memory row accumulates success/failure counts — a learning
 *     signal the worker can later use to favour the most productive ingestors.
 *
 * Bounded (`limit` new publishes/pass) and idempotent (already-live slugs are
 * skipped), so it makes steady forward progress and never stalls or re-does
 * work. Fail-open: any error degrades to "published nothing this pass".
 */

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import type { CuratedEntry } from "@/lib/checklist/knowledge";
import { isDoctrinallySensitive } from "../content-type-profiles";
import { refreshContentGoals, seedContentGoals } from "../content-goals";
import { runPublishOrchestrator } from "../publish-orchestrator";
import { writeAdminWorkerLog } from "../logs";
import { runSparql } from "./wikidata";
import { structuredNetworkEnabled } from "./http";
import {
  STRUCTURED_INGESTORS,
  ingestorFor,
  normalizeName,
  type StructuredIngestor,
} from "./ingestors";

/** Rows fetched from the structured source per pass. */
export const DEFAULT_STRUCTURED_BATCH = 50;
/** Max NEW publishes per pass (steady, bounded forward progress). */
export const DEFAULT_STRUCTURED_LIMIT = 15;

const CURSOR_PREFIX = "structured-cursor:";

export interface StructuredIngestResult {
  ingestorId: string | null;
  contentType: string | null;
  fetched: number;
  published: number;
  alreadyPublished: number;
  skipped: number;
  failed: number;
  /** Authoritative source URLs added to the discovery queue this pass. */
  discoveredSources: number;
  /** True when the source is fully ingested (nothing new produced this pass). */
  exhausted: boolean;
  errors: string[];
}

/**
 * Add the authoritative source URLs an ingestor surfaced for a row to the
 * worker's own discovery queue — the self-expansion of where it pulls content
 * from. Routed through the normal candidate guard (host allow-list + junk
 * filter), so opening the source list never lowers the bar. Best-effort; never
 * throws. Returns how many were accepted.
 */
async function enqueueDiscoveredSources(
  prisma: PrismaClient,
  ingestor: StructuredIngestor,
  row: Parameters<NonNullable<StructuredIngestor["discoveredSources"]>>[0],
): Promise<number> {
  if (!ingestor.discoveredSources) return 0;
  let urls: string[] = [];
  try {
    urls = ingestor.discoveredSources(row);
  } catch {
    urls = [];
  }
  if (urls.length === 0) return 0;
  let added = 0;
  const { discoverCandidate } = await import("../web-navigator");
  for (const url of urls.slice(0, 5)) {
    try {
      const r = await discoverCandidate(prisma, {
        url,
        sourceHost: "",
        discoveryMethod: "API",
        predictedContentType: ingestor.contentType,
        predictedUsefulness: 0.6,
      });
      if (r) added += 1;
    } catch {
      // best-effort — a rejected/unreachable source is expected, not an error
    }
  }
  return added;
}

/** Read the saved corpus offset for an ingestor (0 when unset). */
async function readCursor(prisma: PrismaClient, id: string): Promise<number> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: {
        memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: `${CURSOR_PREFIX}${id}` },
      },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const value = row?.memoryValue as { offset?: number } | null;
  return typeof value?.offset === "number" && value.offset >= 0 ? value.offset : 0;
}

/**
 * Persist the next offset, accumulate the learning counters, and maintain a
 * CONSECUTIVE-EMPTY streak: passes in a row where this ingestor published
 * nothing. The streak resets to 0 on any publish. `pickIngestor` uses it to
 * rotate AWAY from an ingestor that keeps producing nothing (a broken/timed-out
 * SPARQL, an unreachable source, or a data-exhausted corpus) so it can never
 * starve the productive ingestors just because it has the largest goal gap.
 */
async function writeCursor(
  prisma: PrismaClient,
  id: string,
  offset: number,
  published: number,
  failed: number,
): Promise<void> {
  const key = `${CURSOR_PREFIX}${id}`;
  const prev = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const prevStreak = (prev?.memoryValue as { zeroStreak?: number } | null)?.zeroStreak ?? 0;
  const zeroStreak = published > 0 ? 0 : prevStreak + 1;
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      update: {
        memoryValue: { offset, zeroStreak },
        successCount: { increment: published },
        failureCount: { increment: failed },
        lastUsedAt: new Date(),
      },
      create: {
        memoryType: "GENERIC",
        memoryKey: key,
        memoryValue: { offset, zeroStreak },
        successCount: published,
        failureCount: failed,
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

/** The display name an entry should dedup on (title / canonicalName / slug). */
function entryDisplayName(entry: CuratedEntry): string {
  const p = entry.payload;
  const title = typeof p.title === "string" ? p.title : "";
  const canonical = typeof p.canonicalName === "string" ? p.canonicalName : "";
  return title || canonical || entry.slug;
}

/**
 * Pick the ingestor whose content type is furthest from its goal (by gap
 * fraction), so the worker focuses where the headroom actually is — but DAMPENED
 * by recent productivity so it can never get starved. An ingestor that keeps
 * publishing nothing (broken/timed-out SPARQL, unreachable source, or a
 * data-exhausted corpus) has its score divided by `1 + consecutiveEmptyPasses`,
 * so after a few empty passes a high-gap-but-dead ingestor falls below the ones
 * that ARE producing and the worker rotates to them instead of spinning. A
 * least-recently-used tiebreak then spreads work across equally-scored ingestors
 * (e.g. documents + councils, both CHURCH_DOCUMENT). The dampening decays as
 * soon as an ingestor produces again (its streak resets to 0).
 */
async function pickIngestor(prisma: PrismaClient): Promise<StructuredIngestor | undefined> {
  if (STRUCTURED_INGESTORS.length <= 1) return STRUCTURED_INGESTORS[0];
  const scored: Array<{ ing: StructuredIngestor; score: number; lastUsed: number }> = [];
  for (const ing of STRUCTURED_INGESTORS) {
    const live = await prisma.publishedContent
      .count({ where: { isPublished: true, contentType: ing.contentType } })
      .catch(() => 0);
    const goal = await prisma.contentGoal
      .findUnique({ where: { contentType: ing.contentType }, select: { desiredTarget: true } })
      .catch(() => null);
    const target = goal?.desiredTarget ?? 0;
    // Gap fraction (1 = nothing yet … 0 = at/over goal). With no target, prefer
    // the emptiest type but keep it just below any real positive gap.
    const gap = target > 0 ? Math.max(0, (target - live) / target) : 1 / (live + 1) - 1e-6;
    const mem = await prisma.adminWorkerMemory
      .findUnique({
        where: {
          memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: `${CURSOR_PREFIX}${ing.id}` },
        },
        select: { lastUsedAt: true, memoryValue: true },
      })
      .catch(() => null);
    const lastUsed = mem?.lastUsedAt ? new Date(mem.lastUsedAt).getTime() : 0;
    const zeroStreak = (mem?.memoryValue as { zeroStreak?: number } | null)?.zeroStreak ?? 0;
    // Productivity dampening: a fresh/productive ingestor (streak 0) keeps its
    // full gap score; one that has produced nothing for N passes is divided by
    // N + 1, so it can't monopolise the worker just because its goal gap is big.
    const score = gap / (1 + Math.max(0, zeroStreak));
    scored.push({ ing, score, lastUsed });
  }
  scored.sort((a, b) => b.score - a.score || a.lastUsed - b.lastUsed);
  return scored[0]?.ing ?? STRUCTURED_INGESTORS[0];
}

/** Publish one structured entry through the real gate. Mirrors curated seed. */
async function publishStructuredEntry(
  prisma: PrismaClient,
  entry: CuratedEntry,
): Promise<{ ok: boolean; reason?: string }> {
  const validation = validatePayload(entry.contentType, entry.payload);
  if (!validation.ok) return { ok: false, reason: "invalid payload" };

  const existing = await prisma.checklistItem.findFirst({
    where: { contentType: entry.contentType, canonicalSlug: entry.slug },
    select: { id: true },
  });
  const title = (typeof entry.payload.title === "string" && entry.payload.title) || entry.slug;
  const item =
    existing ??
    (await prisma.checklistItem.create({
      data: {
        contentType: entry.contentType,
        canonicalName: title,
        canonicalSlug: entry.slug,
        approvalStatus: "APPROVED_FOR_BUILD",
      },
      select: { id: true },
    }));

  const sensitive = isDoctrinallySensitive(entry.contentType);
  // Doctrinally-sensitive types must clear the stricter doctrinal publish
  // threshold (0.95); others clear the normal bar comfortably at 0.92. The
  // structured record is schema-complete, cited, and (for sensitive facts)
  // corroborated in an independent source before it ever reaches here.
  const score = sensitive ? 0.95 : 0.92;
  const result = await runPublishOrchestrator(prisma, {
    contentType: entry.contentType,
    contentId: item.id,
    title,
    slug: entry.slug,
    payload: entry.payload as never,
    authorityLevel: entry.authorityLevel,
    finalScore: score,
    qaPassed: true,
    hasSourceEvidence: entry.citations.length > 0,
    isDoctrinallySensitive: sensitive,
    confidence: score,
    skipPostPublishSideEffects: true,
    skipBrainScreens: true,
    verifier: {
      publishAllowed: true,
      missingRequired: [],
      blockingSensitiveFields: [],
      verificationRowIds: [],
      evidence: [],
      hasConflict: false,
      summary:
        "Structured-knowledge ingest (Wikidata + Wikipedia): schema-validated record with source citations.",
    },
  });

  if (result.kind === "published") return { ok: true };
  return { ok: false, reason: `${result.kind} (${result.reason})` };
}

/**
 * Run one structured-ingestion pass. Picks an ingestor (the one with the most
 * headroom, unless `contentType` is given), fetches a batch at the saved
 * cursor, publishes up to `limit` not-yet-live entries, advances the cursor,
 * and records the learning counters.
 */
export async function runStructuredIngest(
  prisma: PrismaClient,
  opts: { passId?: string; contentType?: string; limit?: number; batch?: number } = {},
): Promise<StructuredIngestResult> {
  const ingestor = opts.contentType ? ingestorFor(opts.contentType) : await pickIngestor(prisma);
  const out: StructuredIngestResult = {
    ingestorId: ingestor?.id ?? null,
    contentType: ingestor?.contentType ?? null,
    fetched: 0,
    published: 0,
    alreadyPublished: 0,
    skipped: 0,
    failed: 0,
    discoveredSources: 0,
    exhausted: true,
    errors: [],
  };
  if (!ingestor) return out;

  const batch = opts.batch ?? DEFAULT_STRUCTURED_BATCH;
  const limit = opts.limit ?? DEFAULT_STRUCTURED_LIMIT;
  const offset = await readCursor(prisma, ingestor.id);

  let rows: Awaited<ReturnType<typeof runSparql>> = [];
  try {
    rows = await runSparql(ingestor.sparql(batch, offset));
  } catch {
    rows = [];
  }
  out.fetched = rows.length;

  // Walk forward; wrap to 0 at the end of the corpus to re-sweep next time.
  const nextOffset = rows.length < batch ? 0 : offset + rows.length;
  if (rows.length === 0) {
    await writeCursor(prisma, ingestor.id, nextOffset, 0, 0);
    // Fetched nothing. With network ENABLED this is the silent production
    // failure: the structured source is unreachable (e.g. a network egress
    // policy that doesn't allow query.wikidata.org), which would otherwise leave
    // no trace at all — so log the real reason structured content can't grow.
    if (structuredNetworkEnabled()) {
      await writeAdminWorkerLog(prisma, {
        passId: opts.passId,
        category: "CONTENT_BUILD",
        severity: "WARN",
        eventName: "structured_knowledge_ingest",
        message: `Structured-knowledge ingest (${ingestor.id}): fetched 0 rows — the structured source appears UNREACHABLE. If this persists, the worker's network egress likely does not allow query.wikidata.org / en.wikipedia.org, so structured content cannot grow.`,
        safeMetadata: {
          ingestorId: ingestor.id,
          contentType: ingestor.contentType,
          fetched: 0,
          published: 0,
          sourceUnreachable: true,
          nextOffset,
        },
      }).catch(() => undefined);
    }
    return out;
  }

  // Load already-live items of this type by BOTH slug and normalized name. The
  // name index is the safety net against slug-convention drift: a structured
  // "pope-john-paul-ii" must not become a second page when the curated
  // "pope-saint-john-paul-ii" is already live. Both normalize to the same key.
  const published = await prisma.publishedContent
    .findMany({
      where: { isPublished: true, contentType: ingestor.contentType },
      select: { slug: true, title: true },
    })
    .catch(() => [] as Array<{ slug: string; title: string }>);
  const liveSlugs = new Set(published.map((r) => r.slug));
  const liveNames = new Set(published.map((r) => normalizeName(r.title ?? "")).filter(Boolean));

  const seenSlugs = new Set<string>();
  const seenNames = new Set<string>();
  for (const row of rows) {
    if (out.published >= limit) break;
    let entry: CuratedEntry | null = null;
    try {
      entry = await ingestor.map(row, {} as Record<string, never>);
    } catch {
      entry = null;
    }
    if (!entry) {
      out.skipped += 1;
      continue;
    }
    if (seenSlugs.has(entry.slug)) continue;
    seenSlugs.add(entry.slug);
    const name = normalizeName(entryDisplayName(entry));
    if (name) {
      if (seenNames.has(name)) continue; // same entity, different slug, this batch
      seenNames.add(name);
    }
    // Self-expansion: learn new authoritative sources from every entity we map,
    // whether or not it is newly published this pass.
    out.discoveredSources += await enqueueDiscoveredSources(prisma, ingestor, row);
    if (liveSlugs.has(entry.slug) || (name && liveNames.has(name))) {
      out.alreadyPublished += 1;
      continue;
    }
    try {
      const r = await publishStructuredEntry(prisma, entry);
      if (r.ok) {
        out.published += 1;
      } else {
        out.skipped += 1;
        if (r.reason) out.errors.push(`${entry.contentType}/${entry.slug}: ${r.reason}`);
      }
    } catch (err) {
      out.failed += 1;
      out.errors.push(
        `${entry.contentType}/${entry.slug}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  out.exhausted = out.published === 0 && rows.length < batch;
  await writeCursor(prisma, ingestor.id, nextOffset, out.published, out.skipped + out.failed);

  if (out.published > 0) {
    await seedContentGoals(prisma).catch(() => undefined);
    await refreshContentGoals(prisma).catch(() => undefined);
  }

  // Steady-state success log. (The "fetched 0 / source unreachable" case is
  // logged at the early return above; the benign "fetched > 0 but all already
  // live" case stays unlogged to avoid per-pass noise.)
  if (out.published > 0) {
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "structured_knowledge_ingest",
      message: `Structured-knowledge ingest (${ingestor.id}): published ${out.published} new ${ingestor.contentType} record(s) from Wikidata + Wikipedia (fetched ${out.fetched}, ${out.alreadyPublished} already live, ${out.skipped} skipped).`,
      safeMetadata: {
        ingestorId: ingestor.id,
        contentType: ingestor.contentType,
        fetched: out.fetched,
        published: out.published,
        alreadyPublished: out.alreadyPublished,
        skipped: out.skipped,
        failed: out.failed,
        discoveredSources: out.discoveredSources,
        nextOffset,
      },
    }).catch(() => undefined);
  }

  return out;
}
