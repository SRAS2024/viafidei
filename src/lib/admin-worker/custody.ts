/**
 * Content custody mode (spec: "Add content custody mode" +
 * "missing-information detection ... convert findings into structured worker
 * jobs"). TypeScript runs the custody job; the Python brain inspects each
 * sampled record for gaps (missing sources/citations/relationships/etc.) and
 * the weakest records are surfaced as a deduped improvement request.
 *
 * Throttled + fail-open; never blocks a pass.
 */

import type { PrismaClient } from "@prisma/client";

import { isBrainEnabled } from "./intelligence";
import { BrainCallContext, recordDeveloperRequests } from "./intelligence/store";
import { detectMissingFor } from "./intelligence/service";
import { writeAdminWorkerLog } from "./logs";

const COMPLETENESS_FLOOR = 0.7;
let _lastCustodyAt = 0;
const THROTTLE_MS = 60 * 60 * 1000; // hourly

export interface CustodyResult {
  ran: boolean;
  scanned: number;
  weak: number;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export async function runCustodyPass(
  prisma: PrismaClient,
  ctx: BrainCallContext = {},
): Promise<CustodyResult> {
  if (!isBrainEnabled() || Date.now() - _lastCustodyAt < THROTTLE_MS) {
    return { ran: false, scanned: 0, weak: 0 };
  }
  _lastCustodyAt = Date.now();
  try {
    const rows = await prisma.publishedContent
      .findMany({
        where: { isPublished: true },
        orderBy: { updatedAt: "asc" }, // oldest-touched first (custody)
        take: 25,
        select: { id: true, contentType: true, title: true, slug: true, payload: true },
      })
      .catch(
        () =>
          [] as Array<{
            id: string;
            contentType: string;
            title: string;
            slug: string;
            payload: unknown;
          }>,
      );

    if (rows.length === 0) return { ran: true, scanned: 0, weak: 0 };

    const weak: Array<{ id: string; completeness: number; missing: string[] }> = [];
    for (const row of rows) {
      const p = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<
        string,
        unknown
      >;
      const res = await detectMissingFor(
        prisma,
        {
          contentType: String(row.contentType),
          title: row.title,
          slug: row.slug,
          summary: typeof p.summary === "string" ? p.summary : undefined,
          body:
            typeof p.body === "string" ? p.body : typeof p.text === "string" ? p.text : undefined,
          sources: asArray(p.sources),
          citations: asArray(p.citations),
          relationships: asArray(p.relationships),
          translations: asArray(p.translations),
        },
        { ...ctx, entityType: "PUBLISHED", entityId: row.id, contentType: String(row.contentType) },
      );
      if (res.available && res.completeness < COMPLETENESS_FLOOR) {
        weak.push({
          id: row.id,
          completeness: res.completeness,
          missing: res.missing.map((m) => m.field),
        });
      }
    }

    if (weak.length > 0) {
      await recordDeveloperRequests(
        prisma,
        [
          {
            kind: "data",
            title: "Improve weak published content",
            detail: `${weak.length} of ${rows.length} sampled published record(s) scored below ${COMPLETENESS_FLOOR} completeness (missing sources/citations/relationships). Queue them for improvement.`,
            severity: weak.length >= rows.length / 2 ? "high" : "medium",
            evidence: weak
              .slice(0, 8)
              .map((w) => `${w.id} (${w.completeness}): ${w.missing.join(",")}`)
              .join(" | "),
          },
        ],
        "custody",
      );
    }

    await writeAdminWorkerLog(prisma, {
      passId: ctx.passId ?? undefined,
      category: "CLEANUP",
      severity: weak.length > 0 ? "WARN" : "INFO",
      eventName: "custody_pass",
      message: `Custody scanned ${rows.length} record(s); ${weak.length} below completeness ${COMPLETENESS_FLOOR}.`,
      safeMetadata: { scanned: rows.length, weak: weak.length },
    }).catch(() => undefined);

    return { ran: true, scanned: rows.length, weak: weak.length };
  } catch {
    return { ran: false, scanned: 0, weak: 0 };
  }
}

/** For tests: reset the custody throttle. */
export function resetCustodyThrottle(): void {
  _lastCustodyAt = 0;
}
