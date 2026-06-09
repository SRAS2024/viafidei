/**
 * Daily liturgical readings refresh (spec: "Add daily liturgical readings
 * as internal app content" + "Add intelligence for daily readings").
 *
 * The worker keeps one DailyReading row per (date, calendar, locale):
 *   - It always stores the deterministic liturgical framing (season,
 *     cycles, colour) + the authoritative source URL.
 *   - When a trusted source/parser supplies the readings text with high
 *     confidence, the row is PUBLISHED with verified bodies.
 *   - When the readings cannot be confidently determined (no parser, low
 *     confidence, calendar ambiguity), the row stays in REVIEW, a
 *     human-review task is filed, and a developer request asks for a
 *     trusted readings source/parser. The worker NEVER fabricates the text
 *     and never publishes uncertain readings.
 *
 * Date-sensitivity: a PUBLISHED row is considered fresh for ~20h, so a
 * daily run re-verifies and prevents stale / wrong-date readings.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import {
  buildReadingFraming,
  buildReadingSkeleton,
  isoDate,
  type ReadingSection,
} from "@/lib/content-shared/daily-readings";

import { acquireReadings } from "./readings-source";
import { classifyFreshness, isBrainEnabled } from "./intelligence";
import { recordBrainCall, upsertDeveloperRequest } from "./intelligence/store";
import { writeAdminWorkerLog } from "./logs";

const FRESH_WINDOW_MS = 20 * 60 * 60 * 1000;

export interface ReadingsRefreshResult {
  date: string;
  status: "fresh" | "published" | "review" | "error";
  reviewQueued: boolean;
  developerRequestFiled: boolean;
  message: string;
}

interface FetchedReadings {
  sections: ReadingSection[];
  sourceUrl?: string;
  sourceName?: string;
  confidence: number;
}

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Resolve a day's readings through the worker's readings-source framework
 * (see readings-source.ts): the offline deterministic lectionary table first,
 * then any configured authoritative dataset. No fabrication — null when no
 * source has the day, so the caller routes to review + the official link.
 */
export async function fetchReadingsForDate(
  date: Date,
  opts: { calendar: string; locale: string },
): Promise<FetchedReadings | null> {
  const acquired = await acquireReadings(date, opts);
  if (!acquired) return null;
  return {
    sections: acquired.sections,
    sourceName: acquired.source === "lectionary-table" ? undefined : acquired.source,
    confidence: acquired.confidence,
  };
}

async function ensureReviewTask(
  prisma: PrismaClient,
  iso: string,
  sourceUrl: string,
): Promise<boolean> {
  const contentTitle = `Daily readings — ${iso}`;
  try {
    const existing = await prisma.humanReviewQueue.findFirst({
      where: { status: "PENDING", contentType: "READING", contentTitle },
      select: { id: true },
    });
    if (existing) return false;
    await prisma.humanReviewQueue.create({
      data: {
        contentType: "READING",
        contentTitle,
        proposedAction: "publish-daily-readings",
        reason: `Readings text for ${iso} could not be confidently determined automatically. Verify against the trusted source before publishing.`,
        confidence: 0,
        sourceEvidence: { sourceUrl } as Prisma.InputJsonValue,
      },
    });
    return true;
  } catch {
    return false;
  }
}

async function fileReadingsDeveloperRequest(prisma: PrismaClient): Promise<boolean> {
  const res = await upsertDeveloperRequest(
    prisma,
    {
      kind: "source",
      title: "Trusted daily-readings source + parser",
      detail:
        "I can frame the liturgical day (season, cycle, colour) and link the source, but I have no verified parser to extract the actual reading texts. I need a trusted daily-readings source + parser so I can publish the readings in-app instead of routing every day to review.",
      severity: "high",
      evidence: "DailyReading rows remain in REVIEW because no readings parser is configured.",
    },
    "daily_readings",
  );
  return res?.created ?? false;
}

