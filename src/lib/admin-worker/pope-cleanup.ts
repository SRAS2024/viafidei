/**
 * Pope catalogue reconciliation.
 *
 * The pope count must reflect history exactly — every Roman Pontiff once, no
 * more and no less, growing by one only when a new pope is elected. Two legacy
 * sources of over-count are reconciled here:
 *
 *   1. Antipopes. Wikidata tags antipopes with the papal position, and an
 *      earlier version of the POPE ingestor published some of them (their labels
 *      — "Antipope John XXIII" — contain "pope", so the title logic kept them).
 *      The ingestor now excludes them, but already-published rows remain.
 *      `pruneAntipopeRecords` unpublishes any live POPE row marked an antipope.
 *      It also unpublishes the entities in `NOT_ROMAN_PONTIFFS` (Pope Joan, the
 *      never-consecrated Stephen of 752, Benedict X), whose labels give no sign.
 *   2. Duplicates. Before the publish path deduped on the canonical regnal name,
 *      the same pontiff could be published twice under different slugs ("Pope
 *      John Paul II" vs "Pope Saint John Paul II"). `pruneDuplicatePopeRecords`
 *      collapses each such group to its single best record. Names alone miss
 *      a pope remembered by an epithet ("Saint Leo the Great" and Wikidata's
 *      "Leo I"), so rows with the same reign years and regnal name whose
 *      numbers do not disagree are the same pope as well.
 *
 * Both are cheap + idempotent: once reconciled the queries return nothing, so the
 * loop can call them every pass as a no-op. Fail-open — reconciliation must never
 * break a worker pass.
 */

import type { PrismaClient, Prisma } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";
import { NOT_ROMAN_PONTIFFS, normalizeName } from "./structured/ingestors";
import { wikidataEntityUrl } from "./structured/wikidata";

export interface PopeCleanupResult {
  pruned: number;
  titles: string[];
}

/** Number of populated fields in a payload — the richer record wins a tie. */
function payloadFieldCount(payload: unknown): number {
  return payload && typeof payload === "object" ? Object.keys(payload as object).length : 0;
}

export async function pruneAntipopeRecords(prisma: PrismaClient): Promise<PopeCleanupResult> {
  const rows = await prisma.publishedContent
    .findMany({
      where: {
        contentType: "POPE",
        isPublished: true,
        OR: [
          { slug: { contains: "antipope" } },
          { title: { contains: "antipope", mode: "insensitive" } },
          { sourceRef: { in: [...NOT_ROMAN_PONTIFFS.keys()].map(wikidataEntityUrl) } },
        ],
      },
      select: { id: true, title: true },
    })
    .catch(() => [] as Array<{ id: string; title: string }>);

  if (rows.length === 0) return { pruned: 0, titles: [] };

  const ids = rows.map((r) => r.id);
  await prisma.publishedContent
    .updateMany({
      where: { id: { in: ids } },
      data: { isPublished: false, unpublishedAt: new Date() },
    })
    .catch(() => undefined);

  await writeAdminWorkerLog(prisma, {
    category: "PUBLISHING",
    severity: "WARN",
    eventName: "antipope_records_pruned",
    message: `Pruned ${rows.length} antipope or non-pontiff record(s) from the pope catalogue so the count reflects the real line of Roman Pontiffs.`,
    contentType: "POPE",
    safeMetadata: { pruned: rows.length, titles: rows.map((r) => r.title).slice(0, 50) },
  }).catch(() => undefined);

  return { pruned: rows.length, titles: rows.map((r) => r.title) };
}

type PopeRow = {
  id: string;
  title: string;
  slug: string;
  sourceRef: string | null;
  payload: Prisma.JsonValue;
  createdAt: Date;
};

/**
 * The regnal identity in a pope's title: the name and, when the title has one,
 * the regnal number. "Pope Saint Nicholas I (the Great)" → nicholas / i;
 * "Pope Saint Leo the Great" → leo / none; "Pope John Paul II" → john paul / ii.
 * `specific` is false for a bare name ("Pope John"), which tells the pope apart
 * from nobody else of that name.
 */
export function regnalIdentity(title: string): {
  name: string;
  ordinal: string | null;
  specific: boolean;
} {
  const words = normalizeName(title.replace(/\([^)]*\)/g, " ").replace(/\bpope-elect\b/gi, " "))
    .split(" ")
    .filter(Boolean);
  const numeral = words.findIndex((w, i) => i > 0 && /^[ivxlcdm]+$/.test(w));
  if (numeral > 0)
    return { name: words.slice(0, numeral).join(" "), ordinal: words[numeral], specific: true };
  const epithet = words.indexOf("the");
  if (epithet > 0)
    return { name: words.slice(0, epithet).join(" "), ordinal: null, specific: true };
  return { name: words.join(" "), ordinal: null, specific: false };
}

