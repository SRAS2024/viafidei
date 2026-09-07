/**
 * Structured saint repair — a bounded, idempotent, cursor-based sweep over the
 * ALREADY-PUBLISHED saints that came from Wikidata, re-deriving from the
 * structured record (by QID, through the same rules the ingestor now uses)
 * the three things the old ingest got wrong:
 *
 *   - canonization status — mapped by label, so Orthodox / Anglican / Coptic /
 *     folk "saints" published as Catholic `canonized`, and the Orthodox
 *     honorific "The Venerable" as the Catholic `venerable`;
 *   - saint type — scanned from prose, so St Patrick was an "apostle" and
 *     St John Vianney a "virgin";
 *   - display title — the bare label, so structured saints sat next to the
 *     curated "Saint Joseph" without their honorific;
 *
 * plus a re-check of a multi-feast saint's published day against the
 * infobox-first rule (the old SAMPLE() pick was frozen forever).
 *
 * Corrections go through `applyProtectedContentUpdate` (versioned, reversible,
 * evidence-gated). A row is UNPUBLISHED only when the structured record PROVES
 * the veneration is not Catholic (`isProvenNonCatholic`) — never on doubt — and
 * every unpublish leaves an AdminWorkerLog row and a HumanReviewQueue row so an
 * operator can restore it with one click. Nothing is deleted.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { applyProtectedContentUpdate } from "../content-protection";
import { fileHumanReview } from "../human-review";
import { writeAdminWorkerLog } from "../logs";
import { chooseCorroboratedFeast, parseFeastCandidates } from "./ingestors";
import {
  SAINT_FACTS_PATTERNS,
  SAINT_FACTS_SELECT,
  deriveSaintType,
  isProvenNonCatholic,
  parseSaintFacts,
  resolveCanonizationStatus,
  saintDisplayTitle,
  type SaintFacts,
} from "./saint-facts";
import { persistSourceCooldown, readSourceCooldownMs } from "./source-cooldown";
import { runSparql, wikidataEntityUrl } from "./wikidata";
import { fetchArticleInfobox } from "./wikipedia-infobox";

export const SAINT_REPAIR_CURSOR_KEY = "structured-saint-repair-cursor";

/** Structured rows are identified by a wikidata.org citation / sourceRef. */
const WIKIDATA_REF_RE = /wikidata\.org\/wiki\/(Q\d+)/;

export interface StructuredSaintRepairResult {
  examined: number;
  repaired: number;
  unpublished: number;
  unchanged: number;
  /** Rows whose facts could not be resolved (entity gone, no proof either way). */
  unresolved: number;
  /** True when this pass reached the end of the corpus (cursor wrapped). */
  completed: boolean;
  /** Set when the SPARQL source failed (cursor left unchanged). */
  sourceFailure: string | null;
  errors: string[];
}

interface RepairCursor {
  lastId: string | null;
  sweeps: number;
  lastCompletedAt: number | null;
}

async function readRepairCursor(prisma: PrismaClient): Promise<RepairCursor> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: {
        memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: SAINT_REPAIR_CURSOR_KEY },
      },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = (row?.memoryValue ?? {}) as Partial<RepairCursor>;
  return {
    lastId: typeof v.lastId === "string" && v.lastId ? v.lastId : null,
    sweeps: typeof v.sweeps === "number" ? v.sweeps : 0,
    lastCompletedAt: typeof v.lastCompletedAt === "number" ? v.lastCompletedAt : null,
  };
}

