/**
 * Pope catalogue cleanup.
 *
 * Wikidata tags antipopes with the papal position, and an earlier version of the
 * POPE ingestor published some of them (their labels — "Antipope John XXIII" —
 * contain "pope", so the title logic kept them). The ingestor now excludes them,
 * but the already-published rows remain, inflating the pope count above the real
 * line of Roman Pontiffs. This prunes them: it unpublishes any live POPE record
 * whose title or slug marks it an antipope, so the count reflects history.
 *
 * Cheap + idempotent: once the antipopes are unpublished the query returns
 * nothing, so the loop can call it every pass as a no-op. Fail-open.
 */

import type { PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";

export interface PopeCleanupResult {
  pruned: number;
  titles: string[];
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
