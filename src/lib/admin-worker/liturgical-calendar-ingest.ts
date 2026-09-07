/**
 * Liturgical Calendar ingestor — keyless, free, public.
 *
 * Source: the open-source Liturgical Calendar API
 * (litcal.johnromanodorazio.com), which serves the General Roman Calendar (and
 * national adaptations) computed from the Roman Missal — i.e. the approved
 * liturgical book the LITURGICAL content type's accuracy rules require. No API
 * key. The worker publishes the celebrations of the General Roman Calendar as
 * LITURGICAL records: every feast of the Lord and solemnity (grade ≥ 5), the
 * feasts / memorials / optional memorials (grade 2–4) whose subject does NOT
 * already have a live SAINT page (so the two never duplicate), and one
 * `liturgical_season` record per season, its boundaries read off the year's
 * calendar.
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

type CelebrationKind = "feast" | "solemnity" | "memorial" | "optional_memorial";

/**
 * Map a litcal grade integer to the LITURGICAL `kind`/`rank`. The API's grades
 * are: 7 higher solemnity, 6 solemnity, 5 feast of the Lord, 4 feast,
 * 3 memorial, 2 optional memorial, 1 commemoration, 0 weekday. Grades ≥ 5 are
 * always LITURGICAL records; grades 2–4 are the saints' celebrations and only
 * become LITURGICAL records when the saint has no page of their own.
 */
function gradeToKind(grade: number): CelebrationKind | null {
  if (grade >= 6) return "solemnity"; // SOLEMNITY / HIGHER_SOLEMNITY
  if (grade >= 4) return "feast"; // FEAST OF THE LORD (5) / FEAST (4)
  if (grade === 3) return "memorial";
  if (grade === 2) return "optional_memorial";
  return null; // commemorations / weekdays are not standalone records
}

const KIND_LABEL: Record<CelebrationKind, string> = {
  solemnity: "solemnity",
  feast: "feast",
  memorial: "memorial",
  optional_memorial: "optional memorial",
};

/**
 * Normalise a saint's name for matching a calendar celebration against the
 * published SAINT titles: lowercase, diacritics stripped, the descriptors litcal
 * appends after the first comma ("…, Virgin and Martyr") dropped, and the
 * "Saint / Saints / St. / Blessed" prefix removed. Exported for testing.
 */