async function writeRepairCursor(prisma: PrismaClient, cursor: RepairCursor): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: {
        memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: SAINT_REPAIR_CURSOR_KEY },
      },
      update: { memoryValue: { ...cursor }, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: SAINT_REPAIR_CURSOR_KEY,
        memoryValue: { ...cursor },
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

/** The Wikidata QID a published row came from, or null for curated rows. */
export function publishedSaintQid(row: {
  sourceRef?: string | null;
  payload: unknown;
}): string | null {
  const fromRef = row.sourceRef?.match(WIKIDATA_REF_RE)?.[1];
  if (fromRef) return fromRef;
  const p = (row.payload ?? {}) as Record<string, unknown>;
  if (typeof p.wikidataQid === "string" && /^Q\d+$/.test(p.wikidataQid)) return p.wikidataQid;
  const citations = Array.isArray(p.citations) ? p.citations : [];
  for (const c of citations) {
    const m = typeof c === "string" ? c.match(WIKIDATA_REF_RE) : null;
    if (m) return m[1];
  }
  return null;
}

/** One SPARQL for a batch of QIDs, projected exactly like the ingestor. */
function factsSparqlFor(qids: string[]): string {
  return `SELECT ${SAINT_FACTS_SELECT} WHERE {
  VALUES ?s { ${qids.map((q) => `wd:${q}`).join(" ")} }
  ${SAINT_FACTS_PATTERNS}
}
GROUP BY ?s`;
}

/** The English Wikipedia citation of a payload, if any. */
function enwikiCitation(payload: Record<string, unknown>): string | null {
  const citations = Array.isArray(payload.citations) ? payload.citations : [];
  const url = citations.find(
    (c): c is string => typeof c === "string" && /^https:\/\/en\.wikipedia\.org\/wiki\//.test(c),
  );
  return url ?? null;
}

/**
 * Run one bounded repair pass over up to `limit` structured saints, starting
 * after the persisted cursor. Idempotent: a row whose derived status / type /
 * title / feast already match is a no-op. Uses the shared WDQS gate (one
 * batched query per pass) and honours the persisted cool-down.
 */
export async function runStructuredSaintRepair(
  prisma: PrismaClient,
  opts: { limit?: number; passId?: string } = {},
): Promise<StructuredSaintRepairResult> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100));
  const out: StructuredSaintRepairResult = {
    examined: 0,
    repaired: 0,
    unpublished: 0,
    unchanged: 0,
    unresolved: 0,
    completed: false,
    sourceFailure: null,
    errors: [],
  };

  if ((await readSourceCooldownMs(prisma)) > 0) {
    out.sourceFailure = "cooling";
    return out;
  }

  const cursor = await readRepairCursor(prisma);

  // Walk published SAINT rows by id; keep only the structured ones (a Wikidata
  // QID in sourceRef / payload). Over-fetch so a run of curated rows doesn't
  // starve the pass of work.
  const rows = await prisma.publishedContent
    .findMany({
      where: {
        contentType: "SAINT",
        isPublished: true,
        ...(cursor.lastId ? { id: { gt: cursor.lastId } } : {}),
      },
      orderBy: { id: "asc" },
      take: limit * 4,
      select: { id: true, slug: true, title: true, payload: true, sourceRef: true },
    })
    .catch(() => []);
  const reachedEnd = rows.length < limit * 4;

  const targets: Array<{ row: (typeof rows)[number]; qid: string }> = [];
  let lastExamined: string | null = cursor.lastId;
  for (const row of rows) {
    if (targets.length >= limit) break;
    lastExamined = row.id;
    const qid = publishedSaintQid(row);
    if (qid) targets.push({ row, qid });
  }
  const consumedAll = targets.length < limit || lastExamined === rows[rows.length - 1]?.id;
  const completed = reachedEnd && consumedAll;

  if (targets.length === 0) {
    await writeRepairCursor(prisma, {
      lastId: completed ? null : lastExamined,
      sweeps: cursor.sweeps + (completed ? 1 : 0),
      lastCompletedAt: completed ? Date.now() : cursor.lastCompletedAt,
    });
    out.completed = completed;
    return out;
  }

  let bindings: Awaited<ReturnType<typeof runSparql>> = null;
  try {
    bindings = await runSparql(factsSparqlFor([...new Set(targets.map((t) => t.qid))]));
  } catch {
    bindings = null;
  }
  if (bindings === null) {
    // Source failure: leave the cursor where it is and let the cool-down run.
    out.sourceFailure = "sparql";
    await persistSourceCooldown(prisma);
    return out;
  }
  const factsByQid = new Map<string, SaintFacts>();
  for (const b of bindings) {
    const facts = parseSaintFacts(b);
    if (facts) factsByQid.set(facts.qid, facts);
  }

  for (const { row, qid } of targets) {
    out.examined += 1;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const facts = factsByQid.get(qid);
    if (!facts) {
      out.unresolved += 1;
      continue;
    }

    // ── Non-Catholic veneration proven by the structured record → unpublish ─
    if (isProvenNonCatholic(facts)) {
      try {
        await prisma.publishedContent.update({
          where: { id: row.id },
          data: { isPublished: false, unpublishedAt: new Date() },
        });
      } catch (err) {
        out.errors.push(
          `${row.slug}: unpublish failed (${err instanceof Error ? err.message : String(err)})`,
        );
        continue;
      }
      out.unpublished += 1;
      const reason =
        `Wikidata ${qid} records this saint with a non-Catholic canonization status / religion ` +
        `(statuses: ${facts.statuses.join(", ") || "none"}; religions: ${
          facts.religionLabels.join(", ") || facts.religions.join(", ") || "none"
        }) and no Catholic status or religion. The record was published by the earlier label-based ` +
        `status mapping and cannot be shown as a Catholic saint.`;
      await writeAdminWorkerLog(prisma, {
        passId: opts.passId,
        category: "CLEANUP",
        severity: "WARN",
        eventName: "structured_saint_unpublished",
        contentType: "SAINT",
        relatedEntityId: row.id,
        sourceUrl: wikidataEntityUrl(qid),
        message: `Unpublished SAINT "${row.title}" (${row.slug}): ${reason}`,
        safeMetadata: {
          contentId: row.id,
          slug: row.slug,
          wikidataQid: qid,
          statuses: facts.statuses,
          religions: facts.religions,
          religionLabels: facts.religionLabels,
        },
      }).catch(() => undefined);
      await fileHumanReview(prisma, {
        contentType: "SAINT",
        contentTitle: row.title,
        proposedAction: "unpublish (structured saint repair)",
        reason,
        confidence: 0.92,
        sourceEvidence: {
          wikidata: wikidataEntityUrl(qid),
          statuses: facts.statuses,
          religions: facts.religions,
        },
        currentVersion: payload as Prisma.InputJsonValue,
        blockingGate: "catholic-accuracy",
        neededAction:
          "Confirm the person is not venerated by the Catholic Church. If they are (a pre-schism saint Wikidata tags only as Orthodox), set isPublished back to true and add the Catholic status on Wikidata.",
        repairSuggestion:
          "Restore the row (PublishedContent.isPublished = true) if Catholic veneration is documented.",
        nextAutomatedAction:
          "none — the worker will not republish this record without a Catholic status on Wikidata.",
        alwaysQueue: true,
      }).catch(() => undefined);
      continue;
    }

    // ── Re-derive status / type / title / feast; apply through protection ──
    const resolved = resolveCanonizationStatus(facts);
    const proposed: Record<string, unknown> = { ...payload };
    // The structured record must PROVE the Catholic status before the sweep
    // rewrites anything. Falling back to the stored status would let a row the
    // old label mapping got wrong (generic "saint", no Catholic religion) keep
    // that status AND gain a freshly derived type/title built on it — doubt
    // laundered into a correction. No proof either way → leave the row alone.
    const status = resolved?.status ?? null;
    if (!status) {
      out.unresolved += 1;
      continue;
    }
    if (resolved && resolved.status !== payload.canonizationStatus) {
      proposed.canonizationStatus = resolved.status;
    }
    if (typeof payload.wikidataQid !== "string") proposed.wikidataQid = qid;

    // The infobox (enwiki only) supplies the `titles` signal for virgin /
    // confessor and disambiguates a multi-feast saint. Fail-open.
    const article = enwikiCitation(payload);
    const infobox: Record<string, string> = article
      ? await fetchArticleInfobox(article).catch(() => ({}))
      : {};
    const provenance = payload.provenance as { biography?: string } | undefined;
    const abstract =
      provenance?.biography === "structured-facts" ? undefined : String(payload.biography ?? "");
    const saintType = deriveSaintType(facts, { abstract, infoboxTitles: infobox.titles });
    if (saintType !== payload.saintType) proposed.saintType = saintType;

    const candidates = parseFeastCandidates(facts.feasts);
    if (candidates.length > 1 && Object.keys(infobox).length > 0) {
      const feast = chooseCorroboratedFeast({
        candidates,
        abstract: abstract ?? "",
        infobox,
        lang: "en",
      });
      if (feast && feast.feastDay !== payload.feastDay) {
        proposed.feastDay = feast.feastDay;
        proposed.feastMonth = feast.feastMonth;
        proposed.feastDayOfMonth = feast.feastDayOfMonth;
      }
    }

    const canonicalName =
      typeof payload.canonicalName === "string" && payload.canonicalName.trim()
        ? payload.canonicalName.trim()
        : row.title;
    const title = saintDisplayTitle(canonicalName, status);
    if (typeof payload.title === "string" || title !== row.title) proposed.title = title;

    const result = await applyProtectedContentUpdate(prisma, {
      contentId: row.id,
      proposedPayload: proposed,
      proposedTitle: title,
      reason: "structured saint repair",
      allowReplace: true,
      qualityScore: 0.92,
      evidenceCount: 1,
      passId: opts.passId,
    });
    if (result.applied) out.repaired += 1;
    else if (result.kind === "noop") out.unchanged += 1;
    else out.errors.push(`${row.slug}: ${result.reason}`);
  }

  await writeRepairCursor(prisma, {
    lastId: completed ? null : lastExamined,
    sweeps: cursor.sweeps + (completed ? 1 : 0),
    lastCompletedAt: completed ? Date.now() : cursor.lastCompletedAt,
  });
  out.completed = completed;

  if (out.repaired > 0 || out.unpublished > 0) {
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "REPAIR",
      severity: "INFO",
      eventName: "structured_saint_repair",
      contentType: "SAINT",
      message: `Structured saint repair: examined ${out.examined}, corrected ${out.repaired}, unpublished ${out.unpublished}, unchanged ${out.unchanged}, unresolved ${out.unresolved}${completed ? " (sweep complete)" : ""}.`,
      safeMetadata: { ...out, errors: out.errors.slice(0, 10) },
    }).catch(() => undefined);
  }

  return out;
}
