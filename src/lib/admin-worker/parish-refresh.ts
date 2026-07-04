/**
 * Parish directory upkeep — two self-gating sweeps that keep the published
 * parish directory correct without ever getting stuck.
 *
 * 1. `runParishAddressMaintenance` (continuous, keyless): walks the whole
 *    published-parish catalog on a slow throttle, stamping each row's normalized
 *    `addressKey` (so publish-time duplicate detection is reliable) and
 *    unpublishing any parish whose address duplicates one already published —
 *    the operator's rule that two parishes at the same address are the same
 *    place. This is how "all previously published parishes are checked" for
 *    duplicates, not just newly discovered ones.
 *
 * 2. `runParishMonthlyRefresh` (last 7 days of each month): re-reads every
 *    published parish's website and refreshes its Mass times, confession times,
 *    and phone number when they have changed. It cursors through the catalog a
 *    batch per pass so it can cover all parishes across the window, and the
 *    moment it finishes it marks the month done and stops — freeing the worker
 *    to return to its normal tasks instead of burning the remaining days. If it
 *    cannot make progress (repeated hard errors, or the month ends before it
 *    finishes) it escalates to the developer. When it finishes and anything
 *    actually changed, it emails the developer a report of how many parishes
 *    were updated, in the standard admin-email aesthetic.
 *
 * Everything here is fail-open: a failure in either sweep must never wedge a
 * worker pass, and per-parish errors are skipped so one bad site can't stall the
 * sweep. State (cursor + monthly counters) lives in `AdminWorkerMemory`.
 */

import type { PrismaClient } from "@prisma/client";

import { inspectParishWebsite } from "./communion-verifier";
import { parishAddressKey } from "./parish-address";
import { lastDayOfMonth, isLastDayOfMonth } from "./report-generator";
import { writeAdminWorkerLog } from "./logs";

const ADDRESS_MAINT_KEY = "parish-address-maint";
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

function payloadObj(p: unknown): Record<string, unknown> {
  return p && typeof p === "object" && !Array.isArray(p)
    ? { ...(p as Record<string, unknown>) }
    : {};
}

export interface AddressMaintenanceResult {
  ran: boolean;
  scanned: number;
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
  opts: { passId?: string; force?: boolean } = {},
): Promise<AddressMaintenanceResult> {
  const out: AddressMaintenanceResult = {
    ran: false,
    scanned: 0,
    keyed: 0,
    duplicatesRemoved: 0,
    detail: "",
  };
  if (
    !opts.force &&
    Date.now() - (await lastUsedAt(prisma, ADDRESS_MAINT_KEY)) < ADDRESS_MAINT_THROTTLE_MS
  ) {
    out.detail = "throttled";
    return out;
  }
  const batch = envInt("ADMIN_WORKER_PARISH_DEDUP_BATCH", 100);
  const state = await readMemory<{ cursorId: string | null }>(prisma, ADDRESS_MAINT_KEY, {
    cursorId: null,
  });

  const rows = await prisma.publishedContent
    .findMany({
      where: {
        contentType: "PARISH" as never,
        isPublished: true,
        ...(state.cursorId ? { id: { gt: state.cursorId } } : {}),
      },
      orderBy: { id: "asc" },
      take: batch,
      select: { id: true, slug: true, title: true, payload: true },
    })
    .catch(() => [] as ParishRow[]);

  out.ran = true;
  // Track the address keys we've already accepted this run so two duplicates in
  // the same batch resolve deterministically (keep the first, drop the rest).
  for (const row of rows) {
    out.scanned += 1;
    try {
      const payload = payloadObj(row.payload);
      const key = parishAddressKey({
        address: payload.address as string,
        city: payload.city as string,
        state: payload.state as string,
      });
      if (!key) continue;

      // Is there an EARLIER published parish at this same address? (Lower id =
      // seen first = the keeper.) If so, this row is the duplicate → unpublish.
      const earlier = await prisma.publishedContent
        .findFirst({
          where: {
            contentType: "PARISH" as never,
            isPublished: true,
            id: { lt: row.id },
            payload: { path: ["addressKey"], equals: key },
          },
          select: { id: true },
        })
        .catch(() => null);
      if (earlier) {
        await prisma.publishedContent
          .update({
            where: { id: row.id },
            data: { isPublished: false, unpublishedAt: new Date() },
          })
          .catch(() => undefined);
        out.duplicatesRemoved += 1;
        continue;
      }

      // Stamp the addressKey if it isn't already correct.
      if (payload.addressKey !== key) {
        payload.addressKey = key;
        await prisma.publishedContent
          .update({ where: { id: row.id }, data: { payload: payload as never } })
          .catch(() => undefined);
        out.keyed += 1;
      }
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
      safeMetadata: { scanned: out.scanned, keyed: out.keyed, deduped: out.duplicatesRemoved },
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

/** How many parishes to re-check per pass (bounds per-pass website fetches). */
const REFRESH_BATCH_DEFAULT = 40;
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
  let hardError = false;
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
      state.checked += 1;
      out.checkedThisRun += 1;
      try {
        const payload = payloadObj(row.payload);
        const website = typeof payload.website === "string" ? payload.website : "";
        if (!website) {
          // Nothing to re-read; just make sure the addressKey is stamped.
          const key = parishAddressKey({
            address: payload.address as string,
            city: payload.city as string,
            state: payload.state as string,
          });
          if (key && payload.addressKey !== key) {
            payload.addressKey = key;
            await prisma.publishedContent
              .update({ where: { id: row.id }, data: { payload: payload as never } })
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
        const key = parishAddressKey({
          address: payload.address as string,
          city: payload.city as string,
          state: payload.state as string,
        });
        if (key && payload.addressKey !== key) changes.addressKey = key;

        if (Object.keys(changes).length > 0) {
          const updated = { ...payload, ...changes };
          await prisma.publishedContent
            .update({ where: { id: row.id }, data: { payload: updated as never } })
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
      }
    }

    // Advance the cursor. A short batch means we've reached the end → done.
    if (rows.length < batchSize) {
      state.done = true;
      out.done = true;
    } else {
      state.cursorId = rows[rows.length - 1]!.id;
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
