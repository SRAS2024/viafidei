/**
 * Content custody mode (spec: "Add content custody mode" +
 * "missing-information detection ... convert findings into structured worker
 * jobs"). TypeScript runs the custody job; the Python brain inspects each
 * sampled record for gaps (missing sources/citations/relationships/etc.) and
 * the weakest records are surfaced as a deduped improvement request.
 *
 * Throttled + fail-open; never blocks a pass.
 *
 * The scan walks the catalogue with a persisted CURSOR (AdminWorkerMemory
 * `custody-cursor`, ordered by id) and wraps around at the end. The pass never
 * writes to the rows it inspects, so the old "25 oldest-updated rows" query
 * returned the identical 25 records every hour for the life of the deployment
 * and 99% of the catalogue was never looked at.
 *
 * Runs in its own ops lane, outside the `intelligence` lane, so each brain
 * call is taken under `withBrainMutex` (the resident brain serves one request
 * at a time and the bridge does not queue).
 */

import type { PrismaClient } from "@prisma/client";

import { withBrainMutex } from "./brain-mutex";
import { isBrainEnabled } from "./intelligence";
import { BrainCallContext, recordDeveloperRequests } from "./intelligence/store";
import { detectMissingFor } from "./intelligence/service";
import { writeAdminWorkerLog } from "./logs";

const COMPLETENESS_FLOOR = 0.7;
let _lastCustodyAt = 0;
const THROTTLE_MS = 60 * 60 * 1000; // hourly
const PAGE_SIZE = 25;
const CURSOR_KEY = "custody-cursor";

export interface CustodyResult {
  ran: boolean;
  scanned: number;
  weak: number;
  /** True when the cursor reached the end of the catalogue and wrapped. */
  wrapped?: boolean;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

const cursorWhere = {
  memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: CURSOR_KEY },
};

/** The id the previous scan stopped at, or null to start from the beginning. */
async function readCursor(prisma: PrismaClient): Promise<string | null> {
  try {
    const row = await prisma.adminWorkerMemory.findUnique({
      where: cursorWhere,
      select: { memoryValue: true },
    });
    const value = row?.memoryValue;
    const afterId =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as { afterId?: unknown }).afterId
        : null;
    return typeof afterId === "string" && afterId ? afterId : null;
  } catch {
    return null;
  }
}

async function writeCursor(prisma: PrismaClient, afterId: string | null): Promise<void> {
  const memoryValue = { afterId, updatedAt: new Date().toISOString() };
  await prisma.adminWorkerMemory
    .upsert({
      where: cursorWhere,
      update: { memoryValue, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: CURSOR_KEY,
        memoryValue,
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
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
    const afterId = await readCursor(prisma);
    const select = { id: true, contentType: true, title: true, slug: true, payload: true };
    type Row = { id: string; contentType: string; title: string; slug: string; payload: unknown };
    let rows: Row[] = await prisma.publishedContent
      .findMany({
        where: { isPublished: true, ...(afterId ? { id: { gt: afterId } } : {}) },
        orderBy: { id: "asc" },
        take: PAGE_SIZE,
        select,
      })
      .catch(() => [] as Row[]);

    // End of the catalogue: wrap to the start so the next pages are fresh
    // again, and finish this pass with the first page rather than idling.
    let wrapped = false;
    if (rows.length === 0 && afterId) {
      wrapped = true;
      rows = await prisma.publishedContent
        .findMany({ where: { isPublished: true }, orderBy: { id: "asc" }, take: PAGE_SIZE, select })
        .catch(() => [] as Row[]);
    }
    if (rows.length === 0) {
      if (afterId) await writeCursor(prisma, null);
      return { ran: true, scanned: 0, weak: 0, wrapped };
    }
    // A short page means this was the last one — start over next time.
    await writeCursor(prisma, rows.length < PAGE_SIZE ? null : rows[rows.length - 1].id);

    const weak: Array<{ id: string; completeness: number; missing: string[] }> = [];
    for (const row of rows) {
      const p = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<
        string,
        unknown
      >;
      const res = await withBrainMutex(() =>
        detectMissingFor(
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
          {
            ...ctx,
            entityType: "PUBLISHED",
            entityId: row.id,
            contentType: String(row.contentType),
          },
        ),
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
      message: `Custody scanned ${rows.length} record(s)${wrapped ? " (cursor wrapped to the start)" : ""}; ${weak.length} below completeness ${COMPLETENESS_FLOOR}.`,
      safeMetadata: { scanned: rows.length, weak: weak.length, wrapped },
    }).catch(() => undefined);

    return { ran: true, scanned: rows.length, weak: weak.length, wrapped };
  } catch {
    return { ran: false, scanned: 0, weak: 0 };
  }
}

/** For tests: reset the custody throttle. */
export function resetCustodyThrottle(): void {
  _lastCustodyAt = 0;
}
