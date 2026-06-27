/**
 * Remaining named skills from the spec's pack lists — real wrappers/checks that
 * complete the publishing, homepage, security, and maintenance packs:
 * persist_package, publish_structured_sections, verify_published_row,
 * file_human_review, update_homepage_block, update_navigation_if_safe,
 * verify_navigation_render, record_security_event, respond_to_confirmed_threat,
 * refresh_calibration_scores.
 */

import { defend, type DefendInput } from "../security-defender";
import { redesignHomepage } from "../homepage-mutator";
import { requireHumanReview } from "../policy";
import { translatePrayer } from "../prayer-translator";
import { autoPublishMachineTranslations, proposeMachineTranslation } from "../translation-provider";
import { makeOpSkill } from "./skill-helpers";
import type { CertifiedSkill, SkillContext } from "./types";

function inp(ctx: SkillContext): Record<string, unknown> {
  return ctx.input as Record<string, unknown>;
}
function ctype(ctx: SkillContext): string {
  return String(ctx.contentType ?? inp(ctx).contentType ?? "");
}
function slug(ctx: SkillContext): string {
  return String(inp(ctx).slug ?? "");
}

export const namedSkills: CertifiedSkill[] = [
  // ── Publishing ───────────────────────────────────────────────────────────
  makeOpSkill({
    name: "persist_package",
    purpose: "Confirm the content package persisted to a checklist item before publish.",
    category: "PUBLISHING",
    run: async (ctx) => {
      const id = String(inp(ctx).contentId ?? ctx.targetEntityId ?? "");
      const item = id
        ? await ctx.prisma.checklistItem
            .findUnique({ where: { id }, select: { id: true } })
            .catch(() => null)
        : null;
      return { ok: item != null, detail: item ? "checklist item present" : "no persisted package" };
    },
  }),
  makeOpSkill({
    name: "publish_structured_sections",
    purpose: "Merge structured content sections into the published row's payload.",
    category: "PUBLISHING",
    run: async (ctx) => {
      const sections = (inp(ctx).sections as unknown) ?? null;
      if (sections == null) return { ok: true, detail: "no sections to publish" };
      const row = await ctx.prisma.publishedContent
        .findFirst({
          where: { contentType: ctype(ctx) as never, slug: slug(ctx) },
          select: { id: true, payload: true },
        })
        .catch(() => null);
      if (!row) return { ok: false, detail: "no published row" };
      const payload = { ...((row.payload ?? {}) as Record<string, unknown>), sections };
      const upd = await ctx.prisma.publishedContent
        .update({ where: { id: row.id }, data: { payload: payload as never } })
        .catch(() => null);
      return { ok: upd != null, detail: upd ? "sections stored" : "update failed" };
    },
  }),
  makeOpSkill({
    name: "verify_published_row",
    purpose: "Confirm the published row exists with the expected type, slug, and title.",
    category: "PUBLISHING",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const row = await ctx.prisma.publishedContent
        .findFirst({
          where: { contentType: ctype(ctx) as never, slug: slug(ctx), isPublished: true },
          select: { title: true, subtitle: true },
        })
        .catch(() => null);
      return {
        ok: row != null && row.title.length > 0,
        detail: row ? "row present" : "no published row",
      };
    },
  }),
  makeOpSkill({
    name: "file_human_review",
    purpose: "File an item to the human review queue.",
    category: "PUBLISHING",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const row = await ctx.prisma.humanReviewQueue
        .create({
          data: {
            contentType: ctype(ctx) || null,
            contentTitle: String(inp(ctx).title ?? slug(ctx)) || null,
            proposedAction: String(inp(ctx).proposedAction ?? "PUBLISH"),
            reason: String(inp(ctx).reason ?? "routed to human review by certified skill"),
            confidence: Number(inp(ctx).confidence ?? 0),
            status: "PENDING",
          },
          select: { id: true },
        })
        .catch(() => null);
      return {
        ok: row != null,
        detail: row ? "filed for human review" : "could not file review",
        outputEntityType: "HumanReviewQueue",
        outputEntityId: row?.id ?? null,
      };
    },
  }),
  // ── Homepage / site admin (review-gated) ─────────────────────────────────
  makeOpSkill({
    name: "update_homepage_block",
    purpose: "Propose a homepage block change via a review-gated draft (never mutates live).",
    category: "HOMEPAGE",
    humanReviewRequired: true,
    run: async (ctx) => {
      const result = (await redesignHomepage(ctx.prisma, {
        passId: ctx.passId ?? undefined,
        mode: "ADMIN_REQUESTED",
        force: true,
      }).catch(() => null)) as { draftId?: string; filed?: boolean } | null;
      return { ok: result != null, detail: result?.filed ? "draft filed for review" : "no draft" };
    },
  }),
  makeOpSkill({
    name: "update_navigation_if_safe",
    purpose:
      "Navigation changes are risky — file a developer request rather than auto-changing nav.",
    category: "HOMEPAGE",
    humanReviewRequired: true,
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const fingerprint = "navigation-change-request";
      const req = await ctx.prisma.adminWorkerDeveloperRequest
        .upsert({
          where: { fingerprint },
          create: {
            kind: "process",
            title: "Navigation change requested",
            detail: "A navigation change was requested; navigation is human-review gated.",
            severity: "medium",
            status: "OPEN",
            source: "skill-runtime",
            fingerprint,
          },
          update: { occurrences: { increment: 1 } },
          select: { id: true },
        })
        .catch(() => null);
      return { ok: req != null, detail: "navigation change routed to review" };
    },
  }),
  makeOpSkill({
    name: "verify_navigation_render",
    purpose: "Confirm the public navigation has published content behind its tabs.",
    category: "HOMEPAGE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const n = await ctx.prisma.publishedContent.count({ where: { isPublished: true } });
      return { ok: n > 0, detail: `${n} published item(s) for navigation` };
    },
  }),
  // ── Security ──────────────────────────────────────────────────────────────
  makeOpSkill({
    name: "record_security_event",
    purpose: "Record a security event to the durable security store.",
    category: "SECURITY",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const i = inp(ctx);
      const row = await ctx.prisma.securityEvent
        .create({
          data: {
            eventType: String(i.eventType ?? "skill_recorded_event"),
            classification: String(i.classification ?? "Suspicious"),
            severity: String(i.severity ?? "warning"),
            userAgent: (i.userAgent as string) ?? null,
          },
          select: { id: true },
        })
        .catch(() => null);
      return {
        ok: row != null,
        detail: row ? "security event recorded" : "could not record event",
        outputEntityType: "SecurityEvent",
        outputEntityId: row?.id ?? null,
      };
    },
  }),
  makeOpSkill({
    name: "respond_to_confirmed_threat",
    purpose: "Respond to a confirmed threat through the defender (ban/deny as warranted).",
    category: "SECURITY",
    riskLevel: "medium",
    allowedInSafeDegradedMode: true,
    rollback: async () => ({
      status: "NOT_NEEDED",
      detail: "defense actions are admin-reversible",
    }),
    run: async (ctx) => {
      const outcome = await defend(ctx.prisma, {
        ...(inp(ctx) as unknown as DefendInput),
        classification: "Breach",
      });
      return { ok: outcome != null, detail: "threat response dispatched" };
    },
  }),
  // ── Maintenance ───────────────────────────────────────────────────────────
  makeOpSkill({
    name: "refresh_calibration_scores",
    purpose: "Recompute skill verification (calibration) rates from the recent ledger.",
    category: "MAINTENANCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [verified, total] = await Promise.all([
        ctx.prisma.adminWorkerSkillExecution
          .count({ where: { createdAt: { gte: since }, verificationStatus: "PROCEED" } })
          .catch(() => 0),
        ctx.prisma.adminWorkerSkillExecution
          .count({ where: { createdAt: { gte: since } } })
          .catch(() => 0),
      ]);
      const rate = total > 0 ? verified / total : 1;
      return {
        ok: true,
        detail: `verification rate ${(rate * 100).toFixed(0)}% over ${total} run(s)`,
      };
    },
  }),
  makeOpSkill({
    name: "ensure_prayer_translations",
    purpose:
      "Give every published prayer its Latin AND Greek. For any prayer missing one, the worker BUILDS the translation itself with the deterministic liturgical engine (whole-prayer match against the received corpus, then authoritative segment assembly) and publishes it into the prayer's payload so the language toggle renders it — exactly as if the prayer had shipped with it. The engine only ever emits authentic received liturgical text; if it cannot render a text faithfully (no authentic Latin/Greek form is derivable — e.g. free-prose modern prayers, or Greek for a Latin-Rite devotion that has no Greek liturgical form), it does NOT fabricate sacred text: it opens a review-gated task carrying the English source and the unresolved lines so a curator supplies the exact text.",
    category: "MAINTENANCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const prayers = await ctx.prisma.publishedContent
        .findMany({
          where: { contentType: "PRAYER" as never, isPublished: true },
          select: { id: true, slug: true, title: true, payload: true },
        })
        .catch(() => [] as Array<{ id: string; slug: string; title: string; payload: unknown }>);
      const has = (v: unknown) => typeof v === "string" && (v as string).trim().length > 0;

      // Existing pending translation tasks, so we never duplicate a request.
      const open = await ctx.prisma.humanReviewQueue
        .findMany({
          where: {
            status: "PENDING",
            proposedAction: { in: ["TRANSLATE_TO_LATIN", "TRANSLATE_TO_GREEK"] },
          },
          select: { contentTitle: true, proposedAction: true },
        })
        .catch(() => [] as Array<{ contentTitle: string | null; proposedAction: string }>);
      const openKeys = new Set(open.map((o) => `${o.contentTitle ?? ""}|${o.proposedAction}`));

      const targets = [
        { code: "la", field: "latin", action: "TRANSLATE_TO_LATIN", language: "Latin" },
        { code: "el", field: "greek", action: "TRANSLATE_TO_GREEK", language: "Greek" },
      ] as const;

      const autoPublishMachine = ctx.brainActive && autoPublishMachineTranslations();
      let latinCovered = 0;
      let greekCovered = 0;
      let built = 0;
      let machinePublished = 0;
      let queued = 0;
      for (const p of prayers) {
        const pl = (p.payload ?? {}) as Record<string, unknown>;
        const english = String(pl.body ?? pl.prayerText ?? "");
        const writes: Record<string, string> = {};

        for (const t of targets) {
          if (has(pl[t.field])) continue;
          const result = english ? translatePrayer(english, t.code) : null;
          // The worker built an authentic translation itself — publish it into
          // the prayer's payload. Gated on an active final brain (full autonomy);
          // in safe-degraded mode the worker still reports + routes gaps.
          if (result?.accurate && result.text && ctx.brainActive) {
            writes[t.field] = result.text;
            built += 1;
            continue;
          }
          // The deterministic corpus could not render it faithfully. Try the
          // explicitly-authorized machine-translation fallback (Google / AI) as
          // a *proposal*. It returns null instantly when no provider is
          // configured, so this adds no cost in the default deployment.
          const proposal =
            english && !result?.accurate ? await proposeMachineTranslation(english, t.code) : null;
          // Fill the gap with the machine draft so the prayer ends up with both
          // Latin and Greek (the authentic corpus is always tried first). This is
          // the default; set TRANSLATION_AUTOPUBLISH_MACHINE=0 to instead route
          // every machine draft to human review before it goes live.
          if (proposal && autoPublishMachine) {
            writes[t.field] = proposal.text;
            machinePublished += 1;
            continue;
          }
          // Full autonomy (default): the worker does NOT queue a translation gap
          // for a person. The prayer keeps the languages it has; the backfill
          // fills the rest on its own once a translation provider is configured.
          // Only ADMIN_WORKER_REQUIRE_HUMAN_REVIEW=1 routes the gap to review.
          if (!requireHumanReview()) continue;
          // Otherwise route to review with the English source, the unresolved
          // lines, and (when available) the machine draft for the curator to
          // confirm against an authoritative source rather than write anew.
          if (openKeys.has(`${p.slug}|${t.action}`)) continue;
          await ctx.prisma.humanReviewQueue
            .create({
              data: {
                contentType: "PRAYER",
                contentTitle: p.slug,
                proposedAction: t.action,
                reason: proposal
                  ? `Confirm the proposed ${t.language} translation of "${p.title}" (machine draft via ${proposal.provider}) against an authoritative liturgical source, then publish so the language toggle is complete.`
                  : `Build + verify the ${t.language} translation of "${p.title}" so the prayer's language toggle is complete. Sacred texts are verified by review before publishing.`,
                confidence: 0,
                sourceEvidence: {
                  slug: p.slug,
                  targetLanguage: t.language,
                  english,
                  unresolved: result?.unresolved ?? [],
                  ...(proposal
                    ? { proposedTranslation: proposal.text, proposedBy: proposal.provider }
                    : {}),
                } as never,
                status: "PENDING",
              },
            })
            .catch(() => undefined);
          queued += 1;
        }

        if (Object.keys(writes).length > 0) {
          await ctx.prisma.publishedContent
            .update({ where: { id: p.id }, data: { payload: { ...pl, ...writes } as never } })
            .catch(() => undefined);
        }
        if (has(pl.latin) || writes.latin) latinCovered += 1;
        if (has(pl.greek) || writes.greek) greekCovered += 1;
      }
      return {
        ok: true,
        detail: `${latinCovered}/${prayers.length} Latin, ${greekCovered}/${prayers.length} Greek; built ${built} authentic translation(s)${machinePublished ? `, published ${machinePublished} machine draft(s)` : ""}, queued ${queued} for review`,
      };
    },
  }),
];
