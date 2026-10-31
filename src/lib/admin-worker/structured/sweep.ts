/**
 * Operator sweep of one structured corpus — page after page through the
 * worker's own ingest pass (`runStructuredIngest`: the same mapper, the same
 * gates, the same dedup, the same `runPublishOrchestrator` publish path) until
 * the corpus is exhausted. scripts/booster/saint-sweep.ts drives it for SAINT.
 *
 * WHY. The worker's lane runs one page of one ingestor per pass, a few
 * minutes at a time, interleaved with every other ingestor; after the cursor
 * livelock is fixed the SAINT corpus (~5,400 entities) still takes it a day or
 * more. A booster walks it in one sitting without changing a single rule.
 *
 * SAFE TO RUN BESIDE THE WORKER, BY CONSTRUCTION:
 *   - a LEASE (lease.ts) makes a lease-aware worker step aside from this
 *     ingestor while the sweep runs, so the two never double the Wikipedia
 *     traffic or race on an entity; it is renewed every page and simply
 *     expires if the sweep dies;
 *   - the sweep walks its OWN cursor (`<ingestor>@booster`), never the
 *     worker's, and that cursor lives in the database — rerunning resumes
 *     where the last run stopped;
 *   - every Wikipedia / Wikimedia request in the process goes through the one
 *     serial queue in http.ts (one request in flight, Retry-After honoured),
 *     and rows are mapped one at a time;
 *   - a throttled or failing source is waited out, never hammered; a stop
 *     (Ctrl-C) finishes the page in hand.
 *
 * Writes: what the ingest pass writes (published content, its cursor, its
 * rejection memory and its `structured_knowledge_ingest` log row per page),
 * the lease, and one `booster_structured_sweep` AdminWorkerLog row at the
 * start and at the end.
 */

import { hostname } from "node:os";

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "../logs";
import { readStructuredCursor, rewindStructuredCursor, runStructuredIngest } from "./ingest";
import { ingestorFor } from "./ingestors";
import { acquireIngestorLease, releaseIngestorLease } from "./lease";
import {
  formatRejections,
  tallyRejection,
  type RejectionCode,
  type RejectionHistogram,
} from "./reject";
import { readSourceCooldownMs } from "./source-cooldown";

