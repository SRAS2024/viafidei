/**
 * One-off cleanup of the PUBLISHED saint catalogue — the problems the
 * 2026-10-31 audit found that the repair lane cannot reach on its own:
 *
 *   1. ORTHODOX-ONLY figures live as Catholic saints. Severus of Antioch
 *      (Q729105) and Empress Theodora (Q204843) carry only the generic "saint"
 *      item and a non-Catholic religion Wikidata does not list as such, so the
 *      repair lane's proof rule never fires; their own articles say Oriental /
 *      Eastern Orthodox. They are UNPUBLISHED (never deleted), together with
 *      any row the repair lane's own rule already condemns (Wikidata PROVES
 *      the veneration is not Catholic). Rows with no Catholic status or
 *      religion on Wikidata whose article names only another communion are
 *      LISTED as suspects, and unpublished only on explicit request
 *      (`unpublishArticleSuspects`): the audit did not examine them one by one.
 *   2. "VENERABLE" rows that came from the Orthodox monastic honorific
 *      (Q12774503, "the Venerable"): 46 of them, several canonized (Joseph
 *      Marello, Giovanni Battista de' Rossi). Each is RE-STATUSED from its
 *      Catholic P411 status, else from the article infobox by the ingest's own
 *      rule (`statusFromInfobox`, and the article must name the Catholic
 *      Church when Wikidata gives no Catholic religion). One with no Catholic
 *      stage anywhere is unpublished only on POSITIVE evidence that another
 *      communion venerates the person (its Wikidata religion, or the article's
 *      venerating bodies — Gregorio Aglipay); a silent record (Íñigo of Oña's
 *      article has no infobox) is listed for review instead. These rows are
 *      the re-status step's alone: step 1 never unpublishes them on the
 *      strength of the honorific, which would take Marello down with the
 *      Orthodox monks.
 *   3. Venerables and Servants of God shown with a FEAST they cannot
 *      liturgically have: the feast fields are removed — once the stage is
 *      CONFIRMED. Wikidata's P411 lags the causes (Richard Henkes, beatified in
 *      2019, is still "Venerable" there; Nikola Tavelić, canonized in 1970,
 *      resolves to it), so a row whose Wikidata record or article puts the
 *      cause past Venerable keeps its feast and is listed for review instead.
 *   4. A LIST (no writes) of published saints whose feast contradicts the
 *      first feast date of their article's infobox.
 *
 * Skip on doubt throughout: an article that could not be read (timeout, 429,
 * 5xx — see `SourceReadLedger`) never leads to a change; the row is reported
 * and left for a rerun.
 *
 * Dry run by default: everything is read and decided, nothing is written. With
 * `apply`, every change goes through the existing paths with a recorded
 * reason: `unpublishStructuredSaint` (flag + WARN log + review row) or
 * `applyProtectedContentUpdate` (versioned, reversible) followed by its own
 * AdminWorkerLog row. Each row is re-read just before it is written and the
 * change is made on that fresh row; one the worker changed since the decision
 * (re-statused, edited, unpublished) is reported and left for a rerun. Nothing
 * is ever deleted.
 *
 * Network: one Query-Service request per 100 saints through the shared SPARQL
 * gate, and one Wikipedia Action API parse per article it has to read,
 * strictly serial (see http.ts).
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { FEASTLESS_CANONIZATION_STATUSES } from "@/lib/checklist/schemas/saint";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";

import { applyProtectedContentUpdate } from "../content-protection";
import { writeAdminWorkerLog } from "../logs";
import { feastMentionIndexLocalized } from "./corroboration";
import type { SourceReadLedger } from "./http";
import {
  articleDatedStage,
  articleStageConflict,
  infoboxFeastValue,
  infoboxFirstFeast,
  statusFromInfobox,
  veneratedIn,
  venerationBodies,
} from "./ingestors";
import {
  deriveSaintType,
  hasCatholicReligion,
  hasCatholicStatus,
  hasNonCatholicReligion,
  isProvenNonCatholic,
  parseSaintFacts,
  resolveCanonizationStatus,
  saintDisplayTitle,
  saintFactsSparqlForQids,
  type CanonizationStatus,
  type SaintFacts,
} from "./saint-facts";
import { publishedSaintQid, unpublishStructuredSaint } from "./saint-repair";
import { runSparql } from "./wikidata";
import { fetchArticleInfobox } from "./wikipedia-infobox";
import { parseWikipediaArticleUrl } from "./wikipedia-url";

/** The Orthodox monastic honorific "the Venerable" — not the Catholic stage. */
export const ORTHODOX_HONORIFIC_QID = "Q12774503";