export async function refreshDailyReadings(
  prisma: PrismaClient,
  opts: { date?: Date; calendar?: string; locale?: string; passId?: string } = {},
): Promise<ReadingsRefreshResult> {
  const calendar = opts.calendar ?? "roman-ordinary";
  const locale = opts.locale ?? "en";
  const date = utcMidnight(opts.date ?? new Date());
  const iso = isoDate(date);
  const framing = buildReadingFraming(date);

  try {
    const existing = await prisma.dailyReading.findUnique({
      where: { date_calendar_locale: { date, calendar, locale } },
    });

    if (
      existing?.status === "PUBLISHED" &&
      existing.verifiedAt &&
      Date.now() - existing.verifiedAt.getTime() < FRESH_WINDOW_MS
    ) {
      return {
        date: iso,
        status: "fresh",
        reviewQueued: false,
        developerRequestFiled: false,
        message: "Readings already published and fresh.",
      };
    }

    // Freshness intelligence (best-effort, illustrative): confirm this is
    // DAILY content and record the brain's classification.
    if (isBrainEnabled()) {
      const fr = await classifyFreshness({
        contentType: "LITURGICAL",
        title: `Daily Mass Readings ${iso}`,
      }).catch(() => null);
      await recordBrainCall(prisma, "classify_freshness", fr, {
        contentType: "READING",
        entityId: iso,
        passId: opts.passId ?? null,
      }).catch(() => undefined);
    }

    const baseData = {
      calendar,
      locale,
      seasonLabel: framing.seasonLabel,
      sundayCycle: framing.sundayCycle,
      weekdayCycle: framing.weekdayCycle,
      color: framing.color,
      sourceUrl: framing.sourceUrl,
      sourceName: framing.sourceName,
    };

    const fetched = await fetchReadingsForDate(date, { calendar, locale });
    if (fetched && fetched.confidence >= 0.7) {
      const data = {
        ...baseData,
        sections: fetched.sections as unknown as Prisma.InputJsonValue,
        sourceUrl: fetched.sourceUrl ?? framing.sourceUrl,
        sourceName: fetched.sourceName ?? framing.sourceName,
        sourceConfidence: fetched.confidence,
        status: "PUBLISHED",
        verifiedAt: new Date(),
      };
      await prisma.dailyReading.upsert({
        where: { date_calendar_locale: { date, calendar, locale } },
        create: { date, ...data },
        update: data,
      });
      await writeAdminWorkerLog(prisma, {
        passId: opts.passId,
        category: "CONTENT_BUILD",
        severity: "INFO",
        eventName: "daily_readings_published",
        message: `Published verified daily readings for ${iso} (confidence ${fetched.confidence.toFixed(2)}).`,
      }).catch(() => undefined);
      return {
        date: iso,
        status: "published",
        reviewQueued: false,
        developerRequestFiled: false,
        message: "Readings verified and published.",
      };
    }

    // Cannot confidently determine the readings → review, never publish
    // uncertain text. Preserve any previously PUBLISHED row rather than
    // blanking it.
    const reviewQueued = await ensureReviewTask(prisma, iso, framing.sourceUrl);
    const developerRequestFiled = await fileReadingsDeveloperRequest(prisma);

    if (!existing || existing.status !== "PUBLISHED") {
      const data = {
        ...baseData,
        sections: buildReadingSkeleton(date) as unknown as Prisma.InputJsonValue,
        sourceConfidence: 0,
        status: "REVIEW",
      };
      await prisma.dailyReading.upsert({
        where: { date_calendar_locale: { date, calendar, locale } },
        create: { date, ...data },
        update: data,
      });
    }

    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "daily_readings_review",
      message: `Daily readings for ${iso} routed to review (no verified text). Source: ${framing.sourceUrl}`,
      safeMetadata: { reviewQueued, developerRequestFiled },
    }).catch(() => undefined);

    return {
      date: iso,
      status: "review",
      reviewQueued,
      developerRequestFiled,
      message: "Readings could not be verified; routed to review (not published).",
    };
  } catch (err) {
    return {
      date: iso,
      status: "error",
      reviewQueued: false,
      developerRequestFiled: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// Throttle so the loop can call this every pass cheaply; it actually
// refreshes at most once per window per process.
let lastRefreshAt = 0;
const REFRESH_THROTTLE_MS = 30 * 60 * 1000;

/** Loop-friendly throttled wrapper around {@link refreshDailyReadings}. */
export async function maybeRefreshDailyReadings(
  prisma: PrismaClient,
  opts: { passId?: string } = {},
): Promise<ReadingsRefreshResult | null> {
  if (Date.now() - lastRefreshAt < REFRESH_THROTTLE_MS) return null;
  lastRefreshAt = Date.now();
  return refreshDailyReadings(prisma, { passId: opts.passId });
}

export interface BackfillResult {
  scanned: number;
  created: number;
  updated: number;
  unchanged: number;
  published: number;
  review: number;
}

interface StoredRowShape {
  status?: string | null;
  seasonLabel?: string | null;
  sundayCycle?: string | null;
  weekdayCycle?: string | null;
  color?: string | null;
  sourceConfidence?: number | null;
  sections?: unknown;
  verifiedAt?: Date | null;
}

interface DesiredRow {
  seasonLabel: string;
  sundayCycle: string;
  weekdayCycle: string;
  color: string;
  sourceUrl: string;
  sourceName: string;
  sourceConfidence: number;
  status: string;
  sections: ReadingSection[];
}

/** True when the stored row no longer matches what the engine now produces. */
function readingRowDiffers(existing: StoredRowShape, desired: DesiredRow): boolean {
  return (
    (existing.status ?? "") !== desired.status ||
    (existing.seasonLabel ?? "") !== desired.seasonLabel ||
    (existing.sundayCycle ?? "") !== desired.sundayCycle ||
    (existing.weekdayCycle ?? "") !== desired.weekdayCycle ||
    (existing.color ?? "") !== desired.color ||
    (existing.sourceConfidence ?? 0) !== desired.sourceConfidence ||
    JSON.stringify(existing.sections ?? null) !== JSON.stringify(desired.sections)
  );
}

/**
 * Autonomously fill + verify a forward window of daily readings (spec: the
 * Admin Worker manages the liturgical calendar and stores every day's
 * readings). For each date in the window it derives the day from the verified
 * calendar engine, resolves the readings from the lectionary, and:
 *   - creates the DailyReading row if missing,
 *   - UPDATES it if it has drifted from the engine's current output — e.g. a
 *     day upgrades REVIEW → PUBLISHED the moment its lectionary entry is added,
 *     or a stale/incorrect row is corrected (the worker "reviews + adjusts"),
 *   - leaves unchanged rows untouched (idempotent — most scans write nothing).
 * It never downgrades a PUBLISHED day to REVIEW, so coverage can only improve.
 * Covered days store verified text; the rest store framing + the official link.
 */
export async function backfillDailyReadings(
  prisma: PrismaClient,
  opts: { from?: Date; days?: number; passId?: string } = {},
): Promise<BackfillResult> {
  const calendar = "roman-ordinary";
  const locale = "en";
  const start = utcMidnight(opts.from ?? new Date());
  const days = Math.max(1, opts.days ?? 400);
  const end = new Date(start.getTime() + (days - 1) * 86_400_000);

  const existingRows = await prisma.dailyReading
    .findMany({ where: { calendar, locale, date: { gte: start, lte: end } } })
    .catch(() => [] as Array<StoredRowShape & { date: Date }>);
  const byIso = new Map<string, StoredRowShape>();
  for (const r of existingRows as Array<StoredRowShape & { date: Date }>) {
    byIso.set(isoDate(new Date(r.date)), r);
  }

  const result: BackfillResult = {
    scanned: days,
    created: 0,
    updated: 0,
    unchanged: 0,
    published: 0,
    review: 0,
  };

  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + i * 86_400_000);
    const framing = buildReadingFraming(date);
    const fetched = await fetchReadingsForDate(date, { calendar, locale });
    const hasText = !!fetched && fetched.confidence >= 0.7;
    const sections = hasText && fetched ? fetched.sections : framing.sections;
    const desired: DesiredRow = {
      seasonLabel: framing.seasonLabel,
      sundayCycle: framing.sundayCycle,
      weekdayCycle: framing.weekdayCycle,
      color: framing.color,
      sourceUrl: framing.sourceUrl,
      sourceName: framing.sourceName,
      sourceConfidence: hasText && fetched ? fetched.confidence : 0,
      status: hasText ? "PUBLISHED" : "REVIEW",
      sections,
    };
    if (hasText) result.published++;
    else result.review++;

    const existing = byIso.get(framing.date);
    // Never blank a previously verified day if its coverage regresses.
    if (existing && (existing.status ?? "") === "PUBLISHED" && desired.status === "REVIEW") {
      result.unchanged++;
      continue;
    }
    const payload = {
      calendar,
      locale,
      seasonLabel: desired.seasonLabel,
      sundayCycle: desired.sundayCycle,
      weekdayCycle: desired.weekdayCycle,
      color: desired.color,
      sourceUrl: desired.sourceUrl,
      sourceName: desired.sourceName,
      sourceConfidence: desired.sourceConfidence,
      status: desired.status,
      sections: desired.sections as unknown as Prisma.InputJsonValue,
      verifiedAt: hasText ? new Date() : (existing?.verifiedAt ?? null),
    };
    if (!existing) {
      await prisma.dailyReading
        .create({ data: { date, ...payload } })
        .then(() => result.created++)
        .catch(() => undefined);
    } else if (readingRowDiffers(existing, desired)) {
      await prisma.dailyReading
        .update({ where: { date_calendar_locale: { date, calendar, locale } }, data: payload })
        .then(() => result.updated++)
        .catch(() => undefined);
    } else {
      result.unchanged++;
    }
  }

  await writeAdminWorkerLog(prisma, {
    passId: opts.passId,
    category: "CONTENT_BUILD",
    severity: "INFO",
    eventName: "daily_readings_backfill",
    message: `Daily-readings scan of ${result.scanned} day(s): ${result.created} created, ${result.updated} adjusted, ${result.published} with verified text, ${result.review} on the official link.`,
    safeMetadata: { ...result },
  }).catch(() => undefined);

  return result;
}

// Backfill is heavier than the today-refresh, so it runs on a slower cadence;
// each run re-verifies the whole forward window and self-corrects any drift.
let lastBackfillAt = 0;
const BACKFILL_THROTTLE_MS = 6 * 60 * 60 * 1000;

/** Loop-friendly throttled wrapper around {@link backfillDailyReadings}. */
export async function maybeBackfillDailyReadings(
  prisma: PrismaClient,
  opts: { passId?: string } = {},
): Promise<BackfillResult | null> {
  if (Date.now() - lastBackfillAt < BACKFILL_THROTTLE_MS) return null;
  lastBackfillAt = Date.now();
  return backfillDailyReadings(prisma, { passId: opts.passId });
}

/** Read the stored DailyReading row for a date (any status), for the page. */
export async function getStoredReading(
  prisma: PrismaClient,
  date: Date,
  opts: { calendar?: string; locale?: string } = {},
) {
  const calendar = opts.calendar ?? "roman-ordinary";
  const locale = opts.locale ?? "en";
  return prisma.dailyReading
    .findUnique({ where: { date_calendar_locale: { date: utcMidnight(date), calendar, locale } } })
    .catch(() => null);
}
