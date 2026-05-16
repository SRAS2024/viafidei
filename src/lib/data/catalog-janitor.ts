import type { ContentStatus } from "@prisma/client";
import { prisma } from "../db/client";
import { cleanIngestedItem } from "../ingestion/clean";
import { formatIngestedItem } from "../ingestion/format";
import {
  classifySeverity,
  looksLikeLandingPage,
  looksLikeMetaDescription,
  looksLikeNonContent,
  validateItem,
} from "../ingestion/validate";
import type {
  IngestedApparition,
  IngestedDevotion,
  IngestedGuide,
  IngestedItem,
  IngestedLiturgy,
  IngestedPrayer,
  IngestedSaint,
} from "../ingestion/types";
import { recordDataManagementLogs, type DataManagementLogInput } from "./data-management-log";

/**
 * The catalog janitor is the continuous self-managing pass that
 * inspects every PUBLISHED row in the catalog tables and:
 *
 *   1. **Repackages** — re-runs `formatIngestedItem` + `cleanIngestedItem`
 *      against the stored text. If the cleaned version differs from
 *      what's in the row, UPDATE the row to the cleaned version. This
 *      retroactively strips "| EWTN" brand suffixes, "Subscribe to
 *      our newsletter" lines, and other boilerplate that snuck into
 *      the catalog before the cleaner existed.
 *
 *   2. **Hard-deletes noise** — re-runs `validateItem` against the
 *      cleaned row. If validation classifies it as `"noise"` (landing
 *      page, navigation cruft, meta-description), the row is HARD-
 *      DELETED with no archive. The user explicitly asked for this:
 *      "if it is not relevant content like those random things from
 *      EWTN or weird web clips etc. completely delete it, no archive
 *      for review by the data management system, just gone."
 *
 *   3. **Diverts soft fails** — if validation classifies the row as
 *      `"soft"` (real content but the per-kind shape isn't quite
 *      right), the row is flipped to REVIEW so a human can decide.
 *
 *   4. **Leaves clean rows alone** — rows that pass validation
 *      unchanged stay PUBLISHED.
 *
 * Every action writes a `DataManagementLog` row so the admin can see
 * what the janitor changed in `/admin/logs/data-management`.
 */

export type JanitorBucket = {
  entity: string;
  inspected: number;
  repackaged: number;
  hardDeleted: number;
  divertedToReview: number;
};

export type JanitorSummary = {
  buckets: JanitorBucket[];
  totalRepackaged: number;
  totalHardDeleted: number;
  totalDivertedToReview: number;
};

/**
 * Reverse the persister mapping — take a DB row and rebuild the
 * IngestedItem shape so the cleaner / validator can operate on it.
 * The rebuilt item is keyed on the row's slug + externalSourceKey so
 * dedup keys stay aligned if the janitor later writes back.
 */
function prayerRowToItem(row: {
  slug: string;
  defaultTitle: string;
  body: string;
  category: string;
  externalSourceKey: string | null;
}): IngestedPrayer {
  return {
    kind: "prayer",
    slug: row.slug,
    defaultTitle: row.defaultTitle,
    body: row.body,
    category: row.category,
    externalSourceKey: row.externalSourceKey ?? undefined,
  };
}

function saintRowToItem(row: {
  slug: string;
  canonicalName: string;
  biography: string;
  patronages: string[];
  feastDay: string | null;
  feastMonth: number | null;
  feastDayOfMonth: number | null;
  officialPrayer: string | null;
  externalSourceKey: string | null;
}): IngestedSaint {
  return {
    kind: "saint",
    slug: row.slug,
    canonicalName: row.canonicalName,
    biography: row.biography,
    patronages: row.patronages ?? [],
    ...(row.feastDay ? { feastDay: row.feastDay } : {}),
    ...(row.feastMonth ? { feastMonth: row.feastMonth } : {}),
    ...(row.feastDayOfMonth ? { feastDayOfMonth: row.feastDayOfMonth } : {}),
    ...(row.officialPrayer ? { officialPrayer: row.officialPrayer } : {}),
    externalSourceKey: row.externalSourceKey ?? undefined,
  };
}

