/**
 * Per-entity rejection memory for the structured-knowledge ingest.
 *
 * THE PROBLEM. Only rows already LIVE were skipped before mapping, and a
 * rejection was tallied into the pass histogram and then forgotten. A corpus
 * wraps every RESWEEP_INTERVAL, so every re-sweep re-mapped the same rejected
 * entities — the same Wikipedia summary + infobox fetches, the same verdict
 * ("feast_uncorroborated", "not_catholic_status", …) — on a network budget the
 * SAINT ingest shares with WDQS's per-client limits. The production page
 * recorded in reject.ts (2026-09-07) dropped 40 of 100 saints, and nothing
 * stopped the next sweep from mapping the same 40 again.
 *
 * THE MECHANISM. A rejection whose code describes the ENTITY (its data, its
 * article, its classification) is remembered per (ingestor, Wikidata QID) in
 * one small GENERIC `AdminWorkerMemory` row: `{ code, attempts, nextAttemptAt }`
 * plus a short detail. Until `nextAttemptAt` the orchestrator treats the row
 * like a live one — no mapping, no Wikipedia traffic, and a page made only of
 * live and deferred rows is skipped like an entirely-live page. When the wait
 * is over the entity is mapped again; a repeat rejection doubles the wait
 * (1 day → 7 days), a publish clears the memo. The cap is deliberately short:
 * a rejection can also come from a mapper bug, and a shipped fix must reach
 * every remembered entity within a week (deleting the `structured-reject:`
 * rows re-tests them at once — they are bookkeeping, never content).
 *
 * Codes that say nothing about the entity are NOT remembered: a Wikipedia
 * fetch that failed (network), a verdict reached after one of the entity's
 * source reads failed (`source_read_failed` — the fetch helpers fail open, so a
 * timed-out infobox reads like an absent one; see map-row.ts), a mapper that
 * threw, a same-page duplicate, a publish call that threw. Those keep retrying
 * on the normal cadence.
 *
 * BOUNDED. One row per rejected (ingestor, QID), so the table is bounded by the
 * corpora; each value is a few dozen bytes (detail capped); a pass writes at
 * most one page of memos; and a memo nobody has touched for
 * REJECTION_MEMORY_TTL_MS (longer than the longest wait, so an entity still in
 * its corpus is always re-tested — and re-stamped — first) is pruned, at most
 * once a day, with a hard cap on what is kept.
 */

import type { PrismaClient } from "@prisma/client";

import type { RejectionCode } from "./reject";

export const REJECTION_MEMORY_PREFIX = "structured-reject:";
/** First wait after a rejection; doubles per repeat. */
export const REJECTION_BACKOFF_BASE_MS = 24 * 60 * 60 * 1000;
/** Longest wait, so a corrected article, statement or mapper is re-read within a week. */
export const REJECTION_BACKOFF_MAX_MS = 7 * 24 * 60 * 60 * 1000;
/** Memos untouched this long belong to entities that left their corpus. */
export const REJECTION_MEMORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Hard cap on memos kept (all ingestors); the least recently touched go first. */
export const MAX_REJECTION_MEMOS = 50_000;
/** At most one prune per process per day. */
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DETAIL_MAX = 120;

/** Codes that do not describe the entity, so a retry can legitimately differ. */
export const TRANSIENT_REJECTION_CODES: ReadonlySet<RejectionCode> = new Set<RejectionCode>([
  "wikipedia_fetch_failed",
  "source_read_failed",
  "map_threw",
  "duplicate_in_page",
  "publish_threw",
]);

// A type alias (not an interface) so the memo is assignable to the Json column.
export type RejectionMemo = {
  code: RejectionCode;
  attempts: number;
  /** Epoch ms before which the entity is not mapped again. */
  nextAttemptAt: number;
  detail?: string;
};

export function rejectionMemoKey(ingestorId: string, qid: string): string {
  return `${REJECTION_MEMORY_PREFIX}${ingestorId}:${qid}`;
}

/** Wait after the `attempts`-th consecutive rejection of the same entity. */
export function rejectionBackoffMs(attempts: number): number {
  return Math.min(
    REJECTION_BACKOFF_MAX_MS,
    REJECTION_BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1),
  );
}

export function isRememberedRejection(code: RejectionCode): boolean {
  return !TRANSIENT_REJECTION_CODES.has(code);
}

function parseMemo(value: unknown): RejectionMemo | null {
  const v = (value ?? {}) as Partial<RejectionMemo>;
  if (typeof v.code !== "string" || typeof v.nextAttemptAt !== "number") return null;
  return {
    code: v.code as RejectionCode,
    attempts: typeof v.attempts === "number" && v.attempts > 0 ? v.attempts : 1,
    nextAttemptAt: v.nextAttemptAt,
    ...(typeof v.detail === "string" ? { detail: v.detail } : {}),
  };
}

/**
 * The memos for these QIDs (one indexed query), keyed by QID. Fail-open: an
 * unreadable memory means every entity is simply mapped, as before.
 */
