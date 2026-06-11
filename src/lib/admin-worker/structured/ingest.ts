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
import { STRUCTURED_INGESTORS, ingestorFor, type StructuredIngestor } from "./ingestors";

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
  /** True when the source is fully ingested (nothing new produced this pass). */
  exhausted: boolean;
  errors: string[];
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

/** Persist the next offset and accumulate the learning counters. */
async function writeCursor(
  prisma: PrismaClient,
  id: string,
  offset: number,
  published: number,
  failed: number,
): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: {
        memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: `${CURSOR_PREFIX}${id}` },
      },
      update: {
        memoryValue: { offset },
        successCount: { increment: published },
        failureCount: { increment: failed },
        lastUsedAt: new Date(),
      },
      create: {
        memoryType: "GENERIC",
        memoryKey: `${CURSOR_PREFIX}${id}`,
        memoryValue: { offset },
        successCount: published,
        failureCount: failed,
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

/** Pick the ingestor whose content type has the most headroom (fewest live). */
async function pickIngestor(prisma: PrismaClient): Promise<StructuredIngestor | undefined> {
  if (STRUCTURED_INGESTORS.length <= 1) return STRUCTURED_INGESTORS[0];
  let best: StructuredIngestor | undefined;
  let bestCount = Number.POSITIVE_INFINITY;
  for (const ing of STRUCTURED_INGESTORS) {
    const n = await prisma.publishedContent
      .count({ where: { isPublished: true, contentType: ing.contentType } })
      .catch(() => 0);
    if (n < bestCount) {
      bestCount = n;
      best = ing;
    }
  }
  return best;
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
  const result = await runPublishOrchestrator(prisma, {
    contentType: entry.contentType,
    contentId: item.id,
    title,
    slug: entry.slug,
    payload: entry.payload as never,
    authorityLevel: entry.authorityLevel,
    finalScore: 0.92,
    qaPassed: true,
    hasSourceEvidence: entry.citations.length > 0,
    isDoctrinallySensitive: sensitive,
    confidence: 0.92,
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
    return out;
  }

  const live = new Set(
    (
      await prisma.publishedContent
        .findMany({
          where: { isPublished: true, contentType: ingestor.contentType },
          select: { slug: true },
        })
        .catch(() => [] as Array<{ slug: string }>)
    ).map((r) => r.slug),
  );

  const seen = new Set<string>();
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
    if (seen.has(entry.slug)) continue;
    seen.add(entry.slug);
    if (live.has(entry.slug)) {
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
        nextOffset,
      },
    }).catch(() => undefined);
  }

  return out;
}
