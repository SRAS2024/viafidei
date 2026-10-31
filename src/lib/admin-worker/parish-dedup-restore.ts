/**
 * Undo the old city-only address key: restore the parishes it unpublished,
 * and re-sweep the tiles whose candidates it dropped.
 *
 * Before the street rule (parish-address.ts) a parish with no street keyed as
 * its city, and the address maintenance unpublished every later street-less
 * church in that city as a "duplicate" of the first — 943 parishes on
 * 2026-09-08/09 alone — without recording anything on the row. Discovery
 * dropped the same kind of candidate before it was ever created. Both are
 * undone once, idempotently, in bounded steps:
 *
 *   - `runParishDedupRestore` walks the unpublished PARISH rows in id order (a
 *     cursor in `parish-dedup-restore-v1`, a capped batch per run, finished
 *     when the walk ends). A row is a candidate ONLY when nothing recorded why
 *     it was unpublished — every other unpublish path leaves a mark:
 *       · `_meta.websiteVerification.status = "not-in-communion"` and a
 *         one-year osm-skip on the slug (parish-website-verification.ts);
 *       · a rollback-ledger row and a human-review row named by the slug
 *         (post-publish-rollback.ts);
 *       · a `content_deleted` log for the row (deletion.ts);
 *       · `rejectedReason` / `rejectedAt` on its checklist item (the admin
 *         unpublish, checklist/publishing);
 *       · any human-review row for the slug, any active osm-skip for the slug
 *         or sourceRef, and this change's own `_meta.dedup` / `_meta.excluded`
 *         / `_meta.restored`.
 *     Each candidate is re-checked under the shared rule (same key within
 *     250 m, or the same name within 250 m). A true duplicate stays
 *     unpublished and gains `_meta.dedup`; any other is republished through
 *     runPublishOrchestrator — its update branch re-publishes an unpublished
 *     row — with `_meta.restored {at, reason}`.
 *   - `scheduleOsmResweepAfterKeyFix` makes every non-empty tile swept before
 *     the fix due again (`osm-resweep-after-addresskey-fix-v1`): candidates
 *     dropped as "duplicates" at discovery never became rows, so only a
 *     re-sweep can find them.
 */

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";

import { computeContentChecksum } from "./cache-freshness";
import { isDoctrinallySensitive } from "./content-type-profiles";
import {
  findDuplicateParish,
  findNearbySameNameParish,
  parishAddressKeyForPayload,
} from "./parish-address";
import { runPublishOrchestrator } from "./publish-orchestrator";

const RESTORE_KEY = "parish-dedup-restore-v1";
const RESWEEP_KEY = "osm-resweep-after-addresskey-fix-v1";
const TILE_PREFIX = "osm-tile:";
const TILE_CURSOR_KEY = "osm-tile-cursor";
const SKIP_PREFIX = "osm-skip:";
const RESTORE_REASON =
  "unpublished by the city-only address key with no recorded reason; distinct under the street + 250 m duplicate rule";
/** Restored slugs and kept-duplicate pairs reported per run. */
const MAX_REPORTED = 20;

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

async function readJson(prisma: PrismaClient, key: string): Promise<Record<string, unknown>> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  return obj(row?.memoryValue);
}

