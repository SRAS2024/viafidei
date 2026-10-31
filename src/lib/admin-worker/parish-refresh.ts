/**
 * Parish directory upkeep — two self-gating sweeps that keep the published
 * parish directory correct without ever getting stuck.
 *
 * 1. `runParishAddressMaintenance` (continuous, keyless): walks the whole
 *    published-parish catalog on a slow throttle, stamping each row's normalized
 *    `addressKey` (so publish-time duplicate detection is reliable) and
 *    unpublishing any parish that duplicates an earlier published one under the
 *    shared rule (same address key AND within 250 m, or the same name when a
 *    row has no coordinates — parish-address.ts). The unpublished row records
 *    which row it duplicated and why (`payload._meta.dedup`), so a mistake is
 *    visible and reversible. This is how "all previously published parishes
 *    are checked" for duplicates, not just newly discovered ones.
 *
 * 2. `runParishMonthlyRefresh` (last 7 days of each month): re-reads every
 *    published parish's website and refreshes its Mass times, confession times,
 *    and phone number when they have changed. It cursors through the catalog a
 *    small batch per pass, persisting the cursor after EVERY site and stopping
 *    at a wall-clock budget below the lane watchdog (so a slow batch can never
 *    be killed mid-way and then re-fetch the same sites), and the moment it
 *    finishes it marks the month done and stops — freeing the worker to return
 *    to its normal tasks instead of burning the remaining days. If it cannot
 *    make progress (repeated hard errors, or the month ends before it
 *    finishes) it escalates to the developer. When it finishes and anything
 *    actually changed, it emails the developer a report of how many parishes
 *    were updated, in the standard admin-email aesthetic.
 *
 * Everything here is fail-open: a failure in either sweep must never wedge a
 * worker pass, and per-parish errors are skipped so one bad site can't stall the
 * sweep. State (cursor + monthly counters) lives in `AdminWorkerMemory`.
 */

import type { PrismaClient } from "@prisma/client";

import { derivedColumnsFor } from "@/lib/content-shared/derived-columns";

import { computeContentChecksum } from "./cache-freshness";
import { inspectParishWebsite } from "./communion-verifier";
import { findDuplicateParish, parishAddressKeyForPayload } from "./parish-address";
import { lastDayOfMonth, isLastDayOfMonth } from "./report-generator";
import { writeAdminWorkerLog } from "./logs";

// Versioned: the address key changed meaning (no key without a street line),
// so the first lap after the change restarts at the start of the catalog
// instead of resuming the old cursor mid-way with half the keys stale.
const ADDRESS_MAINT_KEY = "parish-address-maint-v2";
const MONTHLY_REFRESH_KEY = "parish-monthly-refresh";
const ADDRESS_MAINT_THROTTLE_MS = 10 * 60 * 1000; // slow, keyless catalog sweep

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Last N calendar days of the month (default 7) — the end-of-month window. */
export function isMonthEndWindow(now: Date, windowDays = 7): boolean {
  const last = lastDayOfMonth(now.getFullYear(), now.getMonth()).getDate();
  return now.getDate() > last - windowDays;
}

/** Stable per-month key, e.g. "2026-07". */
function monthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(now: Date): string {
  return now.toLocaleString("en-US", { month: "long", year: "numeric" });
}

async function readMemory<T>(prisma: PrismaClient, key: string, fallback: T): Promise<T> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      select: { memoryValue: true, lastUsedAt: true },
    })
    .catch(() => null);
  if (row?.memoryValue && typeof row.memoryValue === "object" && !Array.isArray(row.memoryValue)) {
    return { ...fallback, ...(row.memoryValue as Record<string, unknown>) } as T;
  }
  return fallback;
}

async function writeMemory(
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

async function lastUsedAt(prisma: PrismaClient, key: string): Promise<number> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      select: { lastUsedAt: true },
    })
    .catch(() => null);
  return row?.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
}

type ParishRow = { id: string; slug: string; title: string; payload: unknown };

type MaintenanceRow = ParishRow & {
  latitude: number | null;
  longitude: number | null;
  addressKey: string | null;
};

function payloadObj(p: unknown): Record<string, unknown> {
  return p && typeof p === "object" && !Array.isArray(p)
    ? { ...(p as Record<string, unknown>) }
    : {};
}

