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
 * Pluggable readings fetcher. By default returns null — no trusted parser
 * is configured, so the worker routes to review rather than guessing.
 * A real implementation (a verified USCCB/Universalis/Vatican parser,
 * managed by TypeScript with rate limits + sandboxing) can be slotted in
 * here; it must return verified bodies with a confidence score, never
 * fabricated text.
 */
export async function fetchReadingsForDate(
  _date: Date,
  _opts: { calendar: string; locale: string },
): Promise<FetchedReadings | null> {
  return null;
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