export interface StructuredSweepOptions {
  /** The content type whose structured ingestor is swept (SAINT). */
  contentType: string;
  /** Page size (clamped by the ingestor's maxPageSize; 200 for SAINT). */
  batch?: number;
  /** Max new publishes per page (default: the page size, so a page is finished in one pass). */
  limit?: number;
  /** Stop after this many passes (a trial run). Default: until the corpus is exhausted. */
  maxPages?: number;
  /** Wall-clock budget of one pass (default 30 minutes); a page cut short is resumed. */
  pageBudgetMs?: number;
  /** Start over from offset 0 (and end a finished sweep's rest). */
  restart?: boolean;
  /** End the cursor's rest but keep its offset (after the source was declared unusable). */
  wake?: boolean;
  /** Lease holder name (default `<ingestor>-sweep@<host>:<pid>`). */
  holder?: string;
  /** Checked between pages: true asks the sweep to stop after the page in hand. */
  shouldStop?: () => boolean;
  /** Progress lines. */
  log?: (line: string) => void;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export type SweepStop =
  | "corpus_exhausted"
  | "max_pages"
  | "stopped"
  | "resting"
  | "leased_elsewhere"
  | "source_unavailable"
  | "wikipedia_unavailable"
  | "stalled"
  | "unknown_content_type"
  | "failed";

export interface StructuredSweepResult {
  ingestorId: string | null;
  cursorId: string | null;
  holder: string;
  stop: SweepStop;
  /** Human-readable reason for the stop. */
  detail: string;
  pages: number;
  startOffset: number | null;
  endOffset: number | null;
  fetched: number;
  published: number;
  alreadyPublished: number;
  rejectionsDeferred: number;
  skipped: number;
  failed: number;
  skipReasons: RejectionHistogram;
  elapsedMs: number;
  /** Set (ISO time) when the worker ran this ingestor despite the lease. */
  workerIgnoringLease: string | null;
}

/** Lease time-to-live past the page budget: a page in hand never outlives it. */
const LEASE_MARGIN_MS = 10 * 60 * 1000;
/** Pause after a page held because Wikipedia kept failing. */
const WIKIPEDIA_PAUSE_MS = 2 * 60 * 1000;
/** Consecutive Wikipedia-held pages after which the sweep stops (resumable). */
const MAX_WIKIPEDIA_HOLDS = 5;
/** Longest the sweep waits for the Query Service to come back before stopping. */
const MAX_SOURCE_WAIT_MS = 30 * 60 * 1000;
/** Poll interval while the Query Service cools down. */
const SOURCE_POLL_MS = 60 * 1000;
/**
 * Passes in a row that read a page yet moved nothing — the cursor did not
 * step and no row was mapped — before the sweep stops. Such a pass held its
 * page without working on it (a budget spent before the first row), and
 * every repeat asks the Query Service for the same page again.
 */
const MAX_IDLE_PASSES = 3;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The cursor a booster walks for an ingestor (never the worker's own). */
export function boosterCursorId(ingestorId: string): string {
  return `${ingestorId}@booster`;
}

/**
 * How long after taking the lease a worker pass may still finish and log: one
 * that STARTED before the lease. A SAINT pass logged later than this came from
 * a worker that does not honour leases (a deploy older than this branch).
 */
const WORKER_PASS_GRACE_MS = 7 * 60 * 1000;

/**
 * When did the worker last log a pass of this ingestor on ITS OWN cursor since
 * `since`? A lease-aware worker never does while the sweep holds the lease;
 * the sweep's own passes are logged "(<ingestor> via <cursor>)" and do not
 * match. Fail-open (null).
 */
async function workerPassSince(
  prisma: PrismaClient,
  ingestorId: string,
  since: Date,
): Promise<Date | null> {
  try {
    const row = await prisma.adminWorkerLog.findFirst({
      where: {
        eventName: "structured_knowledge_ingest",
        createdAt: { gt: since },
        message: { startsWith: `Structured-knowledge ingest (${ingestorId}):` },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  } catch {
    return null;
  }
}

/**
 * Sweep a structured corpus to its end. Never throws for a source problem: it
 * waits, then stops with a resumable reason. Always releases its lease.
 */
export async function runStructuredSweep(
  prisma: PrismaClient,
  opts: StructuredSweepOptions,
): Promise<StructuredSweepResult> {
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? Date.now;
  const log = opts.log ?? (() => undefined);
  const startedAt = now();
  const ingestor = ingestorFor(opts.contentType);
  const holder =
    opts.holder ?? `${ingestor?.id ?? opts.contentType}-sweep@${hostname()}:${process.pid}`;
  const out: StructuredSweepResult = {
    ingestorId: ingestor?.id ?? null,
    cursorId: ingestor ? boosterCursorId(ingestor.id) : null,
    holder,
    stop: "unknown_content_type",
    detail: `no structured ingestor for ${opts.contentType}`,
    pages: 0,
    startOffset: null,
    endOffset: null,
    fetched: 0,
    published: 0,
    alreadyPublished: 0,
    rejectionsDeferred: 0,
    skipped: 0,
    failed: 0,
    skipReasons: {},
    elapsedMs: 0,
    workerIgnoringLease: null,
  };
  if (!ingestor) return out;
  const cursorId = boosterCursorId(ingestor.id);
  const pageBudgetMs = opts.pageBudgetMs ?? 30 * 60 * 1000;
  const leaseTtl = pageBudgetMs + LEASE_MARGIN_MS;

  const leaseTakenAt = now();
  const lease = await acquireIngestorLease(prisma, ingestor.id, holder, leaseTtl, leaseTakenAt);
  if (!lease.ok) {
    out.stop = "leased_elsewhere";
    out.detail = `${ingestor.id} is leased to ${lease.lease?.holder} until ${new Date(lease.lease?.until ?? 0).toISOString()}`;
    return out;
  }

  try {
    if (opts.restart || opts.wake) {
      await rewindStructuredCursor(prisma, cursorId, { keepOffset: !opts.restart });
      log(opts.restart ? `cursor ${cursorId} rewound to 0` : `cursor ${cursorId} woken`);
    }
    const start = await readStructuredCursor(prisma, cursorId);
    out.startOffset = start.offset;
    out.endOffset = start.offset;
    log(
      `sweeping ${ingestor.id} (${ingestor.contentType}) on ${cursorId} from offset ${start.offset}` +
        `, holder ${holder}`,
    );
    await writeAdminWorkerLog(prisma, {
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "booster_structured_sweep",
      contentType: ingestor.contentType,
      message: `Structured sweep of ${ingestor.id} started at offset ${start.offset} (${cursorId}, ${holder}).`,
      safeMetadata: {
        phase: "start",
        ingestorId: ingestor.id,
        cursorId,
        holder,
        offset: start.offset,
      },
    }).catch(() => undefined);

    let wikipediaHolds = 0;
    let idlePasses = 0;
    let sourceWaitStartedAt: number | null = null;
    let lastFailure: string | null = null;
    for (;;) {
      if (opts.shouldStop?.()) {
        out.stop = "stopped";
        out.detail = "stopped on request; rerun to resume";
        break;
      }
      if (opts.maxPages != null && out.pages >= opts.maxPages) {
        out.stop = "max_pages";
        out.detail = `stopped after ${out.pages} page(s) as asked; rerun to resume`;
        break;
      }
      const renewed = await acquireIngestorLease(prisma, ingestor.id, holder, leaseTtl, now());
      if (!renewed.ok) {
        out.stop = "leased_elsewhere";
        out.detail = `lost the lease to ${renewed.lease?.holder}`;
        break;
      }

      const r = await runStructuredIngest(prisma, {
        contentType: ingestor.contentType,
        cursorId,
        leaseHolder: holder,
        batch: opts.batch,
        limit: opts.limit ?? opts.batch ?? ingestor.maxPageSize ?? 200,
        budgetMs: pageBudgetMs,
      });

      // ── Nothing ran: the source is cooling, the cursor rests, or a lease ──
      if (r.leasedTo) {
        out.stop = "leased_elsewhere";
        out.detail = `${ingestor.id} is leased to ${r.leasedTo}`;
        break;
      }
      if (r.restingUntil != null) {
        // A finished sweep wraps the cursor to 0; one resting anywhere else was
        // parked by the ingest after the Query Service kept failing.
        const unusable = lastFailure != null || (out.endOffset ?? 0) > 0;
        out.stop = "resting";
        out.detail = unusable
          ? `the source was declared unusable (${lastFailure ?? "earlier run"}) at offset ${out.endOffset}; resting until ${new Date(r.restingUntil).toISOString()}, rerun with --wake to resume now`
          : `the corpus was swept; resting until ${new Date(r.restingUntil).toISOString()}, rerun with --restart to sweep again`;
        break;
      }
      if (r.sourceCooling || r.sourceFailure) {
        lastFailure = r.sourceFailure ?? lastFailure;
        sourceWaitStartedAt ??= now();
        if (now() - sourceWaitStartedAt >= MAX_SOURCE_WAIT_MS) {
          out.stop = "source_unavailable";
          out.detail = `the Wikidata Query Service did not recover in ${Math.round(MAX_SOURCE_WAIT_MS / 60000)} min (${lastFailure ?? "cooling"}); rerun to resume`;
          break;
        }
        const coolingMs = await readSourceCooldownMs(prisma).catch(() => 0);
        const wait = Math.min(Math.max(coolingMs, SOURCE_POLL_MS), MAX_SOURCE_WAIT_MS);
        log(
          `source ${r.sourceFailure ? `failed (${r.sourceFailure})` : "cooling"}; waiting ${Math.round(wait / 1000)}s`,
        );
        await sleep(wait);
        continue;
      }
      sourceWaitStartedAt = null;
      lastFailure = null;

      // ── A page was read ────────────────────────────────────────────────────
      const offsetBefore = out.endOffset;
      out.pages += 1;
      out.fetched += r.fetched;
      out.published += r.published;
      out.alreadyPublished += r.alreadyPublished;
      out.rejectionsDeferred += r.rejectionsDeferred;
      out.skipped += r.skipped;
      out.failed += r.failed;
      for (const [code, n] of Object.entries(r.skipReasons) as Array<[RejectionCode, number]>) {
        for (let i = 0; i < n; i += 1) tallyRejection(out.skipReasons, code);
      }
      if (r.nextOffset != null) out.endOffset = r.nextOffset;
      const elapsedH = Math.max((now() - startedAt) / 3_600_000, 1 / 3600);
      log(
        `page ${out.pages} → offset ${out.endOffset}: ${r.fetched} fetched, ${r.alreadyPublished} live, ` +
          `${r.rejectionsDeferred} deferred, +${r.published} published, ${r.skipped} skipped` +
          (r.skipped ? ` (${formatRejections(r.skipReasons, 4)})` : "") +
          (r.pageHeld ? `; page held: ${r.errors[r.errors.length - 1] ?? ""}` : "") +
          ` | total +${out.published} (${Math.round(out.published / elapsedH)}/h)`,
      );

      if (!out.workerIgnoringLease) {
        const seen = await workerPassSince(
          prisma,
          ingestor.id,
          new Date(leaseTakenAt + WORKER_PASS_GRACE_MS),
        );
        if (seen) {
          out.workerIgnoringLease = seen.toISOString();
          log(
            `WARNING: the worker logged a ${ingestor.id} pass at ${seen.toISOString()} while this sweep ` +
              "held the lease — it predates leases. Deploy this branch or pause its structured lane; " +
              "the sweep goes on (both are serial, but the Wikipedia traffic doubles).",
          );
        }
      }
      if (r.endOfCorpus) {
        out.stop = "corpus_exhausted";
        out.detail = `reached the end of the corpus after ${out.pages} page(s)`;
        break;
      }
      const moved = r.nextOffset != null && r.nextOffset !== offsetBefore;
      const worked = r.published + r.skipped + r.failed > 0;
      idlePasses = moved || worked ? 0 : idlePasses + 1;
      if (idlePasses >= MAX_IDLE_PASSES) {
        out.stop = "stalled";
        out.detail =
          `${idlePasses} passes in a row held the page at offset ${out.endOffset} without mapping a row` +
          (r.errors.length ? ` (${r.errors[r.errors.length - 1]})` : "") +
          "; rerun with a larger --page-budget-min";
        break;
      }
      if (r.pageHeldReason === "source_failures") {
        wikipediaHolds += 1;
        if (wikipediaHolds >= MAX_WIKIPEDIA_HOLDS) {
          out.stop = "wikipedia_unavailable";
          out.detail = `Wikipedia kept failing (${wikipediaHolds} pages held in a row); rerun to resume`;
          break;
        }
        log(`Wikipedia is failing; pausing ${Math.round(WIKIPEDIA_PAUSE_MS / 1000)}s`);
        await sleep(WIKIPEDIA_PAUSE_MS);
      } else {
        wikipediaHolds = 0;
      }
    }
  } catch (err) {
    out.stop = "failed";
    out.detail = `the sweep failed: ${err instanceof Error ? err.message : String(err)}; rerun to resume`;
    throw err;
  } finally {
    await releaseIngestorLease(prisma, ingestor.id, holder);
    out.elapsedMs = now() - startedAt;
    await writeAdminWorkerLog(prisma, {
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "booster_structured_sweep",
      contentType: ingestor.contentType,
      message:
        `Structured sweep of ${ingestor.id} ${out.stop === "corpus_exhausted" ? "finished" : "stopped"}: ` +
        `${out.published} published over ${out.pages} page(s) (offset ${out.startOffset ?? "?"} → ${out.endOffset ?? "?"}), ` +
        `${out.alreadyPublished} already live, ${out.rejectionsDeferred} known rejection(s) deferred, ${out.skipped} skipped` +
        `${out.skipped ? ` (${formatRejections(out.skipReasons, 6)})` : ""}. ${out.detail}.`,
      safeMetadata: {
        phase: "end",
        ingestorId: ingestor.id,
        cursorId,
        holder,
        stop: out.stop,
        pages: out.pages,
        startOffset: out.startOffset,
        endOffset: out.endOffset,
        fetched: out.fetched,
        published: out.published,
        alreadyPublished: out.alreadyPublished,
        rejectionsDeferred: out.rejectionsDeferred,
        skipped: out.skipped,
        failed: out.failed,
        skipReasons: out.skipReasons,
        elapsedMs: out.elapsedMs,
        workerIgnoringLease: out.workerIgnoringLease,
      } as Prisma.InputJsonValue,
    }).catch(() => undefined);
  }
  return out;
}