function metaObj(payload: Record<string, unknown>): Record<string, unknown> {
  return payloadObj(payload._meta);
}

/** The row's payload as stored right now, or null when it cannot be read. */
async function freshPayload(
  prisma: PrismaClient,
  id: string,
): Promise<Record<string, unknown> | null> {
  const row = await prisma.publishedContent
    .findUnique({ where: { id }, select: { payload: true } })
    .catch(() => null);
  return row ? payloadObj(row.payload) : null;
}

/** Why a row was unpublished as a duplicate (`payload._meta.dedup`). */
export interface ParishDedupMeta {
  keeperId: string;
  keeperSlug: string;
  key: string;
  rule: string;
  at: number;
  distanceM?: number;
}

/** Keeper/victim pairs logged per run (bounded so one log row stays small). */
const MAX_LOGGED_PAIRS = 25;

export interface AddressMaintenanceResult {
  ran: boolean;
  scanned: number;
  /** Rows whose stored key was stamped, re-derived, or cleared. */
  keyed: number;
  duplicatesRemoved: number;
  detail: string;
}

/**
 * One throttled batch of address-key backfill + duplicate removal over the
 * published parishes. Loops the whole catalog over time (resets its cursor when
 * it reaches the end) so newly-published rows and any late duplicates are always
 * eventually reconciled. Keyless + fail-open.
 */
export async function runParishAddressMaintenance(
  prisma: PrismaClient,
  opts: { passId?: string; force?: boolean; now?: () => number } = {},
): Promise<AddressMaintenanceResult> {
  const nowFn = opts.now ?? Date.now;
  const out: AddressMaintenanceResult = {
    ran: false,
    scanned: 0,
    keyed: 0,
    duplicatesRemoved: 0,
    detail: "",
  };
  if (
    !opts.force &&
    nowFn() - (await lastUsedAt(prisma, ADDRESS_MAINT_KEY)) < ADDRESS_MAINT_THROTTLE_MS
  ) {
    out.detail = "throttled";
    return out;
  }
  const batch = envInt("ADMIN_WORKER_PARISH_DEDUP_BATCH", 100);
  const state = await readMemory<{ cursorId: string | null }>(prisma, ADDRESS_MAINT_KEY, {
    cursorId: null,
  });

  const rows = (await prisma.publishedContent
    .findMany({
      where: {
        contentType: "PARISH" as never,
        isPublished: true,
        ...(state.cursorId ? { id: { gt: state.cursorId } } : {}),
      },
      orderBy: { id: "asc" },
      take: batch,
      select: {
        id: true,
        slug: true,
        title: true,
        payload: true,
        latitude: true,
        longitude: true,
        addressKey: true,
      },
    })
    .catch(() => [])) as MaintenanceRow[];

  out.ran = true;
  const pairs: Array<Record<string, string>> = [];
  for (const row of rows) {
    out.scanned += 1;
    try {
      const payload = payloadObj(row.payload);
      const key = parishAddressKeyForPayload(payload);

      // Is there an EARLIER published parish (lower id = seen first = the
      // keeper) that this row duplicates under the shared rule? The key probe
      // hits the indexed `addressKey` column; a key match only counts when the
      // two are within 250 m (or share a name when one has no coordinates).
      const keeper = key
        ? await findDuplicateParish(
            prisma,
            { addressKey: key, latitude: row.latitude, longitude: row.longitude, name: row.title },
            { beforeId: row.id },
          )
        : null;
      const storedKey = typeof payload.addressKey === "string" ? payload.addressKey : "";
      const needsStamp = storedKey !== key || (row.addressKey ?? "") !== key;
      if (!keeper && !needsStamp) continue;

      // Every write lands on the row as it is NOW: the batch was read a while
      // ago and another lane may have filled it since. A row whose address
      // changed meanwhile is left for the next lap.
      const current = await freshPayload(prisma, row.id);
      if (current && parishAddressKeyForPayload(current) !== key) continue;
      const base = current ?? payload;

      if (keeper) {
        const at = nowFn();
        const dedup: ParishDedupMeta = {
          keeperId: keeper.id,
          keeperSlug: keeper.slug,
          key,
          rule: keeper.rule,
          at,
          ...(keeper.distanceM != null ? { distanceM: keeper.distanceM } : {}),
        };
        const next = { ...base, addressKey: key, _meta: { ...metaObj(base), dedup } };
        // Unpublished, never deleted: the row keeps its payload and says which
        // row it duplicated, so a wrong call can be found and reversed.
        await prisma.publishedContent
          .update({
            where: { id: row.id },
            data: {
              isPublished: false,
              unpublishedAt: new Date(at),
              payload: next as never,
              contentChecksum: computeContentChecksum(row.title, next),
              ...derivedColumnsFor("PARISH", next),
            },
          })
          .catch(() => undefined);
        out.duplicatesRemoved += 1;
        if (pairs.length < MAX_LOGGED_PAIRS) {
          pairs.push({
            victimId: row.id,
            victimSlug: row.slug,
            keeperId: keeper.id,
            keeperSlug: keeper.slug,
            rule: keeper.rule,
          });
        }
        continue;
      }

      // Stamp the key (payload + indexed column) when it is missing, stale, or
      // — under the street rule — no longer exists at all (a city-only key
      // such as "rome" is cleared, not kept).
      const next = { ...base };
      if (key) next.addressKey = key;
      else delete next.addressKey;
      await prisma.publishedContent
        .update({
          where: { id: row.id },
          data: {
            payload: next as never,
            addressKey: key || null,
            contentChecksum: computeContentChecksum(row.title, next),
          },
        })
        .catch(() => undefined);
      out.keyed += 1;
    } catch {
      /* fail-open per row */
    }
  }

  // Advance the cursor; reset to the start once we've walked the whole catalog
  // so the sweep keeps reconciling continuously.
  const nextCursor = rows.length === batch ? rows[rows.length - 1]!.id : null;
  await writeMemory(prisma, ADDRESS_MAINT_KEY, { cursorId: nextCursor });

  out.detail = `address maintenance: ${out.scanned} scanned, +${out.keyed} keyed, -${out.duplicatesRemoved} duplicates`;
  if (out.keyed > 0 || out.duplicatesRemoved > 0) {
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId ?? null,
      category: "PUBLISHING",
      severity: "INFO",
      eventName: "parish_address_maintenance",
      message: out.detail,
      contentType: "PARISH",
      safeMetadata: {
        scanned: out.scanned,
        keyed: out.keyed,
        deduped: out.duplicatesRemoved,
        ...(pairs.length > 0 ? { pairs } : {}),
      },
    }).catch(() => undefined);
  }
  return out;
}

