/**
 * Prayer/litany translation backfill — fills Latin + Greek on EVERY prayer over
 * time, using the worker's layered translation engine.
 *
 * The publish orchestrator already fills the canonical (deterministic) Latin/
 * Greek at publish time, but that leaves two gaps: prayers published before the
 * engine existed, and prayers whose text the canonical corpus can't resolve.
 * This pass closes both. For each published prayer still missing a translation
 * it walks the layers the operator authorised, strongest first:
 *
 *   1. CANONICAL (keyless, always on): `translatePrayerLanguages` — authentic
 *      received liturgical text only. Auto-filled; this can never mistranslate.
 *   2. AI engine, then Google Translate (`proposeMachineTranslation`): the
 *      explicitly-authorised fallback for what the corpus can't resolve. Machine
 *      output is review-gated by default (filed to the human-review queue) and
 *      only written directly when TRANSLATION_AUTOPUBLISH_MACHINE is set.
 *
 * Bounded + self-throttled + cursor-walked across passes, so it works through the
 * whole catalogue without re-doing finished prayers. Fail-open.
 */

import type { PrismaClient, Prisma } from "@prisma/client";

import { translatePrayerLanguages, type TargetLang } from "./prayer-translator";
import {
  autoPublishMachineTranslations,
  machineTranslationEnabled,
  proposeMachineTranslation,
} from "./translation-provider";
import { writeAdminWorkerLog } from "./logs";

const THROTTLE_MS = 60 * 60 * 1000; // hourly
const THROTTLE_KEY = "prayer-translation-backfill-lastrun";
const CURSOR_KEY = "prayer-translation-backfill-cursor";

export interface TranslationBackfillResult {
  scanned: number;
  filledCanonical: number;
  filledMachine: number;
  routedToReview: number;
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

async function fileTranslationReview(
  prisma: PrismaClient,
  title: string,
  lang: TargetLang,
  text: string,
  provider: string,
): Promise<void> {
  const langName = lang === "la" ? "Latin" : "Greek";
  await prisma.humanReviewQueue
    .create({
      data: {
        contentType: "PRAYER",
        contentTitle: title,
        proposedAction: "CONFIRM_TRANSLATION",
        reason: `Proposed ${langName} translation (${provider}) — confirm against an authoritative source before it goes live.`,
        confidence: 0.5,
        sourceEvidence: { language: lang, provider, text } as Prisma.InputJsonValue,
        status: "PENDING",
      },
    })
    .catch(() => undefined);
}

/**
 * Run one translation-backfill pass. Fills canonical translations directly,
 * routes machine proposals to review (or fills them when autopublish is on).
 */
export async function runPrayerTranslationBackfill(
  prisma: PrismaClient,
  opts: { batch?: number; force?: boolean } = {},
): Promise<TranslationBackfillResult> {
  const out: TranslationBackfillResult = {
    scanned: 0,
    filledCanonical: 0,
    filledMachine: 0,
    routedToReview: 0,
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
      select: { id: true, title: true, payload: true },
      orderBy: { id: "asc" },
      skip: offset,
      take: batch,
    })
    .catch(() => [] as Array<{ id: string; title: string; payload: unknown }>);

  // Walk forward; wrap to 0 at the end so the whole catalogue is re-swept.
  const nextOffset = rows.length < batch ? 0 : offset + rows.length;

  const machineOn = machineTranslationEnabled();
  const autoMachine = autoPublishMachineTranslations();

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

    // 1) Canonical (keyless, accurate-only).
    const canonical = translatePrayerLanguages(english);
    if (needLatin && canonical.latin) {
      update.latin = canonical.latin;
      out.filledCanonical += 1;
    }
    if (needGreek && canonical.greek) {
      update.greek = canonical.greek;
      out.filledCanonical += 1;
    }

    // 2) Machine fallback for whatever canonical couldn't resolve.
    if (machineOn) {
      const langs: TargetLang[] = [];
      if (needLatin && !update.latin) langs.push("la");
      if (needGreek && !update.greek) langs.push("el");
      for (const lang of langs) {
        const proposal = await proposeMachineTranslation(english, lang).catch(() => null);
        if (!proposal) continue;
        if (autoMachine) {
          update[lang === "la" ? "latin" : "greek"] = proposal.text;
          out.filledMachine += 1;
        } else {
          await fileTranslationReview(prisma, r.title, lang, proposal.text, proposal.provider);
          out.routedToReview += 1;
        }
      }
    }

    if (Object.keys(update).length > 0) {
      await prisma.publishedContent
        .update({
          where: { id: r.id },
          data: { payload: { ...p, ...update } as Prisma.InputJsonValue },
        })
        .catch(() => undefined);
    }
  }

  await setMemInt(prisma, CURSOR_KEY, nextOffset);

  out.detail = `scanned ${out.scanned} prayer(s): ${out.filledCanonical} canonical fill(s), ${out.filledMachine} machine fill(s), ${out.routedToReview} routed to review.`;
  if (out.filledCanonical > 0 || out.filledMachine > 0) {
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