/**
 * Figures the 2026-10-31 audit confirmed are venerated only outside the
 * Catholic Church, whose Wikidata record cannot prove it (generic "saint" +
 * a religion item no rule lists). Their own published biographies say so.
 */
export const CONFIRMED_NON_CATHOLIC: ReadonlyMap<string, string> = new Map([
  [
    "Q729105",
    "Severus of Antioch was the Miaphysite Patriarch of Antioch, deposed in 518 and venerated by the Oriental Orthodox churches; the Catholic Church does not venerate him as a saint.",
  ],
  [
    "Q204843",
    "Empress Theodora, wife of Justinian I, is venerated as a saint by the Eastern Orthodox and Oriental Orthodox churches; she is not in the Catholic calendar or the Roman Martyrology.",
  ],
]);

const FACTS_BATCH = 100;
const FEAST_FIELDS = ["feastDay", "feastMonth", "feastDayOfMonth"] as const;

export type CleanupCategory = "orthodox" | "restatus" | "feastless" | "feast-audit";
export const CLEANUP_CATEGORIES: readonly CleanupCategory[] = [
  "orthodox",
  "restatus",
  "feastless",
  "feast-audit",
];

export interface SaintCleanupOptions {
  /** Write the changes. Without it nothing is written anywhere. */
  apply?: boolean;
  /** Which parts to run (default all). */
  categories?: ReadonlySet<CleanupCategory>;
  /**
   * Also unpublish the SUSPECTS: rows with no Catholic status or religion on
   * Wikidata whose article names only another communion. Off by default — they
   * are listed in `suspects` for a human to look at first.
   */
  unpublishArticleSuspects?: boolean;
  /** At most this many articles read for the feast audit (one parse call each). */
  auditLimit?: number;
  passId?: string;
  /** Progress lines (the CLI prints them). */
  log?: (line: string) => void;
}

export interface CleanupAction {
  kind: "unpublish" | "update";
  category: Exclude<CleanupCategory, "feast-audit">;
  contentId: string;
  slug: string;
  title: string;
  qid: string | null;
  reason: string;
  /** What an update changes, field by field ([from, to]; a removed feast → to null). */
  changes: Record<string, [unknown, unknown]>;
  /** null in a dry run; true / false once applied. */
  applied: boolean | null;
  error?: string;
}

export interface FeastContradiction {
  contentId: string;
  slug: string;
  title: string;
  qid: string | null;
  publishedFeast: string;
  infoboxFeast: string;
  infoboxValue: string;
  article: string;
  /** "historical": the published day is named LATER in the infobox (an older calendar). */
  kind: "contradicted" | "historical";
}

/** A row whose article alone says another communion venerates the person. */
export interface VenerationSuspect {
  contentId: string;
  slug: string;
  title: string;
  qid: string | null;
  venerated: string;
  article: string;
  /** True when this run unpublished it (`unpublishArticleSuspects`). */
  actioned: boolean;
}

/**
 * A row whose stage the sources do not agree on, left exactly as it is: a
 * published Venerable / Servant of God that Wikidata or the article puts
 * further along (its feast is kept), or an Orthodox-honorific row whose
 * Catholic P411 stage its article contradicts.
 */
export interface StageReview {
  contentId: string;
  slug: string;
  title: string;
  qid: string | null;
  published: string;
  /** The Catholic stage Wikidata proves (null: none). */
  wikidata: CanonizationStatus | null;
  /** The stage the article's infobox dates or names (null: none / no article). */
  article: CanonizationStatus | null;
  articleUrl: string | null;
}

