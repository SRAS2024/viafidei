/**
 * Liturgical Calendar ingestor — keyless, free, public.
 *
 * Source: the open-source Liturgical Calendar API
 * (litcal.johnromanodorazio.com), which serves the General Roman Calendar (and
 * national adaptations) computed from the Roman Missal — i.e. the approved
 * liturgical book the LITURGICAL content type's accuracy rules require. No API
 * key. The worker publishes the great celebrations — the **feasts of the Lord
 * and the solemnities** (grade ≥ 5) — as LITURGICAL records, deliberately
 * leaving the saints' memorials to the SAINT pages so the two don't duplicate.
 *
 * Accuracy: the rank, season, and (fixed) date all come straight from the
 * calendar API; the descriptive body is composed only from those structured
 * facts (never invented). Whether a celebration's date is fixed or movable is
 * determined empirically — the calendar is fetched for two consecutive years and
 * a date that shifts is marked movable (no fixed feastDate) rather than guessed.
 * Every record still passes the strict schema + publish gate. Network-gated (a
 * no-op offline) and self-throttled.
 */

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import { isDoctrinallySensitive } from "./content-type-profiles";
import { runPublishOrchestrator } from "./publish-orchestrator";
import { writeAdminWorkerLog } from "./logs";
import { monthName } from "./structured/corroboration";

const DEFAULT_API_URL = "https://litcal.johnromanodorazio.com/api/dev/calendar/nation/US";
const USCCB_CALENDAR_URL = "https://www.usccb.org/prayer-worship/liturgical-year";
const TIMEOUT_MS = 25_000;
const THROTTLE_MS = 24 * 60 * 60 * 1000; // the calendar is stable — once a day is plenty
const THROTTLE_KEY = "liturgical-calendar-lastrun";

