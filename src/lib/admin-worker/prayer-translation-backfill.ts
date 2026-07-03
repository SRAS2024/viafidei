/**
 * Prayer/litany translation backfill — fills Latin + Greek on published prayers
 * over time, using the worker's OWN deterministic translation engine only.
 *
 * The publish orchestrator already fills the canonical (deterministic) Latin/
 * Greek at publish time, but that leaves prayers published before the engine
 * existed. This pass closes that gap using `translatePrayerLanguages` — the
 * internal, keyless, network-free engine that renders only authentic received
 * liturgical text (it can never mistranslate). There is NO external AI or
 * machine-translation fallback: the Admin Worker does not call an external
 * service to invent liturgical text. A prayer the corpus can't resolve simply
 * keeps the languages it has, rather than being filled with fabricated text.
 *
 * Bounded + self-throttled + cursor-walked across passes, so it works through the
 * whole catalogue without re-doing finished prayers. Fail-open.
 */

import type { PrismaClient } from "@prisma/client";

import { translatePrayerLanguages } from "./prayer-translator";
import { writeAdminWorkerLog } from "./logs";

const THROTTLE_MS = 60 * 60 * 1000; // hourly
const THROTTLE_KEY = "prayer-translation-backfill-lastrun";
const CURSOR_KEY = "prayer-translation-backfill-cursor";

export interface TranslationBackfillResult {
  scanned: number;
  filledCanonical: number;
  detail: string;
}

async function memInt(prisma: PrismaClient, key: string): Promise<number> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = row?.memoryValue as { offset?: number } | null;
  return typeof v?.offset === "number" && v.offset >= 0 ? v.offset : 0;
}

async function setMemInt(prisma: PrismaClient, key: string, offset: number): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      update: { memoryValue: { offset }, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: key,
        memoryValue: { offset },
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

async function throttleOk(prisma: PrismaClient): Promise<boolean> {
  const where = {
    memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: THROTTLE_KEY },
  };
  const row = await prisma.adminWorkerMemory
    .findUnique({ where, select: { lastUsedAt: true } })
    .catch(() => null);
  const last = row?.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
  if (Date.now() - last < THROTTLE_MS) return false;
  await prisma.adminWorkerMemory
    .upsert({
      where,
      update: { lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: THROTTLE_KEY,
        memoryValue: {},
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
  return true;
}

function has(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Run one translation-backfill pass. Fills canonical (authentic, deterministic)
 * Latin/Greek directly; anything the corpus can't resolve is left as-is (no
 * external AI/machine translation).
 */
export async function runPrayerTranslationBackfill(
  prisma: PrismaClient,
  opts: { batch?: number; force?: boolean } = {},
): Promise<TranslationBackfillResult> {
  const out: TranslationBackfillResult = {
    scanned: 0,
    filledCanonical: 0,
    detail: "",
  };
  if (!opts.force && !(await throttleOk(prisma))) {
    out.detail = "throttled";
    return out;
  }

  const batch = opts.batch ?? 25;
  const offset = await memInt(prisma, CURSOR_KEY);
  const rows = await prisma.publishedContent
    .findMany({
      where: { contentType: "PRAYER", isPublished: true },
      select: { id: true, title: true, slug: true, payload: true },
      orderBy: { id: "asc" },
      skip: offset,
      take: batch,
    })
    .catch(() => [] as Array<{ id: string; title: string; slug: string; payload: unknown }>);

  // Walk forward; wrap to 0 at the end so the whole catalogue is re-swept.
  const nextOffset = rows.length < batch ? 0 : offset + rows.length;

  for (const r of rows) {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const english = has(p.body)
      ? (p.body as string)
      : has(p.prayerText)
        ? (p.prayerText as string)
        : "";
    if (!english) continue;
    const needLatin = !has(p.latin);
    const needGreek = !has(p.greek);
    if (!needLatin && !needGreek) continue;
    out.scanned += 1;

    const update: Record<string, string> = {};

    // Canonical (keyless, deterministic, accurate-only). No AI/machine fallback.
    const canonical = translatePrayerLanguages(english);
    if (needLatin && canonical.latin) {
      update.latin = canonical.latin;
      out.filledCanonical += 1;
    }
    if (needGreek && canonical.greek) {
      update.greek = canonical.greek;
      out.filledCanonical += 1;
    }

    if (Object.keys(update).length > 0) {
      const newPayload = { ...p, ...update };
      // Route the live-row edit through the content-protection gate: it
      // snapshots the current payload first (so this enrichment is reversible)
      // and, being purely additive (fill latin/greek), applies as an "enrich"
      // with a version bump. A destructive change would be refused, but these
      // fills never remove or shorten existing content.
      const { applyProtectedContentUpdate } = await import("./content-protection");
      await applyProtectedContentUpdate(prisma, {
        contentId: r.id,
        proposedPayload: newPayload,
        reason: "prayer-translation-backfill",
      }).catch(() => undefined);
      // Nudge the public route to revalidate so the new translations serve.
      try {
        const { flagCacheRefresh } = await import("./repair");
        await flagCacheRefresh(prisma, `PRAYER:${r.slug}`).catch(() => undefined);
      } catch {
        // best-effort
      }
    }
  }

  await setMemInt(prisma, CURSOR_KEY, nextOffset);

  out.detail = `scanned ${out.scanned} prayer(s): ${out.filledCanonical} canonical fill(s) (deterministic; no external AI).`;
  if (out.filledCanonical > 0) {
    await writeAdminWorkerLog(prisma, {
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "prayer_translation_backfill",
      message: `Prayer translation backfill: ${out.detail}`,
      contentType: "PRAYER",
      safeMetadata: { ...out },
    }).catch(() => undefined);
  }
  return out;
}