interface MonthlyState extends Record<string, unknown> {
  month: string;
  cursorId: string | null;
  checked: number;
  updated: number;
  massTimes: number;
  confessionTimes: number;
  phone: number;
  address: number;
  duplicatesRemoved: number;
  done: boolean;
  reported: boolean;
  errorRuns: number;
  escalated: boolean;
}

function freshMonthlyState(month: string): MonthlyState {
  return {
    month,
    cursorId: null,
    checked: 0,
    updated: 0,
    massTimes: 0,
    confessionTimes: 0,
    phone: 0,
    address: 0,
    duplicatesRemoved: 0,
    done: false,
    reported: false,
    errorRuns: 0,
    escalated: false,
  };
}

export interface MonthlyRefreshResult {
  window: boolean;
  ran: boolean;
  done: boolean;
  checkedThisRun: number;
  updatedThisRun: number;
  detail: string;
}

/**
 * How many parishes to re-check per pass. Each site fetch can take up to 10 s,
 * so the batch × 10 s must stay under the lane's watchdog (120 s by default):
 * 10 sites, plus the wall-clock budget below as the hard stop.
 */
const REFRESH_BATCH_DEFAULT = 10;
/** Wall-clock budget per refresh run (env `ADMIN_WORKER_PARISH_REFRESH_BUDGET_MS`). */
const REFRESH_BUDGET_DEFAULT_MS = 90_000;
/** Consecutive failed runs before we escalate that the sweep is stuck. */
const ESCALATE_AFTER_ERROR_RUNS = 5;

/**
 * Run one batch of the end-of-month parish refresh, if we are in the last-7-days
 * window and haven't already finished this month. Fail-open.
 */
