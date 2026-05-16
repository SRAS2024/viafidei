import type { ContentStatus } from "@prisma/client";
import { prisma } from "../db/client";
import { looksLikeNonContent } from "../ingestion/validate";
import { recordDataManagementLogs, type DataManagementLogInput } from "./data-management-log";

const DEFAULT_INGESTION_RUN_RETENTION_DAYS = 60;
const DEFAULT_AUDIT_RETENTION_DAYS = 365;

export async function pruneOldIngestionRuns(
  olderThanDays = DEFAULT_INGESTION_RUN_RETENTION_DAYS,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.ingestionJobRun.deleteMany({
    where: { startedAt: { lt: cutoff } },
  });
  return result.count;
}

export async function pruneOldAuditLogs(
  olderThanDays = DEFAULT_AUDIT_RETENTION_DAYS,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.adminAuditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}

/**
 * Per-entity statistics returned by `cleanupMiscategorisedContent`.
 *
 *   • `archived` — rows whose body/title looked like a source summary,
 *     TV listing, or newsletter blurb. We do not delete (so an admin
 *     can review them) but we flip them to ARCHIVED so the public site
 *     does not show them.
 *   • `inspected` — total rows in this entity bucket that the
 *     cleanup pass considered.
 */
export type CleanupBucket = {
  entity: string;
  inspected: number;
  archived: number;
};

const PRAYER_LANGUAGE_RE =
  /\b(amen|hail|holy|lord|jesus|christ|mary|father|son|spirit|pray|grant|deliver|glory|kyrie|sanctus|gloria|adoramus|magnificat|nunc\s+dimittis)\b/i;
const SAINT_BIOGRAPHY_RE =
  /\b(saint|st\.|blessed|martyr|virgin|priest|monk|nun|abbot|bishop|pope|doctor|venerable|born|died|canon(ized|ised)|beatif|patron|feast)\b/i;

export type CleanupSummary = {
  buckets: CleanupBucket[];
  totalArchived: number;
};

async function archivePrayer(id: string) {
  await prisma.prayer.update({
    where: { id },
    data: { status: "ARCHIVED" as ContentStatus },
  });
}
async function archiveSaint(id: string) {
  await prisma.saint.update({
    where: { id },
    data: { status: "ARCHIVED" as ContentStatus },
  });
}
async function archiveApparition(id: string) {
  await prisma.marianApparition.update({
    where: { id },
    data: { status: "ARCHIVED" as ContentStatus },
  });
}
async function archiveDevotion(id: string) {
  await prisma.devotion.update({
    where: { id },
    data: { status: "ARCHIVED" as ContentStatus },
  });
}
async function archiveLiturgy(id: string) {
  await prisma.liturgyEntry.update({
    where: { id },
    data: { status: "ARCHIVED" as ContentStatus },
  });
}
async function archiveGuide(id: string) {
  await prisma.spiritualLifeGuide.update({
    where: { id },
    data: { status: "ARCHIVED" as ContentStatus },
  });
}

/**
 * Inspect every PUBLISHED row in the content tables and ARCHIVE any
 * item that:
 *
 *   • Carries source-summary, broadcast-schedule, or newsletter copy
 *     in its title or body (e.g. "EWTN is the global Catholic Network",
 *     "Catholic Australia, a work of the Australian Catholic Bishops
 *     Conference.").
 *   • Has a body too short to be a real entry of that kind.
 *   • Has a body that lacks the lexical markers of that content type
 *     (a prayer with no prayer-language words, a saint with no biographical
 *     vocabulary, etc.).
 *   • For Marian apparitions, lacks any Marian vocabulary in its summary.
 *
 * The cleanup is idempotent and safe to run on a schedule — it never
 * deletes user-generated content and never touches DRAFT / REVIEW rows
 * that the admin is still working on.
 */
