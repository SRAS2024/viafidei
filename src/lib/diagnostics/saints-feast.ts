import { prisma } from "@/lib/db/client";
import { listSaintsForFeastDate } from "@/lib/data/saints";
import {
  finalizeSection,
  runDiagnostic,
  startSection,
  type DiagnosticResult,
  type DiagnosticSection,
} from "./types";

/**
 * Homepage saints feast-day diagnostics — answers the questions an
 * admin asks when the "Today's Feast Day Saints" panel on / renders
 * empty:
 *
 *   • Are there any PUBLISHED saints in the catalog at all?
 *   • Do they have structured feast fields populated (feastMonth /
 *     feastDayOfMonth)?
 *   • Does today's date specifically return a saint via
 *     `listSaintsForFeastDate`?
 *
 * Every check returns a pass / warn / fail severity, a timestamp, and
 * an explanation of how to remediate.
 */
export async function runSaintsFeastDiagnostics(
  /** Defaults to the current UTC date; tests can pin a specific date. */
  today: Date = new Date(),
): Promise<DiagnosticSection> {
  const shell = startSection("saints_feast", "Homepage — Today's Feast Day Saints");
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const results: DiagnosticResult[] = [];

  results.push(
    await runDiagnostic(
      "saints_feast.published_count",
      "Saints in PUBLISHED status",
      shell.requestId,
      async () => {
        const total = await prisma.saint.count({ where: { status: "PUBLISHED" } });
        if (total === 0) {
          return {
            severity: "fail",
            summary: "No saints are PUBLISHED.",
            explanation:
              "The seeder may not have run, or every saint sits in DRAFT/REVIEW. Visit /admin/publish-list to triage.",
            evidence: { total },
          };
        }
        return {
          severity: total < 50 ? "warn" : "pass",
          summary: `${total} saints PUBLISHED.`,
          evidence: { total },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "saints_feast.structured_fields_coverage",
      "Saints with structured feast fields",
      shell.requestId,
      async () => {
        const [total, withStructured, withLegacy] = await Promise.all([
          prisma.saint.count({ where: { status: "PUBLISHED" } }),
          prisma.saint.count({
            where: {
              status: "PUBLISHED",
              feastMonth: { not: null },
              feastDayOfMonth: { not: null },
            },
          }),
          prisma.saint.count({
            where: {
              status: "PUBLISHED",
              feastDay: { not: null },
              OR: [{ feastMonth: null }, { feastDayOfMonth: null }],
            },
          }),
        ]);
        if (total === 0) {
          return {
            severity: "pass",
            summary: "No saints in the catalog yet — nothing to check.",
            evidence: { total, withStructured, withLegacy },
          };
        }
        const pct = total === 0 ? 0 : Math.round((withStructured / total) * 100);
        if (withStructured === 0) {
          return {
            severity: "fail",
            summary: `0 of ${total} saints have structured feast fields.`,
            explanation:
              "Run `prisma migrate deploy` to apply migration 0009_saint_feast_month_day, which backfills feastMonth/feastDayOfMonth from the legacy text.",
            evidence: { total, withStructured, withLegacy, percent: pct },
          };
        }
        return {
          severity: withLegacy > 0 ? "warn" : "pass",
          summary: `${withStructured} of ${total} saints (${pct}%) have structured feast fields.`,
          explanation:
            withLegacy > 0
              ? `${withLegacy} saints still rely on legacy freeform feastDay text. Re-save them via /admin/saints to populate the structured fields.`
              : undefined,
          evidence: { total, withStructured, withLegacy, percent: pct },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "saints_feast.today_match",
      `Saints for today (${month}/${day})`,
      shell.requestId,
      async () => {
        const matches = await listSaintsForFeastDate("en", month, day);
        if (matches.length === 0) {
          return {
            severity: "warn",
            summary: `No saints match today's date (${month}/${day}).`,
            explanation:
              "Either the catalog has no rows for this calendar day, or every match is in DRAFT/REVIEW. Browse /admin/saints to add or publish one.",
            evidence: { month, day, total: 0 },
          };
        }
        return {
          severity: "pass",
          summary: `${matches.length} saint${matches.length === 1 ? "" : "s"} match today's date.`,
          evidence: {
            month,
            day,
            total: matches.length,
            firstSlug: matches[0]?.slug ?? null,
          },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "saints_feast.api_route",
      `/api/saints/today returns a result`,
      shell.requestId,
      async () => {
        // Probe the same code path the homepage uses, so any change to
        // status filtering / locale handling surfaces here. We call the
        // data helper directly (avoid HTTP self-call latency) but with
        // the same arguments the route handler would pass.
        const matches = await listSaintsForFeastDate("en", month, day);
        const total = matches.length;
        const published = matches.every((m) => m.status === "PUBLISHED");
        if (total === 0) {
          return {
            severity: "warn",
            summary: "API returns 0 saints for today.",
            explanation:
              "Homepage will fall back to the 'no saints in our catalog match today's feast' empty state. Add a saint with today's feast or set feastMonth/feastDayOfMonth on an existing one.",
            evidence: { total, month, day },
          };
        }
        return {
          severity: published ? "pass" : "warn",
          summary: `API returns ${total} saint${total === 1 ? "" : "s"} for today.`,
          evidence: { total, month, day, allPublished: published },
        };
      },
    ),
  );

  return finalizeSection(shell, results);
}