export interface SaintCleanupReport {
  dryRun: boolean;
  examined: number;
  structured: number;
  factsResolved: number;
  articlesRead: number;
  actions: CleanupAction[];
  suspects: VenerationSuspect[];
  stageReview: StageReview[];
  feastContradictions: FeastContradiction[];
  errors: string[];
}

interface Target {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  payload: Record<string, unknown>;
  qid: string | null;
}

/** The first Wikipedia article a payload cites, with its language. */
function citedArticle(payload: Record<string, unknown>): { url: string; lang: string } | null {
  const citations = Array.isArray(payload.citations) ? payload.citations : [];
  for (const c of citations) {
    if (typeof c !== "string") continue;
    const parsed = parseWikipediaArticleUrl(c);
    if (parsed) return { url: c, lang: parsed.lang };
  }
  return null;
}

function hasFeast(payload: Record<string, unknown>): boolean {
  return FEAST_FIELDS.some((f) => payload[f] !== undefined && payload[f] !== null);
}

async function loadFacts(
  qids: string[],
  errors: string[],
  log: (line: string) => void,
): Promise<Map<string, SaintFacts>> {
  const out = new Map<string, SaintFacts>();
  for (let i = 0; i < qids.length; i += FACTS_BATCH) {
    const chunk = qids.slice(i, i + FACTS_BATCH);
    let rows: Awaited<ReturnType<typeof runSparql>> = null;
    try {
      rows = await runSparql(saintFactsSparqlForQids(chunk));
    } catch {
      rows = null;
    }
    if (rows === null) {
      errors.push(`Wikidata facts unavailable for ${chunk.length} saint(s) from ${chunk[0]}`);
      continue;
    }
    for (const row of rows) {
      const facts = parseSaintFacts(row);
      if (facts) out.set(facts.qid, facts);
    }
    log(`facts ${Math.min(i + FACTS_BATCH, qids.length)}/${qids.length}`);
  }
  return out;
}

/** A published row as it stands at write time. */
interface CurrentRow {
  id: string;
  slug: string;
  title: string;
  payload: Record<string, unknown>;
  isPublished: boolean;
}