export async function cleanupMiscategorisedContent(): Promise<CleanupSummary> {
  const buckets: CleanupBucket[] = [];
  const logs: DataManagementLogInput[] = [];

  function reasonFor(opts: {
    tooShort?: boolean;
    looksLikeBlurb?: boolean;
    noPrayerLang?: boolean;
    noBiog?: boolean;
    noMarian?: boolean;
    noDev?: boolean;
    looksLikeIndex?: boolean;
  }): string {
    const parts: string[] = [];
    if (opts.tooShort) parts.push("body too short");
    if (opts.looksLikeBlurb)
      parts.push("matches non-content phrase (source summary / broadcast / newsletter)");
    if (opts.noPrayerLang) parts.push("no prayer-language markers");
    if (opts.noBiog) parts.push("no biographical vocabulary");
    if (opts.noMarian) parts.push("no Marian / apparition vocabulary");
    if (opts.noDev) parts.push("no devotional-practice vocabulary");
    if (opts.looksLikeIndex) parts.push("title looks like a navigation index");
    return parts.join("; ") || "miscategorised";
  }

  // PRAYERS — must have prayer-language vocabulary and a body ≥ 40 chars.
  {
    const items = await prisma.prayer.findMany({ where: { status: "PUBLISHED" } });
    let archived = 0;
    for (const p of items) {
      const blob = `${p.defaultTitle} ${p.body}`;
      const tooShort = (p.body ?? "").trim().length < 40;
      const noPrayerLang = !PRAYER_LANGUAGE_RE.test(p.body ?? "");
      const looksLikeBlurb = looksLikeNonContent(blob);
      if (tooShort || noPrayerLang || looksLikeBlurb) {
        await archivePrayer(p.id);
        archived += 1;
        logs.push({
          action: "CLEANUP",
          contentType: "Prayer",
          contentRef: p.slug ?? p.defaultTitle,
          reason: reasonFor({ tooShort, looksLikeBlurb, noPrayerLang }),
        });
      }
    }
    buckets.push({ entity: "Prayer", inspected: items.length, archived });
  }

  // SAINTS — must have biographical vocabulary and a biography ≥ 80 chars.
  {
    const items = await prisma.saint.findMany({ where: { status: "PUBLISHED" } });
    let archived = 0;
    for (const s of items) {
      const blob = `${s.canonicalName} ${s.biography}`;
      const tooShort = (s.biography ?? "").trim().length < 80;
      const noBiog = !SAINT_BIOGRAPHY_RE.test(s.biography ?? "");
      const looksLikeBlurb = looksLikeNonContent(blob);
      const looksLikeIndex =
        /^(catholic\s+saints?|patron\s+saints?|saints?\s+(directory|list|index))/i.test(
          s.canonicalName,
        );
      if (tooShort || noBiog || looksLikeBlurb || looksLikeIndex) {
        await archiveSaint(s.id);
        archived += 1;
        logs.push({
          action: "CLEANUP",
          contentType: "Saint",
          contentRef: s.slug ?? s.canonicalName,
          reason: reasonFor({ tooShort, looksLikeBlurb, noBiog, looksLikeIndex }),
        });
      }
    }
    buckets.push({ entity: "Saint", inspected: items.length, archived });
  }

  // APPARITIONS — must mention Marian apparition language and a summary ≥ 60 chars.
  {
    const items = await prisma.marianApparition.findMany({ where: { status: "PUBLISHED" } });
    let archived = 0;
    for (const a of items) {
      const blob = `${a.title} ${a.summary}`;
      const tooShort = (a.summary ?? "").trim().length < 60;
      const noMarian =
        !/\b(mary|our\s+lady|blessed\s+virgin|virgin|madonna|theotokos|nuestra\s+señora|notre\s+dame|appear(ed|ance)|apparition|vision)\b/i.test(
          a.summary ?? "",
        );
      const looksLikeBlurb = looksLikeNonContent(blob);
      if (tooShort || noMarian || looksLikeBlurb) {
        await archiveApparition(a.id);
        archived += 1;
        logs.push({
          action: "CLEANUP",
          contentType: "MarianApparition",
          contentRef: a.slug ?? a.title,
          reason: reasonFor({ tooShort, looksLikeBlurb, noMarian }),
        });
      }
    }
    buckets.push({ entity: "MarianApparition", inspected: items.length, archived });
  }

  // DEVOTIONS — must mention a devotional practice and a summary ≥ 40 chars.
  {
    const items = await prisma.devotion.findMany({ where: { status: "PUBLISHED" } });
    let archived = 0;
    for (const d of items) {
      const blob = `${d.title} ${d.summary}`;
      const tooShort = (d.summary ?? "").trim().length < 40;
      const noDev =
        !/\b(devotion|rosary|novena|chaplet|consecration|adoration|holy\s+hour|station(s)?\s+of\s+the\s+cross|first\s+(friday|saturday)|scapular|miraculous\s+medal|prayer|meditation|pray)\b/i.test(
          `${d.title} ${d.summary}`,
        );
      const looksLikeBlurb = looksLikeNonContent(blob);
      if (tooShort || noDev || looksLikeBlurb) {
        await archiveDevotion(d.id);
        archived += 1;
        logs.push({
          action: "CLEANUP",
          contentType: "Devotion",
          contentRef: d.slug ?? d.title,
          reason: reasonFor({ tooShort, looksLikeBlurb, noDev }),
        });
      }
    }
    buckets.push({ entity: "Devotion", inspected: items.length, archived });
  }

  // LITURGY entries — must have a body ≥ 80 chars and not read as
  // newsletter / TV-listing copy.
  {
    const items = await prisma.liturgyEntry.findMany({ where: { status: "PUBLISHED" } });
    let archived = 0;
    for (const l of items) {
      const blob = `${l.title} ${l.body}`;
      const tooShort = (l.body ?? "").trim().length < 80;
      const looksLikeBlurb = looksLikeNonContent(blob);
      if (tooShort || looksLikeBlurb) {
        await archiveLiturgy(l.id);
        archived += 1;
        logs.push({
          action: "CLEANUP",
          contentType: "LiturgyEntry",
          contentRef: l.slug ?? l.title,
          reason: reasonFor({ tooShort, looksLikeBlurb }),
        });
      }
    }
    buckets.push({ entity: "LiturgyEntry", inspected: items.length, archived });
  }

  // SPIRITUAL-LIFE GUIDES — must have a summary ≥ 40 chars and not
  // read like a source listing.
  {
    const items = await prisma.spiritualLifeGuide.findMany({ where: { status: "PUBLISHED" } });
    let archived = 0;
    for (const g of items) {
      const blob = `${g.title} ${g.summary}`;
      const tooShort = (g.summary ?? "").trim().length < 40;
      const looksLikeBlurb = looksLikeNonContent(blob);
      if (tooShort || looksLikeBlurb) {
        await archiveGuide(g.id);
        archived += 1;
        logs.push({
          action: "CLEANUP",
          contentType: "SpiritualLifeGuide",
          contentRef: g.slug ?? g.title,
          reason: reasonFor({ tooShort, looksLikeBlurb }),
        });
      }
    }
    buckets.push({ entity: "SpiritualLifeGuide", inspected: items.length, archived });
  }

  await recordDataManagementLogs(logs);

  const totalArchived = buckets.reduce((sum, b) => sum + b.archived, 0);
  return { buckets, totalArchived };
}