export async function readRejectionMemos(
  prisma: PrismaClient,
  ingestorId: string,
  qids: readonly string[],
): Promise<Map<string, RejectionMemo>> {
  const out = new Map<string, RejectionMemo>();
  const unique = [...new Set(qids)];
  if (unique.length === 0) return out;
  try {
    const rows = await prisma.adminWorkerMemory.findMany({
      where: {
        memoryType: "GENERIC",
        memoryKey: { in: unique.map((q) => rejectionMemoKey(ingestorId, q)) },
      },
      select: { memoryKey: true, memoryValue: true },
    });
    const prefix = rejectionMemoKey(ingestorId, "");
    for (const row of rows) {
      const memo = parseMemo(row.memoryValue);
      if (memo) out.set(row.memoryKey.slice(prefix.length), memo);
    }
  } catch {
    // fail-open
  }
  return out;
}

export interface RejectionOutcomes {
  /** Entities rejected this pass (transient codes are ignored). */
  rejected: Array<{ qid: string; code: RejectionCode; detail?: string }>;
  /** Entities that published or turned out to be live: their memos are cleared. */
  cleared: string[];
  /** The memos read for this page, so a repeat rejection extends its streak. */
  prior: ReadonlyMap<string, RejectionMemo>;
  nowMs?: number;
}

/**
 * Persist one pass's outcomes: delete the memos being replaced or cleared, then
 * create the new ones — two statements whatever the page size. Returns how many
 * memos were written. Fail-open: a failed write only means a re-map next sweep.
 */
export async function recordRejectionOutcomes(
  prisma: PrismaClient,
  ingestorId: string,
  outcomes: RejectionOutcomes,
): Promise<number> {
  const now = outcomes.nowMs ?? Date.now();
  const remembered = new Map<string, RejectionMemo>();
  for (const r of outcomes.rejected) {
    if (!r.qid || !isRememberedRejection(r.code)) continue;
    const attempts = (outcomes.prior.get(r.qid)?.attempts ?? 0) + 1;
    const detail = r.detail?.slice(0, DETAIL_MAX);
    remembered.set(r.qid, {
      code: r.code,
      attempts,
      nextAttemptAt: now + rejectionBackoffMs(attempts),
      ...(detail ? { detail } : {}),
    });
  }
  const cleared = outcomes.cleared.filter((q) => q && outcomes.prior.has(q) && !remembered.has(q));
  if (remembered.size === 0 && cleared.length === 0) return 0;
  try {
    await prisma.adminWorkerMemory.deleteMany({
      where: {
        memoryType: "GENERIC",
        memoryKey: {
          in: [...remembered.keys(), ...cleared].map((q) => rejectionMemoKey(ingestorId, q)),
        },
      },
    });
    if (remembered.size === 0) return 0;
    const lastUsedAt = new Date(now);
    const res = await prisma.adminWorkerMemory.createMany({
      data: [...remembered].map(([qid, memo]) => ({
        memoryType: "GENERIC" as const,
        memoryKey: rejectionMemoKey(ingestorId, qid),
        memoryValue: memo,
        lastUsedAt,
      })),
      skipDuplicates: true,
    });
    return res.count;
  } catch {
    return 0;
  }
}

let lastPruneAt = 0;

/** Forget the prune throttle (tests, and a forced prune). */
export function resetRejectionMemoryPruneClock(): void {
  lastPruneAt = 0;
}

/**
 * Drop memos untouched for REJECTION_MEMORY_TTL_MS, then enforce the hard cap
 * by dropping the least recently touched. At most once a day per process
 * (`force` bypasses); fail-open. Returns how many memos were removed.
 */
export async function pruneRejectionMemos(
  prisma: PrismaClient,
  opts: { nowMs?: number; force?: boolean; cap?: number } = {},
): Promise<number> {
  const now = opts.nowMs ?? Date.now();
  if (!opts.force && now - lastPruneAt < PRUNE_INTERVAL_MS) return 0;
  lastPruneAt = now;
  const ours = {
    memoryType: "GENERIC" as const,
    memoryKey: { startsWith: REJECTION_MEMORY_PREFIX },
  };
  let removed = 0;
  try {
    const expired = await prisma.adminWorkerMemory.deleteMany({
      where: { ...ours, lastUsedAt: { lt: new Date(now - REJECTION_MEMORY_TTL_MS) } },
    });
    removed += expired.count;
    const cap = opts.cap ?? MAX_REJECTION_MEMOS;
    const total = await prisma.adminWorkerMemory.count({ where: ours });
    if (total > cap) {
      const oldest = await prisma.adminWorkerMemory.findMany({
        where: ours,
        orderBy: { lastUsedAt: "asc" },
        take: total - cap,
        select: { id: true },
      });
      const trimmed = await prisma.adminWorkerMemory.deleteMany({
        where: { id: { in: oldest.map((r) => r.id) } },
      });
      removed += trimmed.count;
    }
  } catch {
    // fail-open: the next day's prune catches up
  }
  return removed;
}