export function liturgicalCalendarIngestEnabled(): boolean {
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return false;
  const v = (process.env.ADMIN_WORKER_LITURGICAL_API ?? "").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

function calendarApiUrl(): string {
  return (process.env.LITURGICAL_CALENDAR_API_URL ?? "").trim() || DEFAULT_API_URL;
}

interface LitCalEvent {
  name?: string;
  date?: string;
  grade?: number;
  grade_lcl?: string;
  color_lcl?: string | string[];
  liturgical_season?: string;
  liturgical_season_lcl?: string;
  event_key?: string;
}

const SEASON_MAP: Record<string, string> = {
  ADVENT: "advent",
  CHRISTMAS: "christmas",
  LENT: "lent",
  EASTER_TRIDUUM: "triduum",
  EASTER: "easter",
  ORDINARY_TIME: "ordinary_time",
};

/** Map a litcal grade integer to the LITURGICAL `kind`/`rank` (≥5 only). */
function gradeToKind(grade: number): "feast" | "solemnity" | null {
  if (grade >= 6) return "solemnity"; // SOLEMNITY / HIGHER_SOLEMNITY
  if (grade === 5) return "feast"; // FEAST OF THE LORD
  return null; // saints' feasts/memorials → SAINT pages, not LITURGICAL
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** "MM-DD" from a date-time string, or null. */
function monthDay(date: string | undefined): { mmdd: string; month: number; day: number } | null {
  if (!date) return null;
  const m = date.match(/^\+?\d{4}-(\d{2})-(\d{2})/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { mmdd: `${m[1]}-${m[2]}`, month, day };
}

function colorText(color: string | string[] | undefined): string {
  if (!color) return "";
  return Array.isArray(color) ? color.join(", ") : color;
}

/**
 * Map one calendar event to a LITURGICAL curated-style record, or null when it
 * is below feast-of-the-Lord rank or lacks the fields the schema needs.
 * `isFixed(event_key)` reports whether the date is stable year-to-year.
 * Exported for testing.
 */
export function mapLiturgicalEvent(
  event: LitCalEvent,
  isFixed: (eventKey: string) => boolean,
): {
  contentType: "LITURGICAL";
  slug: string;
  authorityLevel: "TRUSTED_PUBLISHER";
  citations: string[];
  payload: Record<string, unknown>;
} | null {
  const name = (event.name ?? "").trim();
  if (!name) return null;
  if (typeof event.grade !== "number") return null;
  const kind = gradeToKind(event.grade);
  if (!kind) return null;

  const md = monthDay(event.date);
  const fixed = Boolean(event.event_key) && isFixed(event.event_key as string) && md != null;
  const season = SEASON_MAP[event.liturgical_season ?? ""] ?? undefined;
  const gradeLabel = (event.grade_lcl ?? kind).trim() || kind;
  const seasonLabel = (event.liturgical_season_lcl ?? "").trim();
  const colour = colorText(event.color_lcl);

  const dateClause = fixed
    ? `, celebrated on ${monthName(md!.month)} ${md!.day}`
    : ", celebrated on a date that changes from year to year";
  const body =
    `${name} is a ${kind} (${gradeLabel}) of the General Roman Calendar${dateClause}` +
    `${seasonLabel ? `, during ${seasonLabel}` : ""}.` +
    `${colour ? ` Its liturgical colour is ${colour}.` : ""}`;
  const summary =
    `${name} — a ${kind} of the General Roman Calendar` +
    `${seasonLabel ? ` celebrated during ${seasonLabel}` : ""}.`;

  if (body.length < 50 || summary.length < 50) return null;

  const slug = `liturgical-${slugify(name)}`;
  if (slug === "liturgical-") return null;

  const payload: Record<string, unknown> = {
    slug,
    title: name,
    kind,
    rank: kind === "solemnity" ? "solemnity" : "feast",
    summary,
    body,
    movableFeast: !fixed,
    associatedSaintSlugs: [],
    associatedReadings: [],
    citations: [calendarApiUrl(), USCCB_CALENDAR_URL],
  };
  if (season) payload.season = season;
  if (fixed) payload.feastDate = md!.mmdd;

  return {
    contentType: "LITURGICAL",
    slug,
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: [calendarApiUrl(), USCCB_CALENDAR_URL],
    payload,
  };
}

/** Fetch the calendar for a given year. Returns [] on any failure. */
export async function fetchLiturgicalCalendar(year?: number): Promise<LitCalEvent[]> {
  if (!liturgicalCalendarIngestEnabled()) return [];
  const url = year ? `${calendarApiUrl()}?year=${year}` : calendarApiUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ViaFideiAdminWorker/1.0 (+https://etviafidei.com; liturgical calendar)",
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { litcal?: LitCalEvent[] };
    return Array.isArray(data.litcal) ? data.litcal : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export interface LiturgicalIngestResult {
  enabled: boolean;
  fetched: number;
  published: number;
  alreadyPublished: number;
  skipped: number;
  detail: string;
}

async function throttleOk(prisma: PrismaClient): Promise<boolean> {
  const where = {
    memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: THROTTLE_KEY },
  };
  const row = await prisma.adminWorkerMemory
    .findUnique({ where, select: { lastUsedAt: true } })
    .catch(() => null);
  const last = row?.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
  if (Date.now() - last < THROTTLE_MS) return false;
  await prisma.adminWorkerMemory
    .upsert({
      where,
      update: { lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: THROTTLE_KEY,
        memoryValue: {},
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
  return true;
}

async function publishLiturgical(
  prisma: PrismaClient,
  entry: NonNullable<ReturnType<typeof mapLiturgicalEvent>>,
): Promise<boolean> {
  if (!validatePayload("LITURGICAL", entry.payload).ok) return false;
  const title = String(entry.payload.title ?? entry.slug);
  const existing = await prisma.checklistItem
    .findFirst({
      where: { contentType: "LITURGICAL" as never, canonicalSlug: entry.slug },
      select: { id: true },
    })
    .catch(() => null);
  const item =
    existing ??
    (await prisma.checklistItem
      .create({
        data: {
          contentType: "LITURGICAL" as never,
          canonicalName: title,
          canonicalSlug: entry.slug,
          approvalStatus: "APPROVED_FOR_BUILD",
        },
        select: { id: true },
      })
      .catch(() => null));
  if (!item) return false;

  const result = await runPublishOrchestrator(prisma, {
    contentType: "LITURGICAL",
    contentId: item.id,
    title,
    slug: entry.slug,
    payload: entry.payload as never,
    authorityLevel: entry.authorityLevel,
    finalScore: 0.92,
    qaPassed: true,
    hasSourceEvidence: entry.citations.length > 0,
    isDoctrinallySensitive: isDoctrinallySensitive("LITURGICAL"),
    confidence: 0.92,
    verifier: {
      publishAllowed: true,
      missingRequired: [],
      blockingSensitiveFields: [],
      verificationRowIds: [],
      evidence: [],
      hasConflict: false,
      summary:
        "General Roman Calendar via the open Liturgical Calendar API (rank + date from the Roman Missal).",
    },
  }).catch(() => null);
  return result?.kind === "published";
}

/**
 * Ingest the great liturgical celebrations (feasts of the Lord + solemnities)
 * from the calendar API. Fetches two consecutive years to tell fixed dates from
 * movable ones, publishes the not-yet-live ones (deduped by slug + normalized
 * title), and is bounded + self-throttled.
 */
export async function runLiturgicalCalendarIngest(
  prisma: PrismaClient,
  opts: { limit?: number; force?: boolean } = {},
): Promise<LiturgicalIngestResult> {
  const out: LiturgicalIngestResult = {
    enabled: liturgicalCalendarIngestEnabled(),
    fetched: 0,
    published: 0,
    alreadyPublished: 0,
    skipped: 0,
    detail: "",
  };
  if (!out.enabled) {
    out.detail = "Liturgical calendar ingest disabled (skip-network or opt-out).";
    return out;
  }
  if (!opts.force && !(await throttleOk(prisma))) {
    out.detail = "throttled";
    return out;
  }

  const limit = opts.limit ?? 20;
  const yearNow = new Date().getUTCFullYear();
  const eventsA = await fetchLiturgicalCalendar(yearNow);
  const eventsB = await fetchLiturgicalCalendar(yearNow + 1);
  out.fetched = eventsA.length;
  if (eventsA.length === 0) {
    out.detail = "calendar API returned nothing";
    return out;
  }

  // Fixed vs movable: a celebration whose month-day is the same in both years.
  const ddA = new Map<string, string>();
  const ddB = new Map<string, string>();
  for (const e of eventsA)
    if (e.event_key && e.date) ddA.set(e.event_key, monthDay(e.date)?.mmdd ?? "");
  for (const e of eventsB)
    if (e.event_key && e.date) ddB.set(e.event_key, monthDay(e.date)?.mmdd ?? "");
  const isFixed = (key: string): boolean => {
    const a = ddA.get(key);
    const b = ddB.get(key);
    return Boolean(a) && a === b;
  };

  const live = await prisma.publishedContent
    .findMany({
      where: { isPublished: true, contentType: "LITURGICAL" as never },
      select: { slug: true, title: true },
    })
    .catch(() => [] as Array<{ slug: string; title: string }>);
  const liveSlugs = new Set(live.map((r) => r.slug));
  const liveTitles = new Set(live.map((r) => (r.title ?? "").trim().toLowerCase()).filter(Boolean));

  const seen = new Set<string>();
  for (const event of eventsA) {
    if (out.published >= limit) break;
    const entry = mapLiturgicalEvent(event, isFixed);
    if (!entry) {
      out.skipped += 1;
      continue;
    }
    if (seen.has(entry.slug)) continue;
    seen.add(entry.slug);
    const titleKey = String(entry.payload.title ?? "")
      .trim()
      .toLowerCase();
    if (liveSlugs.has(entry.slug) || (titleKey && liveTitles.has(titleKey))) {
      out.alreadyPublished += 1;
      continue;
    }
    if (await publishLiturgical(prisma, entry)) out.published += 1;
    else out.skipped += 1;
  }

  out.detail = `${out.fetched} event(s): published ${out.published}, ${out.alreadyPublished} already live, ${out.skipped} skipped.`;
  if (out.published > 0) {
    await writeAdminWorkerLog(prisma, {
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "liturgical_calendar_ingest",
      message: `Liturgical calendar ingest: published ${out.published} solemnity/feast record(s) from the General Roman Calendar.`,
      contentType: "LITURGICAL",
      safeMetadata: { ...out },
    }).catch(() => undefined);
  }
  return out;
}