export async function runParishMonthlyRefresh(
  prisma: PrismaClient,
  opts: { passId?: string; now?: Date } = {},
): Promise<MonthlyRefreshResult> {
  const now = opts.now ?? new Date();
  const out: MonthlyRefreshResult = {
    window: false,
    ran: false,
    done: false,
    checkedThisRun: 0,
    updatedThisRun: 0,
    detail: "",
  };

  if (!isMonthEndWindow(now)) {
    out.detail = "not in end-of-month window";
    return out;
  }
  out.window = true;
  // The refresh re-reads live websites; with egress disabled there's nothing to
  // refresh, so skip cleanly rather than churn.
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") {
    out.detail = "skip-network — refresh idle";
    return out;
  }

  const mk = monthKey(now);
  let state = await readMemory<MonthlyState>(prisma, MONTHLY_REFRESH_KEY, freshMonthlyState(mk));
  if (state.month !== mk) state = freshMonthlyState(mk);

  if (state.done) {
    // Finished this month already → let the worker get on with normal tasks.
    out.done = true;
    out.detail = "end-of-month refresh already complete this month";
    return out;
  }

  const batchSize = envInt("ADMIN_WORKER_PARISH_REFRESH_BATCH", REFRESH_BATCH_DEFAULT);
  const deadline =
    Date.now() + envInt("ADMIN_WORKER_PARISH_REFRESH_BUDGET_MS", REFRESH_BUDGET_DEFAULT_MS);
  let hardError = false;
  let stoppedEarly = false;
  try {
    const rows = await prisma.publishedContent.findMany({
      where: {
        contentType: "PARISH" as never,
        isPublished: true,
        ...(state.cursorId ? { id: { gt: state.cursorId } } : {}),
      },
      orderBy: { id: "asc" },
      take: batchSize,
      select: { id: true, slug: true, title: true, payload: true },
    });
    out.ran = true;

    for (const row of rows) {
      // Stop before the watchdog would: the cursor already points past every
      // site handled so far, so the next pass simply carries on from here.
      if (Date.now() > deadline) {
        stoppedEarly = true;
        break;
      }
      state.checked += 1;
      out.checkedThisRun += 1;
      // Persist the cursor per site (not per batch) so a killed run never
      // re-fetches the same sites.
      state.cursorId = row.id;
      try {
        const payload = payloadObj(row.payload);
        const website = typeof payload.website === "string" ? payload.website : "";
        if (!website) {
          // Nothing to re-read; just make sure the addressKey is stamped.
          const key = parishAddressKeyForPayload(payload);
          if (key && payload.addressKey !== key) {
            payload.addressKey = key;
            await prisma.publishedContent
              .update({
                where: { id: row.id },
                data: {
                  payload: payload as never,
                  addressKey: key,
                  contentChecksum: computeContentChecksum(row.title, payload),
                },
              })
              .catch(() => undefined);
          }
          continue;
        }

        const { details } = await inspectParishWebsite(website);
        const changes: Record<string, unknown> = {};
        // Volatile fields: refresh when the site now shows something different.
        if (details.massTimes && details.massTimes !== payload.massTimes) {
          changes.massTimes = details.massTimes;
          state.massTimes += 1;
        }
        if (details.confessionTimes && details.confessionTimes !== payload.confessionTimes) {
          changes.confessionTimes = details.confessionTimes;
          state.confessionTimes += 1;
        }
        if (details.phone && details.phone !== payload.phone) {
          changes.phone = details.phone;
          state.phone += 1;
        }
        // Never overwrite a curated address from a scrape — only backfill the
        // normalized key if it's missing (keeps dedup honest).
        const key = parishAddressKeyForPayload(payload);
        if (key && payload.addressKey !== key) changes.addressKey = key;

        if (Object.keys(changes).length > 0) {
          const updated = { ...payload, ...changes };
          await prisma.publishedContent
            .update({
              where: { id: row.id },
              data: {
                payload: updated as never,
                // The freshness marker hashes the payload: a write that left it
                // stale made cache verification flag the parish as unserved.
                contentChecksum: computeContentChecksum(row.title, updated),
                ...("addressKey" in changes ? { addressKey: changes.addressKey as string } : {}),
              },
            })
            .catch(() => undefined);
          // Count as an "updated parish" only when a user-facing field moved
          // (not a bare addressKey backfill).
          if ("massTimes" in changes || "confessionTimes" in changes || "phone" in changes) {
            state.updated += 1;
            out.updatedThisRun += 1;
          }
        }
      } catch {
        /* fail-open per parish — one bad site never stalls the sweep */
      } finally {
        await writeMemory(prisma, MONTHLY_REFRESH_KEY, state);
      }
    }

    // A short batch fully consumed means we've reached the end → done.
    if (!stoppedEarly && rows.length < batchSize) {
      state.done = true;
      out.done = true;
    }
    state.errorRuns = 0; // a successful run clears the stuck counter
  } catch {
    hardError = true;
    state.errorRuns = (state.errorRuns ?? 0) + 1;
  }

  // Completion: report once, if anything actually changed.
  if (state.done && !state.reported) {
    state.reported = true;
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId ?? null,
      category: "PUBLISHING",
      severity: "INFO",
      eventName: "parish_monthly_refresh_complete",
      message: `End-of-month parish refresh complete: ${state.updated}/${state.checked} parishes updated.`,
      contentType: "PARISH",
      safeMetadata: {
        checked: state.checked,
        updated: state.updated,
        massTimes: state.massTimes,
        confessionTimes: state.confessionTimes,
        phone: state.phone,
      },
    }).catch(() => undefined);
    if (state.updated > 0) {
      try {
        const { sendAdminWorkerParishRefreshReport } = await import("@/lib/email/admin-send");
        await sendAdminWorkerParishRefreshReport({
          monthLabel: monthLabel(now),
          parishesChecked: state.checked,
          parishesUpdated: state.updated,
          fieldChanges: {
            massTimes: state.massTimes,
            confessionTimes: state.confessionTimes,
            phone: state.phone,
            address: state.address,
          },
          duplicatesRemoved: state.duplicatesRemoved,
        });
      } catch {
        /* fail-open: report email is best-effort */
      }
    }
  }

  // Escalate if the sweep is stuck: repeated hard errors, or the month is ending
  // before it could finish. Once per month.
  const outOfTime = isLastDayOfMonth(now) && !state.done;
  const chronicError = (state.errorRuns ?? 0) >= ESCALATE_AFTER_ERROR_RUNS;
  if (!state.escalated && (outOfTime || chronicError)) {
    state.escalated = true;
    const reason = chronicError
      ? `The end-of-month parish refresh has failed ${state.errorRuns} runs in a row and cannot make progress.`
      : `The end-of-month parish refresh reached the last day of ${monthLabel(now)} having checked ${state.checked} parishes but did not finish the full catalog in the 7-day window.`;
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId ?? null,
      category: "PUBLISHING",
      severity: "WARN",
      eventName: "parish_monthly_refresh_stuck",
      message: reason,
      contentType: "PARISH",
      safeMetadata: { checked: state.checked, errorRuns: state.errorRuns ?? 0 },
    }).catch(() => undefined);
    try {
      const { sendCriticalFailureAlert } = await import("@/lib/email/admin-send");
      await sendCriticalFailureAlert({
        kind: "Parish monthly refresh stuck",
        message: reason,
        context: {
          Month: monthLabel(now),
          "Parishes checked": String(state.checked),
          "Consecutive failed runs": String(state.errorRuns ?? 0),
        },
      });
    } catch {
      /* fail-open */
    }
  }

  await writeMemory(prisma, MONTHLY_REFRESH_KEY, state);
  out.detail = hardError
    ? `refresh run errored (${state.errorRuns} in a row)`
    : `refresh: ${out.checkedThisRun} checked, +${out.updatedThisRun} updated${state.done ? " (complete)" : ""}`;
  return out;
}

/**
 * The lane entry point: continuous address maintenance every pass, plus the
 * end-of-month content refresh during its window. Both self-gate and fail open,
 * so this is safe to call every pass.
 */
export async function runParishRefreshLane(
  prisma: PrismaClient,
  opts: { passId?: string } = {},
): Promise<{ detail: string }> {
  const maint = await runParishAddressMaintenance(prisma, { passId: opts.passId }).catch(
    () => null,
  );
  const refresh = await runParishMonthlyRefresh(prisma, { passId: opts.passId }).catch(() => null);
  const parts: string[] = [];
  if (maint?.ran) parts.push(maint.detail);
  if (refresh?.window) parts.push(refresh.detail);
  return { detail: parts.join("; ") || "parish upkeep idle" };
}
