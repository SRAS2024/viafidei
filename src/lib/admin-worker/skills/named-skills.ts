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
      "Ensure published prayers carry their Latin/Greek liturgical text; flag any missing for a curator (sacred texts are never machine-translated).",
    category: "MAINTENANCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const prayers = await ctx.prisma.publishedContent
        .findMany({
          where: { contentType: "PRAYER" as never, isPublished: true },
          select: { slug: true, title: true, payload: true },
        })
        .catch(() => [] as Array<{ slug: string; title: string; payload: unknown }>);
      const missing = prayers.filter((p) => {
        const pl = (p.payload ?? {}) as Record<string, unknown>;
        const has = (v: unknown) => typeof v === "string" && v.trim().length > 0;
        return !(has(pl.latin) || has(pl.greek));
      });
      if (missing.length > 0) {
        const fingerprint = "missing-prayer-translations";
        await ctx.prisma.adminWorkerDeveloperRequest
          .upsert({
            where: { fingerprint },
            create: {
              kind: "content",
              title: `${missing.length} prayer(s) need a curated Latin/Greek translation`,
              detail: `These published prayers have no Latin or Greek text for the language toggle (a curator must add the exact liturgical text — sacred texts are never machine-translated): ${missing
                .slice(0, 40)
                .map((p) => p.slug)
                .join(", ")}.`,
              severity: "medium",
              status: "OPEN",
              source: "skill-runtime",
              fingerprint,
              metadata: { missingSlugs: missing.map((p) => p.slug) },
            },
            update: {
              detail: `${missing.length} prayer(s) still need a curated Latin/Greek translation.`,
              occurrences: { increment: 1 },
            },
          })
          .catch(() => undefined);
      }
      const covered = prayers.length - missing.length;
      return {
        ok: true,
        detail: `${covered}/${prayers.length} prayers have a Latin/Greek translation${missing.length ? `; flagged ${missing.length} for a curator` : ""}`,
      };
    },
  }),
];