function apparitionRowToItem(row: {
  slug: string;
  title: string;
  summary: string;
  location: string | null;
  country: string | null;
  approvedStatus: string | null;
  officialPrayer: string | null;
  externalSourceKey: string | null;
}): IngestedApparition {
  return {
    kind: "apparition",
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    approvedStatus: row.approvedStatus ?? "Pending",
    ...(row.location ? { location: row.location } : {}),
    ...(row.country ? { country: row.country } : {}),
    ...(row.officialPrayer ? { officialPrayer: row.officialPrayer } : {}),
    externalSourceKey: row.externalSourceKey ?? undefined,
  };
}

function devotionRowToItem(row: {
  slug: string;
  title: string;
  summary: string;
  practiceText: string | null;
  durationMinutes: number | null;
  externalSourceKey: string | null;
}): IngestedDevotion {
  return {
    kind: "devotion",
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    ...(row.practiceText ? { practiceText: row.practiceText } : {}),
    ...(row.durationMinutes ? { durationMinutes: row.durationMinutes } : {}),
    externalSourceKey: row.externalSourceKey ?? undefined,
  };
}

function liturgyRowToItem(row: {
  slug: string;
  title: string;
  body: string;
  summary: string | null;
  kind: string;
  externalSourceKey: string | null;
}): IngestedLiturgy {
  return {
    kind: "liturgy",
    slug: row.slug,
    title: row.title,
    body: row.body,
    ...(row.summary ? { summary: row.summary } : {}),
    liturgyKind: row.kind as IngestedLiturgy["liturgyKind"],
    externalSourceKey: row.externalSourceKey ?? undefined,
  };
}

function guideRowToItem(row: {
  slug: string;
  title: string;
  summary: string;
  bodyText: string | null;
  kind: string;
  durationDays: number | null;
  externalSourceKey: string | null;
}): IngestedGuide {
  return {
    kind: "guide",
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    ...(row.bodyText ? { bodyText: row.bodyText } : {}),
    guideKind: row.kind as IngestedGuide["guideKind"],
    ...(row.durationDays ? { durationDays: row.durationDays } : {}),
    externalSourceKey: row.externalSourceKey ?? undefined,
  };
}

/**
 * Apply the format → clean pipeline to an existing item. Returns the
 * cleaned item plus a flag indicating whether anything changed.
 */
function repackage(item: IngestedItem): { cleaned: IngestedItem; changed: boolean } {
  const before = JSON.stringify(item);
  const cleaned = cleanIngestedItem(formatIngestedItem(item));
  const after = JSON.stringify(cleaned);
  return { cleaned, changed: before !== after };
}

/**
 * Classify what should happen to a row:
 *   - "keep"   — passes validation, no rewrite needed
 *   - "update" — passes validation but the cleaned text differs from
 *                what's stored; UPDATE the row
 *   - "delete" — fails as noise (landing page / nav cruft / meta-desc)
 *   - "review" — fails softly (real content, slightly off shape)
 */
type JanitorAction = "keep" | "update" | "delete" | "review";

function decideAction(
  cleaned: IngestedItem,
  changed: boolean,
): { action: JanitorAction; reason?: string } {
  const reason = validateItem(cleaned);
  if (!reason) {
    return { action: changed ? "update" : "keep" };
  }
  const severity = classifySeverity(reason);
  if (severity === "noise") return { action: "delete", reason };
  if (severity === "soft") return { action: "review", reason };
  // Hard fails on existing rows = structural problem (slug missing,
  // off-allowlist source). Treat as noise — these rows shouldn't be
  // on the public site either.
  return { action: "delete", reason };
}

