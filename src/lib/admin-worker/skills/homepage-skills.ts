/**
 * Homepage + reporting skill pack. Real wrappers over safe site administration:
 * create a homepage makeover draft (review-gated: preview → publish → discard),
 * refresh + verify daily readings, and generate the Developer Audit / monthly
 * reports + diagnostics. Homepage changes only ever produce an AWAITING_REVIEW
 * draft — the live homepage is never mutated autonomously.
 */

import { redesignHomepage } from "../homepage-mutator";
import { refreshDailyReadings, backfillDailyReadings } from "../daily-readings";
import { runAdminWorkerDiagnostics } from "../diagnostics";
import { generateAdminWorkerDeveloperAuditPdf, generateMonthlyAdminWorkerReportPdf } from "../pdf";
import { makeOpSkill } from "./skill-helpers";
import type { CertifiedSkill, SkillContext } from "./types";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export const homepageSkills: CertifiedSkill[] = [
  makeOpSkill({
    name: "create_homepage_draft",
    purpose:
      "Run a homepage makeover and file an AWAITING_REVIEW draft to preview, publish, or discard. Never mutates the live homepage.",
    category: "HOMEPAGE",
    riskLevel: "low",
    brainOps: ["analyze_ui"],
    successMetrics: ["draft_filed"],
    run: async (ctx: SkillContext) => {
      const result = (await redesignHomepage(ctx.prisma, {
        passId: ctx.passId ?? undefined,
        mode: "ADMIN_REQUESTED",
        force: true,
      })) as { draftId?: string; filed?: boolean; draft?: { id?: string } };
      const id = result.draftId ?? result.draft?.id ?? null;
      return {
        ok: Boolean(result.filed ?? id),
        detail: id ? `draft ${id} filed for review` : "no draft filed",
        outputEntityType: "HomepageWorkerDraft",
        outputEntityId: id,
      };
    },
  }),
  makeOpSkill({
    name: "verify_homepage_render",
    purpose: "Confirm the homepage record exists and has renderable blocks.",
    category: "HOMEPAGE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const hp = await ctx.prisma.homePage
        .findUnique({ where: { slug: "homepage" }, include: { blocks: true } })
        .catch(() => null);
      const ok = hp != null && hp.blocks.length > 0;
      return { ok, detail: ok ? `${hp!.blocks.length} blocks` : "no homepage blocks" };
    },
  }),
  makeOpSkill({
    name: "refresh_homepage_featured_content",
    purpose: "Re-derive the homepage featured rails from currently-published content (if needed).",
    category: "HOMEPAGE",
    run: async (ctx) => {
      const result = (await redesignHomepage(ctx.prisma, {
        passId: ctx.passId ?? undefined,
        mode: "AUTOMATIC_SMALL",
      }).catch(() => null)) as { filed?: boolean } | null;
      return { ok: result != null, detail: result?.filed ? "draft filed" : "no change needed" };
    },
  }),
  makeOpSkill({
    name: "refresh_daily_readings",
    purpose: "Refresh today's daily Mass readings from the liturgical calendar + lectionary.",
    category: "HOMEPAGE",
    allowedInSafeDegradedMode: true,
    successMetrics: ["readings_current"],
    run: async (ctx) => {
      await refreshDailyReadings(ctx.prisma, { passId: ctx.passId ?? undefined });
      return { ok: true, detail: "daily readings refreshed" };
    },
  }),
  makeOpSkill({
    name: "backfill_daily_readings",
    purpose: "Fill + re-verify the rolling forward window of daily readings.",
    category: "HOMEPAGE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      await backfillDailyReadings(ctx.prisma, { passId: ctx.passId ?? undefined });
      return { ok: true, detail: "daily readings window backfilled" };
    },
  }),
  makeOpSkill({
    name: "verify_daily_readings_page",
    purpose: "Confirm today's daily readings row exists.",
    category: "HOMEPAGE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const today = new Date().toISOString().slice(0, 10);
      const row = await ctx.prisma.dailyReading
        .findFirst({ where: { date: today }, select: { id: true } })
        .catch(() => null);
      return { ok: row != null, detail: row ? "today present" : `no readings for ${today}` };
    },
  }),
  makeOpSkill({
    name: "generate_developer_report",
    purpose: "Generate the Developer Audit PDF for the last 24 hours.",
    category: "REPORTING",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const out = await generateAdminWorkerDeveloperAuditPdf(
        ctx.prisma,
        "LAST_24_HOURS",
        "skill-runtime",
      );
      return {
        ok: Boolean(out.reportLogId),
        detail: `report ${out.reportLogId}`,
        outputEntityType: "AdminDeveloperReportLog",
        outputEntityId: out.reportLogId,
      };
    },
  }),
  makeOpSkill({
    name: "generate_monthly_report",
    purpose: "Generate the monthly Admin Worker operations report PDF.",
    category: "REPORTING",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const now = new Date();
      const pdf = await generateMonthlyAdminWorkerReportPdf(ctx.prisma, startOfMonth(now), now);
      return { ok: pdf.length > 100, detail: `${pdf.length} bytes` };
    },
  }),
  makeOpSkill({
    name: "run_diagnostics",
    purpose: "Run the Admin Worker subsystem diagnostics.",
    category: "REPORTING",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const ratings = await runAdminWorkerDiagnostics(ctx.prisma);
      return {
        ok: Array.isArray(ratings) && ratings.length > 0,
        detail: `${ratings.length} ratings`,
      };
    },
  }),
];