function yearOf(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\D/g, "")
    : "";
}

/**
 * Best record first: a title that names the pope (regnal number or epithet)
 * over a bare name; a curated record over one built from Wikidata (it was
 * written and checked by hand); then the richer payload, the canonical
 * `pope-…` slug, and the older row.
 */
function bestFirst(a: PopeRow, b: PopeRow): number {
  const bySpecific =
    Number(regnalIdentity(b.title).specific) - Number(regnalIdentity(a.title).specific);
  if (bySpecific !== 0) return bySpecific;
  const byCurated = Number(!b.sourceRef) - Number(!a.sourceRef);
  if (byCurated !== 0) return byCurated;
  const byFields = payloadFieldCount(b.payload) - payloadFieldCount(a.payload);
  if (byFields !== 0) return byFields;
  const bySlug = (b.slug.startsWith("pope-") ? 1 : 0) - (a.slug.startsWith("pope-") ? 1 : 0);
  if (bySlug !== 0) return bySlug;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/** Keep the best row of each group; return the rest. */
function collapse(groups: Iterable<PopeRow[]>, losers: PopeRow[]): PopeRow[] {
  const kept: PopeRow[] = [];
  for (const group of groups) {
    const ranked = [...group].sort(bestFirst);
    kept.push(ranked[0]);
    losers.push(...ranked.slice(1));
  }
  return kept;
}

/**
 * Collapse duplicate pope rows so each Roman Pontiff appears exactly once.
 *
 * First by the SAME canonical identity the publish path dedups on
 * (`normalizeName`, which strips the "Pope"/"Saint" honorifics but keeps the
 * distinguishing regnal number — so "Pope St John Paul II" and "Pope John Paul
 * II" collapse, while Benedict XV and Benedict XVI stay distinct). Then by
 * reign: rows with the same first and last reign years and the same regnal
 * name are one pope unless both carry regnal numbers and the numbers differ
 * ("Pope Leo I" and "Pope Saint Leo the Great", 440–461). Adrian V and
 * Innocent V both reigned in 1276 alone and stay apart by name. Each group
 * keeps its best record (`bestFirst`); the rest are unpublished. Idempotent +
 * fail-open.
 */
export async function pruneDuplicatePopeRecords(prisma: PrismaClient): Promise<PopeCleanupResult> {
  const rows: PopeRow[] = await prisma.publishedContent
    .findMany({
      where: { contentType: "POPE", isPublished: true },
      select: {
        id: true,
        title: true,
        slug: true,
        sourceRef: true,
        payload: true,
        createdAt: true,
      },
    })
    .then((found) => found.map((r) => ({ ...r, sourceRef: r.sourceRef ?? null })))
    .catch(() => [] as PopeRow[]);

  if (rows.length === 0) return { pruned: 0, titles: [] };

  const losers: PopeRow[] = [];

  const byName = new Map<string, PopeRow[]>();
  for (const r of rows) {
    const key = normalizeName(r.title);
    if (!key) continue;
    const g = byName.get(key);
    if (g) g.push(r);
    else byName.set(key, [r]);
  }
  const named = collapse(byName.values(), losers);

  const byReign = new Map<string, PopeRow[]>();
  for (const r of named) {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const start = yearOf(p.papacyStart);
    const { name } = regnalIdentity(r.title);
    if (!start || !name) continue;
    const key = `${start}|${yearOf(p.papacyEnd)}|${name}`;
    const g = byReign.get(key);
    if (g) g.push(r);
    else byReign.set(key, [r]);
  }
  collapse(
    [...byReign.values()].filter(
      (g) =>
        g.length > 1 &&
        new Set(g.map((r) => regnalIdentity(r.title).ordinal).filter(Boolean)).size <= 1,
    ),
    losers,
  );

  if (losers.length === 0) return { pruned: 0, titles: [] };

  await prisma.publishedContent
    .updateMany({
      where: { id: { in: losers.map((l) => l.id) } },
      data: { isPublished: false, unpublishedAt: new Date() },
    })
    .catch(() => undefined);

  await writeAdminWorkerLog(prisma, {
    category: "PUBLISHING",
    severity: "WARN",
    eventName: "duplicate_pope_records_pruned",
    message: `Pruned ${losers.length} duplicate pope record(s) so each Roman Pontiff appears once and the count reflects history.`,
    contentType: "POPE",
    safeMetadata: { pruned: losers.length, titles: losers.map((l) => l.title).slice(0, 50) },
  }).catch(() => undefined);

  return { pruned: losers.length, titles: losers.map((l) => l.title) };
}
