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
 *      authorised fallback for what the corpus can't resolve, so every prayer
 *      and litany ends up with both Latin and Greek. Machine output is
 *      auto-published by default to fill the gap (recorded with machine
 *      provenance); set TRANSLATION_AUTOPUBLISH_MACHINE=0 to route machine drafts
 *      to human review instead.
 *
 * Bounded + self-throttled + cursor-walked across passes, so it works through the
 * whole catalogue without re-doing finished prayers. Fail-open.
 */

import type { PrismaClient, Prisma } from "@prisma/client";

import { computeContentChecksum } from "./cache-freshness";
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
): Promise<boolean> {
  const langName = lang === "la" ? "Latin" : "Greek";
  // The backfill re-sweeps the catalogue forever — don't re-file a proposal
  // that is already sitting in the queue for this prayer + language.
  const existing = await prisma.humanReviewQueue
    .findFirst({
      where: {
        status: "PENDING",
        proposedAction: "CONFIRM_TRANSLATION",
        contentTitle: title,
        reason: { contains: langName },
      },
      select: { id: true },
    })
    .catch(() => null);
  if (existing) return false;
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
  return true;
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
      select: { id: true, title: true, slug: true, payload: true },
      orderBy: { id: "asc" },
      skip: offset,
      take: batch,
    })
    .catch(() => [] as Array<{ id: string; title: string; slug: string; payload: unknown }>);

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
    const machineFilled: Array<"latin" | "greek"> = [];

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
          const field = lang === "la" ? "latin" : "greek";
          update[field] = proposal.text;
          machineFilled.push(field);
          out.filledMachine += 1;
        } else if (
          await fileTranslationReview(prisma, r.title, lang, proposal.text, proposal.provider)
        ) {
          out.routedToReview += 1;
        }
      }
    }

    if (Object.keys(update).length > 0) {
      // Record which fields were machine-filled (never the authentic-corpus
      // ones), so a curator can later find + verify them. Kept out of the public
      // render via the PublishedDetail meta-field filter.
      const priorMachine = Array.isArray(p.machineTranslated)
        ? (p.machineTranslated as unknown[]).filter((v): v is string => typeof v === "string")
        : [];
      // Recompute the freshness marker — contentChecksum is derived from the
      // payload, and cache verification confirms the stored marker matches the
      // live row. Updating the payload without it would fail verification.
      const newPayload = {
        ...p,
        ...update,
        ...(machineFilled.length > 0
          ? { machineTranslated: Array.from(new Set([...priorMachine, ...machineFilled])) }
          : {}),
      };
      await prisma.publishedContent
        .update({
          where: { id: r.id },
          data: {
            payload: newPayload as Prisma.InputJsonValue,
            contentChecksum: computeContentChecksum(r.title, newPayload),
          },
        })
        .catch(() => undefined);
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