async function writeJson(
  prisma: PrismaClient,
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      update: { memoryValue: value as never, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: key,
        memoryValue: value as never,
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

/** A query that may fail (or whose delegate may be missing): null on any error. */
async function safe<T>(query: () => Promise<T>): Promise<T | null> {
  try {
    return await query();
  } catch {
    return null;
  }
}

// ── Restore ─────────────────────────────────────────────────────────────────

type UnpublishedRow = {
  id: string;
  checklistItemId: string;
  slug: string;
  title: string;
  payload: unknown;
  sourceRef: string | null;
  authorityLevel: string;
  latitude: number | null;
  longitude: number | null;
  unpublishedAt: Date | null;
};

/** Why a row must NOT be restored (a recorded unpublish reason), or null. */
export type RestoreSkipReason =
  | "no-unpublish-time"
  | "not-in-communion"
  | "already-handled"
  | "rollback-ledger"
  | "human-review"
  | "checklist-rejected"
  | "osm-skip"
  | "logged-unpublish";

export interface RecordedSignals {
  ledger: Set<string>;
  reviews: Set<string>;
  rejectedItems: Set<string>;
  skips: Set<string>;
  logged: Set<string>;
}

/** Every recorded unpublish reason for a batch, in five batched queries. */
async function recordedSignals(
  prisma: PrismaClient,
  rows: UnpublishedRow[],
  now: number,
): Promise<RecordedSignals | null> {
  const ids = rows.map((r) => r.id);
  const slugs = rows.map((r) => r.slug);
  const skipKeys = rows.flatMap((r) =>
    [r.slug, r.sourceRef].filter((k): k is string => Boolean(k)).map((k) => SKIP_PREFIX + k),
  );
  const [ledger, reviews, items, skips, logs] = await Promise.all([
    safe(() =>
      prisma.adminWorkerRollbackLedger.findMany({
        where: { contentId: { in: ids } },
        select: { contentId: true },
      }),
    ),
    safe(() =>
      prisma.humanReviewQueue.findMany({
        where: { contentTitle: { in: slugs } },
        select: { contentTitle: true },
      }),
    ),
    safe(() =>
      prisma.checklistItem.findMany({
        where: { id: { in: rows.map((r) => r.checklistItemId) } },
        select: { id: true, rejectedReason: true, rejectedAt: true, rejectedByUsername: true },
      }),
    ),
    safe(() =>
      prisma.adminWorkerMemory.findMany({
        where: { memoryType: "GENERIC", memoryKey: { in: skipKeys } },
        select: { memoryKey: true, memoryValue: true },
      }),
    ),
    safe(() =>
      prisma.adminWorkerLog.findMany({
        where: {
          eventName: { in: ["content_deleted", "parish_unpublished_not_in_communion"] },
          relatedEntityId: { in: ids },
        },
        select: { relatedEntityId: true },
      }),
    ),
  ]);
  // Fail closed: when any record cannot be read, nothing is restored.
  if (!ledger || !reviews || !items || !skips || !logs) return null;
  return {
    ledger: new Set(ledger.map((r) => r.contentId ?? "")),
    reviews: new Set(reviews.map((r) => r.contentTitle ?? "")),
    rejectedItems: new Set(
      items
        .filter((i) => Boolean(i.rejectedReason || i.rejectedAt || i.rejectedByUsername))
        .map((i) => i.id),
    ),
    skips: new Set(
      skips
        .filter((s) => {
          const until = obj(s.memoryValue).retryAfter;
          return typeof until === "number" && until > now;
        })
        .map((s) => s.memoryKey.slice(SKIP_PREFIX.length)),
    ),
    logged: new Set(logs.map((l) => l.relatedEntityId ?? "")),
  };
}

/** The recorded reason this row was unpublished, or null when there is none. */
export function recordedUnpublishReason(
  row: Pick<UnpublishedRow, "id" | "checklistItemId" | "slug" | "sourceRef" | "unpublishedAt"> & {
    payload: unknown;
  },
  signals: RecordedSignals,
): RestoreSkipReason | null {
  if (!row.unpublishedAt) return "no-unpublish-time";
  const meta = obj(obj(row.payload)._meta);
  if (obj(meta.websiteVerification).status === "not-in-communion") return "not-in-communion";
  if (meta.dedup || meta.excluded || meta.restored) return "already-handled";
  if (signals.ledger.has(row.id)) return "rollback-ledger";
  if (signals.reviews.has(row.slug)) return "human-review";
  if (signals.rejectedItems.has(row.checklistItemId)) return "checklist-rejected";
  if (signals.skips.has(row.slug) || (row.sourceRef && signals.skips.has(row.sourceRef)))
    return "osm-skip";
  if (signals.logged.has(row.id)) return "logged-unpublish";
  return null;
}

export interface DedupRestoreResult {
  ran: boolean;
  done: boolean;
  examined: number;
  restored: number;
  /** Re-checked and still a duplicate under the new rule (kept unpublished). */
  deduped: number;
  /** Unpublished for a recorded reason — left alone. */
  skipped: number;
  /** Publish gate or schema refused the republish. */
  blocked: number;
  restoredSlugs: string[];
  dedupPairs: Array<Record<string, string>>;
}

/**
 * One bounded batch of the restore walk. Idempotent: restored and re-deduped
 * rows carry a marker, the cursor only moves forward, and once the walk ends
 * the job is marked done for good.
 */
export async function runParishDedupRestore(
  prisma: PrismaClient,
  opts: { passId?: string; now?: () => number; batch?: number } = {},
): Promise<DedupRestoreResult> {
  const nowFn = opts.now ?? Date.now;
  const out: DedupRestoreResult = {
    ran: false,
    done: false,
    examined: 0,
    restored: 0,
    deduped: 0,
    skipped: 0,
    blocked: 0,
    restoredSlugs: [],
    dedupPairs: [],
  };
  const state = await readJson(prisma, RESTORE_KEY);
  if (state.done === true) {
    out.done = true;
    return out;
  }
  const cursorId = typeof state.cursorId === "string" ? state.cursorId : null;
  const batch = opts.batch ?? envInt("ADMIN_WORKER_PARISH_RESTORE_BATCH", 50);
  const rows = await safe(
    () =>
      prisma.publishedContent.findMany({
        where: {
          contentType: "PARISH" as never,
          isPublished: false,
          ...(cursorId ? { id: { gt: cursorId } } : {}),
        },
        orderBy: { id: "asc" },
        take: batch,
        select: {
          id: true,
          checklistItemId: true,
          slug: true,
          title: true,
          payload: true,
          sourceRef: true,
          authorityLevel: true,
          latitude: true,
          longitude: true,
          unpublishedAt: true,
        },
      }) as Promise<UnpublishedRow[]>,
  );
  if (!rows) return out;
  const signals = rows.length > 0 ? await recordedSignals(prisma, rows, nowFn()) : null;
  if (rows.length > 0 && !signals) return out; // cannot verify: try again next run
  out.ran = true;

  for (const row of rows) {
    out.examined += 1;
    if (recordedUnpublishReason(row, signals!)) {
      out.skipped += 1;
      continue;
    }
    const payload = obj(row.payload);
    const key = parishAddressKeyForPayload(payload);
    const located = { name: row.title, latitude: row.latitude, longitude: row.longitude };
    const duplicate =
      (await findDuplicateParish(prisma, { ...located, addressKey: key }, { excludeId: row.id })) ??
      (await findNearbySameNameParish(prisma, located, { excludeId: row.id }));
    const now = nowFn();
    const next = { ...payload };
    if (key) next.addressKey = key;
    else delete next.addressKey;

    if (duplicate) {
      // Still the same place as a live parish under the new rule: keep it
      // unpublished, but now say which one and why.
      const dedup = {
        keeperId: duplicate.id,
        keeperSlug: duplicate.slug,
        key,
        rule: duplicate.rule,
        at: now,
        ...(duplicate.distanceM != null ? { distanceM: duplicate.distanceM } : {}),
      };
      const kept = { ...next, _meta: { ...obj(payload._meta), dedup } };
      await prisma.publishedContent
        .update({
          where: { id: row.id },
          data: {
            payload: kept as never,
            contentChecksum: computeContentChecksum(row.title, kept),
            addressKey: key || null,
          },
        })
        .catch(() => undefined);
      out.deduped += 1;
      if (out.dedupPairs.length < MAX_REPORTED) {
        out.dedupPairs.push({
          victimId: row.id,
          victimSlug: row.slug,
          keeperId: duplicate.id,
          keeperSlug: duplicate.slug,
          rule: duplicate.rule,
        });
      }
      continue;
    }

    const restoredPayload = {
      ...next,
      _meta: { ...obj(payload._meta), restored: { at: now, reason: RESTORE_REASON } },
    };
    if (!validatePayload("PARISH", restoredPayload).ok) {
      out.blocked += 1;
      continue;
    }
    const result = await runPublishOrchestrator(prisma, {
      contentType: "PARISH",
      contentId: row.checklistItemId,
      title: row.title,
      slug: row.slug,
      payload: restoredPayload as never,
      authorityLevel: String(row.authorityLevel || "COMMUNITY"),
      finalScore: 0.88,
      qaPassed: true,
      hasSourceEvidence: true,
      isDoctrinallySensitive: isDoctrinallySensitive("PARISH"),
      confidence: 0.8,
      // The same deterministic gate the OSM sweep publishes through; the
      // side effects are batched once per run below.
      skipBrainScreens: true,
      skipPostPublishSideEffects: true,
      verifier: {
        publishAllowed: true,
        missingRequired: [],
        blockingSensitiveFields: [],
        verificationRowIds: [],
        evidence: [],
        hasConflict: false,
        summary: `Restored: ${RESTORE_REASON}.`,
      },
    }).catch(() => null);
    if (result?.kind === "published") {
      out.restored += 1;
      if (out.restoredSlugs.length < MAX_REPORTED) out.restoredSlugs.push(row.slug);
    } else {
      out.blocked += 1;
    }
  }

  out.done = rows.length < batch;
  const totals = obj(state.totals);
  const add = (k: string, n: number) =>
    (typeof totals[k] === "number" ? (totals[k] as number) : 0) + n;
  await writeJson(prisma, RESTORE_KEY, {
    cursorId: rows.length > 0 ? rows[rows.length - 1]!.id : cursorId,
    done: out.done,
    ...(out.done ? { doneAt: nowFn() } : {}),
    totals: {
      examined: add("examined", out.examined),
      restored: add("restored", out.restored),
      deduped: add("deduped", out.deduped),
      skipped: add("skipped", out.skipped),
      blocked: add("blocked", out.blocked),
    },
  });

  if (out.restored > 0) {
    // Batched once per run (the orchestrator's per-publish side effects were
    // skipped): close the goal gap and flag search/sitemap refresh.
    const { refreshContentGoals } = await import("./content-goals");
    await refreshContentGoals(prisma).catch(() => undefined);
    const { flagSearchRefresh, flagSitemapRefresh } = await import("./repair");
    await Promise.all([
      flagSearchRefresh(prisma).catch(() => undefined),
      flagSitemapRefresh(prisma).catch(() => undefined),
    ]);
  }
  return out;
}

// ── One-time early re-sweep ─────────────────────────────────────────────────

/**
 * Wake a parked sweep: a full lap that found nothing due parks the cursor
 * until the earliest nextDueAt, which would ignore tiles made due just now.
 */
async function wakeSweepCursor(prisma: PrismaClient): Promise<void> {
  const cursor = await readJson(prisma, TILE_CURSOR_KEY);
  if (Object.keys(cursor).length === 0) return;
  await writeJson(prisma, TILE_CURSOR_KEY, {
    ...cursor,
    idleUntil: null,
    minDueSeen: null,
    dryScanned: 0,
  });
}

/**
 * Make every non-empty tile swept before the fix due now, a bounded batch of
 * tile rows per call (cursor over the `osm-tile:` keys). The fix time is the
 * first call's; tiles swept after it already used the new rule. Done once.
 */
export async function scheduleOsmResweepAfterKeyFix(
  prisma: PrismaClient,
  opts: { now?: number; batch?: number } = {},
): Promise<{ done: boolean; scheduled: number }> {
  const now = opts.now ?? Date.now();
  const state = await readJson(prisma, RESWEEP_KEY);
  if (state.done === true) return { done: true, scheduled: 0 };
  const fixAt = typeof state.fixAt === "number" ? state.fixAt : now;
  const after = typeof state.afterKey === "string" ? state.afterKey : "";
  const batch = opts.batch ?? envInt("ADMIN_WORKER_OSM_RESWEEP_BATCH", 250);
  const rows = await safe(() =>
    prisma.adminWorkerMemory.findMany({
      where: {
        memoryType: "GENERIC",
        memoryKey: after ? { startsWith: TILE_PREFIX, gt: after } : { startsWith: TILE_PREFIX },
      },
      orderBy: { memoryKey: "asc" },
      take: batch,
      select: { memoryKey: true, memoryValue: true },
    }),
  );
  if (!rows) return { done: false, scheduled: 0 };

  let scheduled = 0;
  for (const row of rows) {
    const v = obj(row.memoryValue);
    // Only completed sweeps under the old rule that found something: an empty
    // tile dropped nothing, and a pending / failed / split tile is due anyway.
    if (v.status !== "SWEPT" || v.elementCount === 0) continue;
    if (typeof v.lastSweptAt !== "number" || v.lastSweptAt >= fixAt) continue;
    if (typeof v.nextDueAt === "number" && v.nextDueAt <= now) continue;
    const updated = await safe(() =>
      prisma.adminWorkerMemory.update({
        where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: row.memoryKey } },
        data: { memoryValue: { ...v, nextDueAt: now } as never },
      }),
    );
    if (updated) scheduled += 1;
  }
  const done = rows.length < batch;
  if (scheduled > 0 || done) await wakeSweepCursor(prisma);
  await writeJson(prisma, RESWEEP_KEY, {
    fixAt,
    afterKey: rows.length > 0 ? rows[rows.length - 1]!.memoryKey : after,
    done,
    scheduled: (typeof state.scheduled === "number" ? state.scheduled : 0) + scheduled,
    ...(done ? { doneAt: now } : {}),
  });
  return { done, scheduled };
}