/** Re-read one row just before writing it (null when it cannot be read). */
async function readCurrentRow(prisma: PrismaClient, id: string): Promise<CurrentRow | null> {
  try {
    const row = await prisma.publishedContent.findUnique({
      where: { id },
      select: { id: true, slug: true, title: true, payload: true, isPublished: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      isPublished: row.isPublished,
    };
  } catch {
    return null;
  }
}

/**
 * Why a planned action no longer holds for the row as it stands now, or null
 * when it does: the row must still be published, still at the stage the
 * decision was made on, and every field the action changes must still hold
 * the value it is changed FROM.
 */
function driftSince(action: CleanupAction, planned: Target, now: CurrentRow): string | null {
  if (!now.isPublished) return "no longer published";
  const stage = now.payload.canonizationStatus;
  if (stage !== planned.payload.canonizationStatus) {
    return `its stage is now "${String(stage ?? "none")}"`;
  }
  for (const [field, [from]] of Object.entries(action.changes)) {
    if (field === "isPublished") continue;
    const value = field === "title" ? now.title : now.payload[field];
    if (JSON.stringify(value ?? null) !== JSON.stringify(from ?? null)) {
      return `${field} changed since the dry run`;
    }
  }
  return null;
}

/** What one article read gave: its infobox, and whether the read completed. */
interface ArticleRead {
  infobox: Record<string, string>;
  /** False when the read did not complete (timeout, 429, 5xx): it proves nothing. */
  read: boolean;
}

/**
 * Decide (and, with `apply`, make) the cleanup. Never throws on a single row;
 * every failure lands in `errors` or on its action.
 */
export async function runSaintCleanup(
  prisma: PrismaClient,
  opts: SaintCleanupOptions = {},
): Promise<SaintCleanupReport> {
  const apply = opts.apply === true;
  const want = (c: CleanupCategory) => !opts.categories || opts.categories.has(c);
  const log = opts.log ?? (() => undefined);
  const report: SaintCleanupReport = {
    dryRun: !apply,
    examined: 0,
    structured: 0,
    factsResolved: 0,
    articlesRead: 0,
    actions: [],
    suspects: [],
    stageReview: [],
    feastContradictions: [],
    errors: [],
  };

  const rows = await prisma.publishedContent.findMany({
    where: { contentType: "SAINT", isPublished: true },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, title: true, subtitle: true, payload: true, sourceRef: true },
  });
  const targets: Target[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle ?? null,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    qid: publishedSaintQid(r),
  }));
  report.examined = targets.length;
  const structured = targets.filter((t) => t.qid);
  report.structured = structured.length;
  log(`${targets.length} published saints, ${structured.length} from Wikidata`);

  // The feast rule needs the facts too: it must not strip the feast of a row
  // whose "venerable" is the Orthodox honorific and is still to be re-statused,
  // nor of one Wikidata already records as beatified or canonized.
  const needFacts = want("orthodox") || want("restatus") || want("feastless");
  const facts = needFacts
    ? await loadFacts([...new Set(structured.map((t) => t.qid as string))], report.errors, log)
    : new Map<string, SaintFacts>();
  report.factsResolved = facts.size;

  const articles = new Map<string, ArticleRead>();
  const readArticle = async (url: string): Promise<ArticleRead> => {
    const cached = articles.get(url);
    if (cached) return cached;
    const reads: SourceReadLedger = { unread: [] };
    let infobox: Record<string, string> = {};
    let threw = false;
    try {
      infobox = await fetchArticleInfobox(url, { ledger: reads });
    } catch {
      threw = true;
    }
    report.articlesRead += 1;
    const result: ArticleRead = { infobox, read: !threw && reads.unread.length === 0 };
    articles.set(url, result);
    return result;
  };
  const unreadable = (t: Target, url: string) =>
    report.errors.push(`${t.slug}: ${url} could not be read; left unchanged for a rerun`);

  const unpublished = new Set<string>();
  /** The status each row will have after this run (re-statused rows change). */
  const statusAfter = new Map<string, CanonizationStatus>();
  /** Pending payload changes per row, merged into ONE protected update each. */
  const pending = new Map<string, { target: Target; action: CleanupAction }>();
  /** Rows listed for review; nothing else touches them in this run. */
  const reviewed = new Set<string>();

  const plan = (action: Omit<CleanupAction, "applied">) => {
    report.actions.push({ ...action, applied: null });
  };
  const review = (
    t: Target,
    wikidata: CanonizationStatus | null,
    article: CanonizationStatus | null,
    articleUrl: string | null,
  ) => {
    reviewed.add(t.id);
    report.stageReview.push({
      contentId: t.id,
      slug: t.slug,
      title: t.title,
      qid: t.qid,
      published: String(t.payload.canonizationStatus ?? ""),
      wikidata,
      article,
      articleUrl,
    });
  };
  /** A "venerable" row whose stage came from the Orthodox honorific (step 2's). */
  const honorificVenerable = (t: Target, f: SaintFacts | undefined): boolean =>
    t.payload.canonizationStatus === "venerable" &&
    Boolean(f?.statuses.includes(ORTHODOX_HONORIFIC_QID));
  /** The stage the article states: a dated canonization / beatification, else its honorific. */
  const articleStage = (infobox: Record<string, string>): CanonizationStatus | null =>
    articleDatedStage(infobox) ?? statusFromInfobox(infobox);

  // ── 1. Orthodox-only figures → unpublish ─────────────────────────────────
  if (want("orthodox")) {
    for (const t of structured) {
      const f = facts.get(t.qid as string);
      if (!f) continue;
      let reason: string | null = null;
      if (CONFIRMED_NON_CATHOLIC.has(f.qid)) {
        reason = CONFIRMED_NON_CATHOLIC.get(f.qid) ?? null;
      } else if (honorificVenerable(t, f)) {
        // Step 2 decides these from their Catholic stage, if any: the honorific
        // alone also "proves" Joseph Marello non-Catholic when Wikidata gives
        // him no religion, and he is a canonized saint.
        continue;
      } else if (isProvenNonCatholic(f)) {
        reason =
          `Wikidata ${f.qid} records a non-Catholic status / religion (statuses: ${f.statuses.join(", ") || "none"}; ` +
          `religions: ${f.religionLabels.join(", ") || f.religions.join(", ") || "none"}) and no Catholic one.`;
      } else if (!hasCatholicStatus(f) && !hasCatholicReligion(f)) {
        // Nothing on Wikidata proves Catholic veneration; ask the article WHO
        // venerates the person. Article-only evidence makes a SUSPECT: listed,
        // and unpublished only when the operator asks for it.
        const article = citedArticle(t.payload);
        if (!article) continue;
        const doc = await readArticle(article.url);
        if (!doc.read) {
          unreadable(t, article.url);
          continue;
        }
        const { otherCommunion, catholicVenerator } = venerationBodies(doc.infobox);
        if (otherCommunion && !catholicVenerator) {
          const actioned = opts.unpublishArticleSuspects === true;
          report.suspects.push({
            contentId: t.id,
            slug: t.slug,
            title: t.title,
            qid: t.qid,
            venerated: veneratedIn(doc.infobox).slice(0, 160),
            article: article.url,
            actioned,
          });
          if (actioned) {
            reason =
              `Wikidata ${f.qid} records no Catholic status or religion, and the article names only ` +
              `"${veneratedIn(doc.infobox)}" as venerating this person.`;
          }
        }
      }
      if (!reason) continue;
      unpublished.add(t.id);
      plan({
        kind: "unpublish",
        category: "orthodox",
        contentId: t.id,
        slug: t.slug,
        title: t.title,
        qid: t.qid,
        reason: `${reason} Published by the earlier label-based status mapping; unpublished, not deleted.`,
        changes: { isPublished: [true, false] },
      });
    }
  }

  // ── 2. Venerables that came from the Orthodox honorific → re-status ──────
  if (want("restatus")) {
    for (const t of structured) {
      if (unpublished.has(t.id)) continue;
      const f = facts.get(t.qid as string);
      if (!f || !honorificVenerable(t, f)) continue;
      const article = citedArticle(t.payload);
      const doc = article ? await readArticle(article.url) : null;
      if (article && doc && !doc.read) {
        unreadable(t, article.url);
        continue;
      }
      const infobox = doc?.infobox ?? {};
      let status: CanonizationStatus | null = resolveCanonizationStatus(f)?.status ?? null;
      let basis = `Wikidata P411 (${f.statuses.join(", ")})`;
      if (status) {
        // Wikidata's Catholic stage must agree with the article (the ingest's
        // rule): a disagreement is for a human, not for this script.
        if (articleStageConflict(status, infobox)) {
          review(t, status, articleStage(infobox), article?.url ?? null);
          continue;
        }
      } else if (article) {
        // The ingest's own infobox rule. Without a Catholic religion on
        // Wikidata the article must also NAME the Catholic Church as venerating
        // the person: an Orthodox glorification is dated in the same
        // `canonized_date` field.
        status =
          hasCatholicReligion(f) || venerationBodies(infobox).catholicVenerator
            ? statusFromInfobox(infobox)
            : null;
        basis = `the article's infobox (${article.url})`;
      }
      if (!status) {
        // No Catholic stage anywhere. Unpublish only on POSITIVE evidence that
        // another communion venerates the person; a silent record is a human's
        // call (Íñigo of Oña, canonized in 1259, has no infobox at all).
        const bodies = veneratedIn(infobox);
        const { otherCommunion, catholicVenerator } = venerationBodies(infobox);
        const otherReligion = hasNonCatholicReligion(f) && !hasCatholicReligion(f);
        const otherVenerators = Boolean(article) && otherCommunion && !catholicVenerator;
        if (!otherReligion && !otherVenerators) {
          review(t, null, articleStage(infobox), article?.url ?? null);
          continue;
        }
        unpublished.add(t.id);
        const evidence = otherVenerators
          ? `the article names only "${bodies}" as venerating the person`
          : `Wikidata gives only a non-Catholic religion (${f.religionLabels.join(", ") || f.religions.join(", ")})`;
        plan({
          kind: "unpublish",
          category: "restatus",
          contentId: t.id,
          slug: t.slug,
          title: t.title,
          qid: t.qid,
          reason:
            `Published as "venerable" from the Orthodox monastic honorific ${ORTHODOX_HONORIFIC_QID}, ` +
            `which is not the Catholic stage; no Catholic stage of the cause is recorded, and ${evidence}.`,
          changes: { isPublished: [true, false] },
        });
        continue;
      }
      statusAfter.set(t.id, status);
      if (status === "venerable") continue; // the feast rule below handles it
      if (!FEASTLESS_CANONIZATION_STATUSES.has(status) && typeof t.payload.feastDay !== "string") {
        // A canonized / beatified saint must carry a feast (schema); one this
        // row no longer has cannot be invented here.
        report.errors.push(
          `${t.slug}: the Catholic stage is ${status} per ${basis}, but the row has no feast to keep; left for review`,
        );
        continue;
      }
      const canonicalName =
        typeof t.payload.canonicalName === "string" && t.payload.canonicalName.trim()
          ? t.payload.canonicalName.trim()
          : t.title;
      const title = saintDisplayTitle(canonicalName, status);
      const provenance = t.payload.provenance as { biography?: string } | undefined;
      const saintType = deriveSaintType(f, {
        abstract:
          provenance?.biography === "structured-facts"
            ? undefined
            : String(t.payload.biography ?? ""),
        infoboxTitles: infobox.titles,
      });
      const changes: Record<string, [unknown, unknown]> = {
        canonizationStatus: ["venerable", status],
      };
      if (title !== t.title) changes.title = [t.title, title];
      if (saintType !== t.payload.saintType) changes.saintType = [t.payload.saintType, saintType];
      const action: CleanupAction = {
        kind: "update",
        category: "restatus",
        contentId: t.id,
        slug: t.slug,
        title: t.title,
        qid: t.qid,
        reason:
          `Published as "venerable" from the Orthodox monastic honorific ${ORTHODOX_HONORIFIC_QID}; ` +
          `the Catholic stage is "${status}" per ${basis}.`,
        changes,
        applied: null,
      };
      pending.set(t.id, { target: t, action });
    }
  }

  // ── 3. No feast for a Venerable / Servant of God ─────────────────────────
  if (want("feastless")) {
    for (const t of targets) {
      if (unpublished.has(t.id) || reviewed.has(t.id)) continue;
      const decided = statusAfter.get(t.id);
      const status = decided ?? String(t.payload.canonizationStatus ?? "");
      if (!FEASTLESS_CANONIZATION_STATUSES.has(status) || !hasFeast(t.payload)) continue;
      // A "venerable" that is really the Orthodox honorific is the re-status
      // step's to decide (Joseph Marello is a canonized saint and keeps his
      // feast); never strip it on the strength of a stage that is wrong — nor
      // when the Wikidata record could not be read to tell.
      const f = t.qid ? facts.get(t.qid) : undefined;
      if (t.qid && !f) {
        report.errors.push(`${t.slug}: Wikidata facts unavailable; its feast is left for a rerun`);
        continue;
      }
      if (honorificVenerable(t, f) && !decided) continue;
      // The stage must be CONFIRMED before a feast is taken away. Wikidata
      // first (a re-statused row was already decided from it or the article):
      // a record past Venerable keeps the feast and goes to review.
      const wikidata = f ? (resolveCanonizationStatus(f)?.status ?? null) : null;
      const article = citedArticle(t.payload);
      const doc = article ? await readArticle(article.url) : null;
      if (article && doc && !doc.read) {
        unreadable(t, article.url);
        continue;
      }
      const infobox = doc?.infobox ?? {};
      if (f && !decided && wikidata && !FEASTLESS_CANONIZATION_STATUSES.has(wikidata)) {
        review(t, wikidata, articleStage(infobox), article?.url ?? null);
        continue;
      }
      // A record that proves no Catholic stage — or a row with no Wikidata
      // record at all, whose stage only its own payload claims — needs the
      // article to confirm one (Bartholomew Holzhauser: "Venerable", venerated
      // in the Roman Catholic Church); otherwise the feast stays and the row
      // goes to review.
      if (!decided && !wikidata) {
        const stated = statusFromInfobox(infobox);
        if (!stated || !FEASTLESS_CANONIZATION_STATUSES.has(stated)) {
          review(t, null, articleStage(infobox), article?.url ?? null);
          continue;
        }
      }
      // Then the article: one that dates a beatification or canonization
      // outranks a stale "Venerable" anywhere else.
      if (articleStageConflict(status as CanonizationStatus, infobox)) {
        review(t, wikidata, articleStage(infobox), article?.url ?? null);
        continue;
      }
      const removal = `A ${status === "servant_of_god" ? "Servant of God" : "Venerable"} has no liturgical feast; removed the feast day ${String(t.payload.feastDay ?? "")}.`;
      const existing = pending.get(t.id);
      if (existing) {
        existing.action.changes.feastDay = [t.payload.feastDay ?? null, null];
        existing.action.reason = `${existing.action.reason} ${removal}`;
      } else {
        pending.set(t.id, {
          target: t,
          action: {
            kind: "update",
            category: "feastless",
            contentId: t.id,
            slug: t.slug,
            title: t.title,
            qid: t.qid,
            reason: removal,
            changes: { feastDay: [t.payload.feastDay ?? null, null] },
            applied: null,
          },
        });
      }
    }
  }
  for (const { action } of pending.values()) report.actions.push(action);

  // ── 4. List feasts that contradict the article infobox (no writes) ───────
  if (want("feast-audit")) {
    const limit = opts.auditLimit ?? Number.POSITIVE_INFINITY;
    let audited = 0;
    for (const t of targets) {
      if (audited >= limit) break;
      if (unpublished.has(t.id)) continue;
      const status = statusAfter.get(t.id) ?? String(t.payload.canonizationStatus ?? "");
      if (FEASTLESS_CANONIZATION_STATUSES.has(status)) continue;
      const published = typeof t.payload.feastDay === "string" ? t.payload.feastDay : null;
      const article = citedArticle(t.payload);
      if (!published || !article) continue;
      audited += 1;
      const doc = await readArticle(article.url);
      if (audited % 100 === 0) log(`feast audit ${audited} articles read`);
      if (!doc.read) {
        unreadable(t, article.url);
        continue;
      }
      const first = infoboxFirstFeast(doc.infobox, article.lang);
      if (!first || first.feastDay === published) continue;
      const value = infoboxFeastValue(doc.infobox);
      const [mm, dd] = published.split("-").map(Number);
      const named = feastMentionIndexLocalized(mm, dd, value, article.lang) >= 0;
      report.feastContradictions.push({
        contentId: t.id,
        slug: t.slug,
        title: t.title,
        qid: t.qid,
        publishedFeast: published,
        infoboxFeast: first.feastDay,
        infoboxValue: value.slice(0, 160),
        article: article.url,
        kind: named ? "historical" : "contradicted",
      });
    }
  }

  if (!apply) return report;

  // ── Apply ────────────────────────────────────────────────────────────────
  // Every write is made on the row as it stands NOW. The decisions above rest
  // on the snapshot read when the run started — the feast audit alone reads
  // ~3,000 articles, a quarter of an hour — and the live worker (its saint
  // repair lane, the hygiene sweep) may have re-statused, edited or
  // unpublished the row since. Writing the old snapshot back would undo that
  // work, so a row whose decision no longer holds is reported, not written.
  const byId = new Map(targets.map((t) => [t.id, t]));
  for (const action of report.actions) {
    const target = byId.get(action.contentId);
    if (!target) continue;
    const fresh = await readCurrentRow(prisma, target.id);
    const drift = fresh ? driftSince(action, target, fresh) : "the row could not be read";
    if (!fresh || drift) {
      action.applied = false;
      action.error = `left unchanged: ${drift}; rerun the dry run`;
      continue;
    }
    if (action.kind === "unpublish") {
      if (!target.qid) {
        action.applied = false;
        action.error = "no Wikidata id";
        continue;
      }
      const r = await unpublishStructuredSaint(prisma, {
        row: fresh,
        qid: target.qid,
        reason: action.reason,
        facts: facts.get(target.qid) ?? null,
        proposedAction: `unpublish (saint cleanup: ${action.category})`,
        evidence: { cleanupCategory: action.category },
        passId: opts.passId,
      });
      action.applied = r.ok;
      if (!r.ok) action.error = r.error;
      continue;
    }
    if (!pending.has(action.contentId)) continue;
    const proposed: Record<string, unknown> = { ...fresh.payload };
    const status = action.changes.canonizationStatus?.[1];
    if (typeof status === "string") proposed.canonizationStatus = status;
    const saintType = action.changes.saintType?.[1];
    if (typeof saintType === "string") proposed.saintType = saintType;
    const newTitle = action.changes.title?.[1];
    if (typeof newTitle === "string") proposed.title = newTitle;
    if (action.changes.feastDay) for (const f of FEAST_FIELDS) delete proposed[f];
    const proposedTitle = typeof newTitle === "string" ? newTitle : fresh.title;
    const proposedSubtitle = generateContentSubtitle({
      contentType: "SAINT",
      title: proposedTitle,
      fields: proposed,
    });
    const result = await applyProtectedContentUpdate(prisma, {
      contentId: target.id,
      proposedPayload: proposed,
      proposedTitle,
      proposedSubtitle,
      reason: `saint cleanup (${action.category}): ${action.reason}`,
      allowReplace: true,
      qualityScore: 0.92,
      evidenceCount: 1,
      passId: opts.passId,
    });
    action.applied = result.applied;
    if (!result.applied) action.error = result.reason;
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "REPAIR",
      severity: result.applied ? "INFO" : "WARN",
      eventName: "saint_cleanup_update",
      contentType: "SAINT",
      relatedEntityId: target.id,
      message: `Saint cleanup (${action.category}) ${result.applied ? "updated" : "could not update"} "${fresh.title}" (${fresh.slug}): ${action.reason}`,
      safeMetadata: {
        contentId: target.id,
        slug: fresh.slug,
        wikidataQid: target.qid,
        category: action.category,
        changes: action.changes,
        versionId: result.versionId ?? null,
        outcome: result.reason,
      } as Prisma.InputJsonValue,
    }).catch(() => undefined);
  }

  const count = (kind: CleanupAction["kind"], category?: CleanupAction["category"]) =>
    report.actions.filter(
      (a) => a.kind === kind && a.applied === true && (!category || a.category === category),
    ).length;
  await writeAdminWorkerLog(prisma, {
    passId: opts.passId,
    category: "REPAIR",
    severity: "INFO",
    eventName: "booster_saint_cleanup",
    contentType: "SAINT",
    message:
      `Saint cleanup applied: ${count("unpublish")} unpublished (${count("unpublish", "orthodox")} Orthodox-only, ` +
      `${count("unpublish", "restatus")} with no Catholic stage), ${count("update", "restatus")} re-statused, ` +
      `${report.actions.filter((a) => a.kind === "update" && a.applied && a.changes.feastDay).length} feast(s) removed; ` +
      `${report.stageReview.length} row(s) whose stage the sources dispute (listed, not changed); ` +
      `${report.feastContradictions.length} published feast(s) contradict the article infobox (listed, not changed); ` +
      `${report.suspects.length} row(s) whose article alone names another communion (${report.suspects.filter((s) => s.actioned).length} unpublished on request).`,
    safeMetadata: {
      examined: report.examined,
      structured: report.structured,
      factsResolved: report.factsResolved,
      articlesRead: report.articlesRead,
      actions: report.actions.length,
      failed: report.actions.filter((a) => a.applied === false).length,
      stageReview: report.stageReview.map((s) => s.slug).slice(0, 50),
      suspects: report.suspects.map((s) => s.slug).slice(0, 50),
      feastContradictions: report.feastContradictions.length,
      errors: report.errors.slice(0, 10),
    },
  }).catch(() => undefined);

  return report;
}
