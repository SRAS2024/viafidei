/**
 * Daily readings + reporting skill pack. Real wrappers over safe site
 * administration: refresh + verify daily readings, and generate the Developer
 * Audit / monthly reports + diagnostics.
 */

import { refreshDailyReadings, backfillDailyReadings } from "../daily-readings";
import { runAdminWorkerDiagnostics } from "../diagnostics";
import { generateAdminWorkerDeveloperAuditPdf, generateMonthlyAdminWorkerReportPdf } from "../pdf";
import { makeOpSkill } from "./skill-helpers";
import type { CertifiedSkill } from "./types";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export const readingsReportingSkills: CertifiedSkill[] = [
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
      // The column is `DateTime @db.Date`: look it up by the compound unique
      // with a Date at UTC midnight, the way every other caller does. A query
      // error must be reported as an error, not as "no readings for today".
      const now = new Date();
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const iso = date.toISOString().slice(0, 10);
      const row = await ctx.prisma.dailyReading
        .findUnique({
          where: { date_calendar_locale: { date, calendar: "roman-ordinary", locale: "en" } },
          select: { id: true, status: true },
        })
        .catch((err: unknown) => ({
          error: err instanceof Error ? err.message : String(err),
        }));
      if (row && "error" in row) {
        return { ok: false, detail: `daily readings lookup failed: ${row.error}` };
      }
      return {
        ok: row != null,
        detail: row ? `today present (${row.status})` : `no readings row for ${iso}`,
      };
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
