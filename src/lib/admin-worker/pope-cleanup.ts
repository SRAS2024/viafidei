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
 *   2. Duplicates. Before the publish path deduped on the canonical regnal name,
 *      the same pontiff could be published twice under different slugs ("Pope
 *      John Paul II" vs "Pope Saint John Paul II"). `pruneDuplicatePopeRecords`
 *      collapses each such group to its single richest record.
 *
 * Both are cheap + idempotent: once reconciled the queries return nothing, so the
 * loop can call them every pass as a no-op. Fail-open — reconciliation must never
 * break a worker pass.
 */

import type { PrismaClient, Prisma } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";
import { normalizeName } from "./structured/ingestors";

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
    message: `Pruned ${rows.length} antipope record(s) from the pope catalogue so the count reflects the real line of Roman Pontiffs.`,
    contentType: "POPE",
    safeMetadata: { pruned: rows.length, titles: rows.map((r) => r.title).slice(0, 50) },
  }).catch(() => undefined);

  return { pruned: rows.length, titles: rows.map((r) => r.title) };
}

/**
 * Collapse duplicate pope rows so each Roman Pontiff appears exactly once.
 *
 * Groups the live POPE catalogue by the SAME canonical identity the publish path
 * dedups on (`normalizeName`, which strips the "Pope"/"Saint" honorifics but
 * keeps the distinguishing regnal number — so "Pope St John Paul II" and "Pope
 * John Paul II" collapse, while Benedict XV and Benedict XVI stay distinct). For
 * any group with more than one row it keeps the single richest, most-established
 * record (most payload fields, then the canonical `pope-…` slug, then the
 * earliest created) and unpublishes the rest. Idempotent + fail-open.
 */
export async function pruneDuplicatePopeRecords(prisma: PrismaClient): Promise<PopeCleanupResult> {
  const rows = await prisma.publishedContent
    .findMany({
      where: { contentType: "POPE", isPublished: true },
      select: { id: true, title: true, slug: true, payload: true, createdAt: true },
    })
    .catch(
      () =>
        [] as Array<{
          id: string;
          title: string;
          slug: string;
          payload: Prisma.JsonValue;
          createdAt: Date;
        }>,
    );

  if (rows.length === 0) return { pruned: 0, titles: [] };

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = normalizeName(r.title);
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  const losers: Array<{ id: string; title: string }> = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ranked = [...group].sort((a, b) => {
      const byFields = payloadFieldCount(b.payload) - payloadFieldCount(a.payload);
      if (byFields !== 0) return byFields;
      const bySlug = (b.slug.startsWith("pope-") ? 1 : 0) - (a.slug.startsWith("pope-") ? 1 : 0);
      if (bySlug !== 0) return bySlug;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    // Keep ranked[0] (the winner); unpublish the rest.
    for (const loser of ranked.slice(1)) losers.push({ id: loser.id, title: loser.title });
  }

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