/**
 * Remove exact-duplicate PUBLISHED rows that share the same body text but
 * landed in the catalog under different slugs (a common artefact of older
 * ingestion runs from before content checksums were enforced). We keep
 * the earliest row and archive the later ones.
 */
export async function archiveDuplicatePrayers(): Promise<number> {
  const groups = await prisma.prayer.groupBy({
    by: ["contentChecksum"],
    where: { status: "PUBLISHED", contentChecksum: { not: null } },
    _count: { _all: true },
    having: { contentChecksum: { _count: { gt: 1 } } },
  });
  let archived = 0;
  const logs: DataManagementLogInput[] = [];
  for (const g of groups) {
    if (!g.contentChecksum) continue;
    const dupes = await prisma.prayer.findMany({
      where: { status: "PUBLISHED", contentChecksum: g.contentChecksum },
      orderBy: { createdAt: "asc" },
    });
    // Keep the first row, archive the rest.
    for (let i = 1; i < dupes.length; i++) {
      await prisma.prayer.update({
        where: { id: dupes[i].id },
        data: { status: "ARCHIVED" as ContentStatus },
      });
      archived += 1;
      logs.push({
        action: "DEDUPE",
        contentType: "Prayer",
        contentRef: dupes[i].slug ?? dupes[i].defaultTitle,
        reason: `duplicate of ${dupes[0].slug ?? dupes[0].defaultTitle}`,
      });
    }
  }
  await recordDataManagementLogs(logs);
  return archived;
}