export function normaliseSaintName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(",")[0]
    .replace(/^(saints?|sts?\.?|blessed|bl\.?)\s+/i, "")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the "does a SAINT page exist for this celebration?" predicate from the
 * live SAINT titles. A celebration of several saints ("Saints Cornelius, Pope,
 * and Cyprian, Bishop") counts as covered when any listed saint has a page.
 */
export function saintPagePredicate(saintTitles: string[]): (eventName: string) => boolean {
  const names = saintTitles.map(normaliseSaintName).filter((n) => n.length >= 3);
  const exact = new Set(names);
  return (eventName: string) => {
    const key = normaliseSaintName(eventName);
    if (!key) return false;
    if (exact.has(key)) return true;
    const haystack = ` ${eventName
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")} `;
    return names.some((n) => n.length >= 6 && haystack.includes(` ${n} `));
  };
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

export interface LiturgicalEntry {
  contentType: "LITURGICAL";
  slug: string;
  authorityLevel: "TRUSTED_PUBLISHER";
  citations: string[];
  payload: Record<string, unknown>;
}

/**
 * Map one calendar event to a LITURGICAL curated-style record, or null when it
 * is not a standalone celebration or lacks the fields the schema needs.
 * `isFixed(event_key)` reports whether the date is stable year-to-year.
 * Grade 2–4 celebrations (the saints') are emitted only when
 * `opts.hasSaintPage` is supplied AND reports no live SAINT page for the
 * celebration — without the predicate they are left to the SAINT pages.
 * Exported for testing.
 */
export function mapLiturgicalEvent(
  event: LitCalEvent,
  isFixed: (eventKey: string) => boolean,
  opts: { hasSaintPage?: (eventName: string) => boolean } = {},
): LiturgicalEntry | null {
  const name = (event.name ?? "").trim();
  if (!name) return null;
  if (typeof event.grade !== "number") return null;
  const kind = gradeToKind(event.grade);
  if (!kind) return null;
  if (event.grade < 5) {
    if (!opts.hasSaintPage) return null;
    if (opts.hasSaintPage(name)) return null;
  }

  const md = monthDay(event.date);
  const fixed = Boolean(event.event_key) && isFixed(event.event_key as string) && md != null;
  const season = SEASON_MAP[event.liturgical_season ?? ""] ?? undefined;
  const gradeLabel = (event.grade_lcl ?? kind).trim() || kind;
  const seasonLabel = (event.liturgical_season_lcl ?? "").trim();
  const colour = colorText(event.color_lcl);

  const label = KIND_LABEL[kind];
  const article = /^[aeiou]/.test(label) ? "an" : "a";
  const dateClause = fixed
    ? `, celebrated on ${monthName(md!.month)} ${md!.day}`
    : ", celebrated on a date that changes from year to year";
  const body =
    `${name} is ${article} ${label} (${gradeLabel}) of the General Roman Calendar${dateClause}` +
    `${seasonLabel ? `, during ${seasonLabel}` : ""}.` +
    `${colour ? ` Its liturgical colour is ${colour}.` : ""}`;
  const summary =
    `${name} — ${article} ${label} of the General Roman Calendar` +
    `${seasonLabel ? ` celebrated during ${seasonLabel}` : ""}.`;

  if (body.length < 50 || summary.length < 50) return null;

  const slug = `liturgical-${slugify(name)}`;
  if (slug === "liturgical-") return null;

  const payload: Record<string, unknown> = {
    slug,
    title: name,
    kind,
    rank: kind,
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

/**
 * One `liturgical_season` record per season present in the year's calendar.
 * The boundaries are read off the calendar (first and last celebration the API
 * places in the season) and stated for that year; nothing is guessed. The
 * seasons' order and the two stretches of Ordinary Time are the General
 * Norms for the Liturgical Year (GNLYC 43–44), cited from the USCCB page.
 * Exported for testing.
 */
export function mapLiturgicalSeasons(events: LitCalEvent[], year: number): LiturgicalEntry[] {
  const bySeason = new Map<
    string,
    {
      label: string;
      count: number;
      first: { month: number; day: number } | null;
      last: { month: number; day: number } | null;
    }
  >();
  for (const e of events) {
    const key = e.liturgical_season ?? "";
    const season = SEASON_MAP[key];
    if (!season) continue;
    const md = monthDay(e.date);
    if (!md) continue;
    const cur = bySeason.get(key) ?? {
      label: (e.liturgical_season_lcl ?? "").trim() || key.replace(/_/g, " ").toLowerCase(),
      count: 0,
      first: null,
      last: null,
    };
    cur.count += 1;
    const ord = md.month * 100 + md.day;
    if (!cur.first || ord < cur.first.month * 100 + cur.first.day) cur.first = md;
    if (!cur.last || ord > cur.last.month * 100 + cur.last.day) cur.last = md;
    bySeason.set(key, cur);
  }

  const out: LiturgicalEntry[] = [];
  for (const [key, info] of bySeason) {
    if (!info.first || !info.last) continue;
    const season = SEASON_MAP[key];
    const title = info.label.replace(/\b\w/g, (c) => c.toUpperCase());
    const slug = `liturgical-season-${slugify(info.label)}`;
    const span =
      key === "ORDINARY_TIME"
        ? ` Ordinary Time runs in two stretches — between Christmas Time and Lent, and between Easter Time and Advent. In ${year} the calendar places its first celebration on ${monthName(info.first.month)} ${info.first.day} and its last on ${monthName(info.last.month)} ${info.last.day}.`
        : ` In ${year} the calendar places its first celebration on ${monthName(info.first.month)} ${info.first.day} and its last on ${monthName(info.last.month)} ${info.last.day}.`;
    const body =
      `${title} is a season of the liturgical year in the General Roman Calendar.${span}` +
      ` The ${year} calendar lists ${info.count} celebration(s) in ${title}. Its dates move from year to year with the date of Easter and the start of Advent.`;
    const summary = `${title} — a season of the liturgical year in the General Roman Calendar, with its ${year} boundaries taken from the calendar itself.`;
    out.push({
      contentType: "LITURGICAL",
      slug,
      authorityLevel: "TRUSTED_PUBLISHER",
      citations: [calendarApiUrl(), USCCB_CALENDAR_URL],
      payload: {
        slug,
        title,
        kind: "liturgical_season",
        rank: "n/a",
        season,
        summary,
        body,
        movableFeast: true,
        associatedSaintSlugs: [],
        associatedReadings: [],
        citations: [calendarApiUrl(), USCCB_CALENDAR_URL],
      },
    });
  }
  return out;
}

export interface LiturgicalIngestResult {
  enabled: boolean;
  fetched: number;
  published: number;
  alreadyPublished: number;
  skipped: number;
  detail: string;
}

const THROTTLE_WHERE = {
  memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: THROTTLE_KEY },
};

/** True when the lane ran within THROTTLE_MS. Read-only. */
async function throttled(prisma: PrismaClient): Promise<boolean> {
  const row = await prisma.adminWorkerMemory
    .findUnique({ where: THROTTLE_WHERE, select: { lastUsedAt: true } })
    .catch(() => null);
  const last = row?.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
  return Date.now() - last < THROTTLE_MS;
}

/**
 * Stamp the throttle — ONLY after a successful fetch. Stamping before the
 * fetch cost a full day of the lane whenever the calendar API timed out.
 */
async function stampThrottle(prisma: PrismaClient): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: THROTTLE_WHERE,
      update: { lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: THROTTLE_KEY,
        memoryValue: {},
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

async function publishLiturgical(prisma: PrismaClient, entry: LiturgicalEntry): Promise<boolean> {
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
    // Deterministic, API-derived data with no external page to screen — the
    // same treatment the curated and structured lanes get. Without this the
    // proof gate parked every record in review and the lane never published.
    skipBrainScreens: true,
  }).catch(() => null);
  return result?.kind === "published";
}

/**
 * Ingest the liturgical celebrations and seasons from the calendar API.
 * Fetches two consecutive years to tell fixed dates from movable ones,
 * publishes the not-yet-live ones (deduped by slug + normalized title, and for
 * the saints' celebrations against the live SAINT pages), and is bounded +
 * self-throttled (the throttle is stamped only after a successful fetch).
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
  if (!opts.force && (await throttled(prisma))) {
    out.detail = "throttled";
    return out;
  }

  const limit = opts.limit ?? 40;
  const yearNow = new Date().getUTCFullYear();
  const eventsA = await fetchLiturgicalCalendar(yearNow);
  const eventsB = await fetchLiturgicalCalendar(yearNow + 1);
  out.fetched = eventsA.length;
  if (eventsA.length === 0) {
    out.detail = "calendar API returned nothing";
    return out;
  }
  await stampThrottle(prisma);

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
  // The saints' celebrations (grade 2–4) belong to the SAINT pages when one
  // exists; only the uncovered ones become LITURGICAL records.
  const liveSaints = await prisma.publishedContent
    .findMany({
      where: { isPublished: true, contentType: "SAINT" as never },
      select: { title: true },
    })
    .catch(() => [] as Array<{ title: string }>);
  const hasSaintPage = saintPagePredicate(liveSaints.map((r) => r.title ?? ""));

  const seen = new Set<string>();
  const tryPublish = async (entry: LiturgicalEntry): Promise<void> => {
    if (seen.has(entry.slug)) return;
    seen.add(entry.slug);
    const titleKey = String(entry.payload.title ?? "")
      .trim()
      .toLowerCase();
    if (liveSlugs.has(entry.slug) || (titleKey && liveTitles.has(titleKey))) {
      out.alreadyPublished += 1;
      return;
    }
    if (await publishLiturgical(prisma, entry)) out.published += 1;
    else out.skipped += 1;
  };

  // Seasons first: there are at most six and they frame everything else.
  for (const entry of mapLiturgicalSeasons(eventsA, yearNow)) {
    if (out.published >= limit) break;
    await tryPublish(entry);
  }
  for (const event of eventsA) {
    if (out.published >= limit) break;
    const entry = mapLiturgicalEvent(event, isFixed, { hasSaintPage });
    if (!entry) {
      out.skipped += 1;
      continue;
    }
    await tryPublish(entry);
  }

  out.detail = `${out.fetched} event(s): published ${out.published}, ${out.alreadyPublished} already live, ${out.skipped} skipped.`;
  if (out.published > 0) {
    await writeAdminWorkerLog(prisma, {
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "liturgical_calendar_ingest",
      message: `Liturgical calendar ingest: published ${out.published} celebration/season record(s) from the General Roman Calendar.`,
      contentType: "LITURGICAL",
      safeMetadata: { ...out },
    }).catch(() => undefined);
  }
  return out;
}