/**
 * Belt-and-suspenders detector that fires on the row's title/body
 * before the validator runs. Catches the user's exact reported
 * cases — "Catholic Faith, Beliefs, & Prayers | Catholic Answers"
 * and "Catholic Prayers - Prayer to Jesus, Marian, & More | EWTN" —
 * even if some future schema change breaks one of the validators.
 */
function isObviousNoise(title: string, body: string): boolean {
  if (looksLikeLandingPage(title)) return true;
  if (looksLikeMetaDescription(body)) return true;
  if (looksLikeNonContent(title)) return true;
  if (looksLikeNonContent(body)) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Per-kind janitor walks                                             */
/* ------------------------------------------------------------------ */

async function janitorPrayers(): Promise<{
  bucket: JanitorBucket;
  logs: DataManagementLogInput[];
}> {
  const logs: DataManagementLogInput[] = [];
  const rows = await prisma.prayer.findMany({ where: { status: "PUBLISHED" } });
  let repackaged = 0;
  let hardDeleted = 0;
  let divertedToReview = 0;
  for (const row of rows) {
    if (isObviousNoise(row.defaultTitle, row.body)) {
      await prisma.prayer.delete({ where: { id: row.id } });
      hardDeleted += 1;
      logs.push({
        action: "DELETE",
        contentType: "Prayer",
        contentRef: row.slug,
        reason: "Janitor: hard-deleted as obvious noise (landing page / nav cruft / meta-desc)",
      });
      continue;
    }
    const item = prayerRowToItem(row);
    const { cleaned, changed } = repackage(item);
    const { action, reason } = decideAction(cleaned, changed);
    if (action === "delete") {
      await prisma.prayer.delete({ where: { id: row.id } });
      hardDeleted += 1;
      logs.push({
        action: "DELETE",
        contentType: "Prayer",
        contentRef: row.slug,
        reason: `Janitor: ${reason ?? "failed validation"}`,
      });
    } else if (action === "review") {
      await prisma.prayer.update({
        where: { id: row.id },
        data: {
          status: "REVIEW" as ContentStatus,
          ...(cleaned.kind === "prayer"
            ? {
                defaultTitle: cleaned.defaultTitle,
                body: cleaned.body,
                category: cleaned.category,
              }
            : {}),
        },
      });
      divertedToReview += 1;
      logs.push({
        action: "CATEGORY_FIX",
        contentType: "Prayer",
        contentRef: row.slug,
        reason: `Janitor: diverted to REVIEW (${reason ?? "soft fail"})`,
      });
    } else if (action === "update" && cleaned.kind === "prayer") {
      await prisma.prayer.update({
        where: { id: row.id },
        data: {
          defaultTitle: cleaned.defaultTitle,
          body: cleaned.body,
          category: cleaned.category,
        },
      });
      repackaged += 1;
      logs.push({
        action: "UPDATE",
        contentType: "Prayer",
        contentRef: row.slug,
        reason: "Janitor: repackaged (cleaned text/title)",
      });
    }
  }
  return {
    bucket: { entity: "Prayer", inspected: rows.length, repackaged, hardDeleted, divertedToReview },
    logs,
  };
}

async function janitorSaints(): Promise<{
  bucket: JanitorBucket;
  logs: DataManagementLogInput[];
}> {
  const logs: DataManagementLogInput[] = [];
  const rows = await prisma.saint.findMany({ where: { status: "PUBLISHED" } });
  let repackaged = 0;
  let hardDeleted = 0;
  let divertedToReview = 0;
  for (const row of rows) {
    if (isObviousNoise(row.canonicalName, row.biography)) {
      await prisma.saint.delete({ where: { id: row.id } });
      hardDeleted += 1;
      logs.push({
        action: "DELETE",
        contentType: "Saint",
        contentRef: row.slug,
        reason: "Janitor: hard-deleted as obvious noise",
      });
      continue;
    }
    const item = saintRowToItem(row);
    const { cleaned, changed } = repackage(item);
    const { action, reason } = decideAction(cleaned, changed);
    if (action === "delete") {
      await prisma.saint.delete({ where: { id: row.id } });
      hardDeleted += 1;
      logs.push({
        action: "DELETE",
        contentType: "Saint",
        contentRef: row.slug,
        reason: `Janitor: ${reason ?? "failed validation"}`,
      });
    } else if (action === "review") {
      await prisma.saint.update({
        where: { id: row.id },
        data: { status: "REVIEW" as ContentStatus },
      });
      divertedToReview += 1;
      logs.push({
        action: "CATEGORY_FIX",
        contentType: "Saint",
        contentRef: row.slug,
        reason: `Janitor: diverted to REVIEW (${reason ?? "soft fail"})`,
      });
    } else if (action === "update" && cleaned.kind === "saint") {
      await prisma.saint.update({
        where: { id: row.id },
        data: {
          canonicalName: cleaned.canonicalName,
          biography: cleaned.biography,
        },
      });
      repackaged += 1;
      logs.push({
        action: "UPDATE",
        contentType: "Saint",
        contentRef: row.slug,
        reason: "Janitor: repackaged (cleaned text/name)",
      });
    }
  }
  return {
    bucket: { entity: "Saint", inspected: rows.length, repackaged, hardDeleted, divertedToReview },
    logs,
  };
}

async function janitorApparitions(): Promise<{
  bucket: JanitorBucket;
  logs: DataManagementLogInput[];
}> {
  const logs: DataManagementLogInput[] = [];
  const rows = await prisma.marianApparition.findMany({ where: { status: "PUBLISHED" } });
  let repackaged = 0;
  let hardDeleted = 0;
  let divertedToReview = 0;
  for (const row of rows) {
    if (isObviousNoise(row.title, row.summary)) {
      await prisma.marianApparition.delete({ where: { id: row.id } });
      hardDeleted += 1;
      logs.push({
        action: "DELETE",
        contentType: "MarianApparition",
        contentRef: row.slug,
        reason: "Janitor: hard-deleted as obvious noise",
      });
      continue;
    }
    const item = apparitionRowToItem(row);
    const { cleaned, changed } = repackage(item);
    const { action, reason } = decideAction(cleaned, changed);
    if (action === "delete") {
      await prisma.marianApparition.delete({ where: { id: row.id } });
      hardDeleted += 1;
      logs.push({
        action: "DELETE",
        contentType: "MarianApparition",
        contentRef: row.slug,
        reason: `Janitor: ${reason ?? "failed validation"}`,
      });
    } else if (action === "review") {
      await prisma.marianApparition.update({
        where: { id: row.id },
        data: { status: "REVIEW" as ContentStatus },
      });
      divertedToReview += 1;
      logs.push({
        action: "CATEGORY_FIX",
        contentType: "MarianApparition",
        contentRef: row.slug,
        reason: `Janitor: diverted to REVIEW (${reason ?? "soft fail"})`,
      });
    } else if (action === "update" && cleaned.kind === "apparition") {
      await prisma.marianApparition.update({
        where: { id: row.id },
        data: {
          title: cleaned.title,
          summary: cleaned.summary,
        },
      });
      repackaged += 1;
      logs.push({
        action: "UPDATE",
        contentType: "MarianApparition",
        contentRef: row.slug,
        reason: "Janitor: repackaged (cleaned text/title)",
      });
    }
  }
  return {
    bucket: {
      entity: "MarianApparition",
      inspected: rows.length,
      repackaged,
      hardDeleted,
      divertedToReview,
    },
    logs,
  };
}

async function janitorDevotions(): Promise<{
  bucket: JanitorBucket;
  logs: DataManagementLogInput[];
}> {
  const logs: DataManagementLogInput[] = [];
  const rows = await prisma.devotion.findMany({ where: { status: "PUBLISHED" } });
  let repackaged = 0;
  let hardDeleted = 0;
  let divertedToReview = 0;
  for (const row of rows) {
    if (isObviousNoise(row.title, row.summary)) {
      await prisma.devotion.delete({ where: { id: row.id } });
      hardDeleted += 1;
      logs.push({
        action: "DELETE",
        contentType: "Devotion",
        contentRef: row.slug,
        reason: "Janitor: hard-deleted as obvious noise",
      });
      continue;
    }
    const item = devotionRowToItem(row);
    const { cleaned, changed } = repackage(item);
    const { action, reason } = decideAction(cleaned, changed);
    if (action === "delete") {
      await prisma.devotion.delete({ where: { id: row.id } });
      hardDeleted += 1;
      logs.push({
        action: "DELETE",
        contentType: "Devotion",
        contentRef: row.slug,
        reason: `Janitor: ${reason ?? "failed validation"}`,
      });
    } else if (action === "review") {
      await prisma.devotion.update({
        where: { id: row.id },
        data: { status: "REVIEW" as ContentStatus },
      });
      divertedToReview += 1;
      logs.push({
        action: "CATEGORY_FIX",
        contentType: "Devotion",
        contentRef: row.slug,
        reason: `Janitor: diverted to REVIEW (${reason ?? "soft fail"})`,
      });
    } else if (action === "update" && cleaned.kind === "devotion") {
      await prisma.devotion.update({
        where: { id: row.id },
        data: {
          title: cleaned.title,
          summary: cleaned.summary,
        },
      });
      repackaged += 1;
      logs.push({
        action: "UPDATE",
        contentType: "Devotion",
        contentRef: row.slug,
        reason: "Janitor: repackaged (cleaned text/title)",
      });
    }
  }
  return {
    bucket: {
      entity: "Devotion",
      inspected: rows.length,
      repackaged,
      hardDeleted,
      divertedToReview,
    },
    logs,
  };
}

async function janitorLiturgy(): Promise<{
  bucket: JanitorBucket;
  logs: DataManagementLogInput[];
}> {
  const logs: DataManagementLogInput[] = [];
  const rows = await prisma.liturgyEntry.findMany({ where: { status: "PUBLISHED" } });
  let repackaged = 0;
  let hardDeleted = 0;
  let divertedToReview = 0;
  for (const row of rows) {
    if (isObviousNoise(row.title, row.body)) {
      await prisma.liturgyEntry.delete({ where: { id: row.id } });
      hardDeleted += 1;
      logs.push({
        action: "DELETE",
        contentType: "LiturgyEntry",
        contentRef: row.slug,
        reason: "Janitor: hard-deleted as obvious noise",
      });
      continue;
    }
    const item = liturgyRowToItem(row);
    const { cleaned, changed } = repackage(item);
    const { action, reason } = decideAction(cleaned, changed);
    if (action === "delete") {
      await prisma.liturgyEntry.delete({ where: { id: row.id } });
      hardDeleted += 1;
      logs.push({
        action: "DELETE",
        contentType: "LiturgyEntry",
        contentRef: row.slug,
        reason: `Janitor: ${reason ?? "failed validation"}`,
      });
    } else if (action === "review") {
      await prisma.liturgyEntry.update({
        where: { id: row.id },
        data: { status: "REVIEW" as ContentStatus },
      });
      divertedToReview += 1;
      logs.push({
        action: "CATEGORY_FIX",
        contentType: "LiturgyEntry",
        contentRef: row.slug,
        reason: `Janitor: diverted to REVIEW (${reason ?? "soft fail"})`,
      });
    } else if (action === "update" && cleaned.kind === "liturgy") {
      await prisma.liturgyEntry.update({
        where: { id: row.id },
        data: {
          title: cleaned.title,
          body: cleaned.body,
        },
      });
      repackaged += 1;
      logs.push({
        action: "UPDATE",
        contentType: "LiturgyEntry",
        contentRef: row.slug,
        reason: "Janitor: repackaged (cleaned text/title)",
      });
    }
  }
  return {
    bucket: {
      entity: "LiturgyEntry",
      inspected: rows.length,
      repackaged,
      hardDeleted,
      divertedToReview,
    },
    logs,
  };
}

async function janitorGuides(): Promise<{
  bucket: JanitorBucket;
  logs: DataManagementLogInput[];
}> {
  const logs: DataManagementLogInput[] = [];
  const rows = await prisma.spiritualLifeGuide.findMany({ where: { status: "PUBLISHED" } });
  let repackaged = 0;
  let hardDeleted = 0;
  let divertedToReview = 0;
  for (const row of rows) {
    if (isObviousNoise(row.title, row.summary)) {
      await prisma.spiritualLifeGuide.delete({ where: { id: row.id } });
      hardDeleted += 1;
      logs.push({
        action: "DELETE",
        contentType: "SpiritualLifeGuide",
        contentRef: row.slug,
        reason: "Janitor: hard-deleted as obvious noise",
      });
      continue;
    }
    const item = guideRowToItem(row);
    const { cleaned, changed } = repackage(item);
    const { action, reason } = decideAction(cleaned, changed);
    if (action === "delete") {
      await prisma.spiritualLifeGuide.delete({ where: { id: row.id } });
      hardDeleted += 1;
      logs.push({
        action: "DELETE",
        contentType: "SpiritualLifeGuide",
        contentRef: row.slug,
        reason: `Janitor: ${reason ?? "failed validation"}`,
      });
    } else if (action === "review") {
      await prisma.spiritualLifeGuide.update({
        where: { id: row.id },
        data: { status: "REVIEW" as ContentStatus },
      });
      divertedToReview += 1;
      logs.push({
        action: "CATEGORY_FIX",
        contentType: "SpiritualLifeGuide",
        contentRef: row.slug,
        reason: `Janitor: diverted to REVIEW (${reason ?? "soft fail"})`,
      });
    } else if (action === "update" && cleaned.kind === "guide") {
      await prisma.spiritualLifeGuide.update({
        where: { id: row.id },
        data: {
          title: cleaned.title,
          summary: cleaned.summary,
        },
      });
      repackaged += 1;
      logs.push({
        action: "UPDATE",
        contentType: "SpiritualLifeGuide",
        contentRef: row.slug,
        reason: "Janitor: repackaged (cleaned text/title)",
      });
    }
  }
  return {
    bucket: {
      entity: "SpiritualLifeGuide",
      inspected: rows.length,
      repackaged,
      hardDeleted,
      divertedToReview,
    },
    logs,
  };
}

/**
 * Run the full janitor pass across every catalog content table.
 * Safe to invoke on every cron tick — operations are
 * idempotent (a clean row stays clean) and bounded by the number of
 * PUBLISHED rows (which is what `getBacklogProgress()` already counts).
 */
export async function runCatalogJanitor(): Promise<JanitorSummary> {
  const buckets: JanitorBucket[] = [];
  const allLogs: DataManagementLogInput[] = [];

  for (const job of [
    janitorPrayers,
    janitorSaints,
    janitorApparitions,
    janitorDevotions,
    janitorLiturgy,
    janitorGuides,
  ]) {
    try {
      const { bucket, logs } = await job();
      buckets.push(bucket);
      allLogs.push(...logs);
    } catch {
      // Best-effort — one failing kind shouldn't break the others.
    }
  }

  if (allLogs.length > 0) {
    await recordDataManagementLogs(allLogs).catch(() => {
      // Logging is fire-and-forget; never throw out of the janitor.
    });
  }

  return {
    buckets,
    totalRepackaged: buckets.reduce((s, b) => s + b.repackaged, 0),
    totalHardDeleted: buckets.reduce((s, b) => s + b.hardDeleted, 0),
    totalDivertedToReview: buckets.reduce((s, b) => s + b.divertedToReview, 0),
  };
}
