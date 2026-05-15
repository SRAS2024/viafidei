import { type NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/http";
import { listSaintsForFeastDate } from "@/lib/data/saints";
import { getTranslator } from "@/lib/i18n/server";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

/**
 * Returns saints whose feast day matches the user-supplied calendar
 * date (typically the user's local date, computed in the browser from
 * `new Date()`, so the result respects whatever timezone the user is
 * physically in). Falls back to today-UTC when no params are passed.
 *
 * Response shape (success):
 *   {
 *     month, day, total,
 *     items: [{ slug, name, biography, patronages, feastDay }]
 *   }
 *
 * When zero saints match the date, the response is still HTTP 200
 * (the homepage panel treats an empty list as a normal state) but
 * carries a `diagnostic` object so the admin diagnostics page can
 * explain *why* — whether there are no PUBLISHED saints at all,
 * none with structured feast fields, or just none for today.
 *
 * The optional `take` param caps the response (used by the homepage,
 * which only shows five). The full /saints/today page does not cap.
 */
export async function GET(req: NextRequest) {
  const { locale } = await getTranslator();
  const url = new URL(req.url);
  const now = new Date();
  const month = Number(url.searchParams.get("month") ?? now.getUTCMonth() + 1);
  const day = Number(url.searchParams.get("day") ?? now.getUTCDate());
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 0), 0), 50);
  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return jsonError("invalid");
  }

  let all: Awaited<ReturnType<typeof listSaintsForFeastDate>> = [];
  try {
    all = await listSaintsForFeastDate(locale, month, day);
  } catch (err) {
    logger.error("saints.today.query_failed", {
      route: "/api/saints/today",
      errorMessage: err instanceof Error ? err.message : String(err),
      month,
      day,
    });
    return jsonOk({
      month,
      day,
      total: 0,
      items: [],
      diagnostic: {
        kind: "query_failed",
        detail:
          "The saints query failed. Run /admin/diagnostics/saints to see the underlying error.",
      },
    });
  }

  const items = (take > 0 ? all.slice(0, take) : all).map((s) => {
    const tr = s.translations[0];
    return {
      slug: s.slug,
      name: tr?.name ?? s.canonicalName,
      biography: tr?.biography ?? s.biography,
      patronages: s.patronages,
      feastDay: s.feastDay,
    };
  });

  if (items.length === 0) {
    // Run a cheap second-tier diagnostic so the homepage panel and the
    // admin Diagnostics page both have a precise explanation of why
    // the list is empty. The numbers are also safe to expose to
    // unauthenticated callers — they are public catalog totals.
    const [publishedSaintsTotal, structuredTotal] = await Promise.all([
      prisma.saint.count({ where: { status: "PUBLISHED" } }).catch(() => 0),
      prisma.saint
        .count({
          where: {
            status: "PUBLISHED",
            feastMonth: { not: null },
            feastDayOfMonth: { not: null },
          },
        })
        .catch(() => 0),
    ]);
    let kind: "empty_catalog" | "no_structured_fields" | "no_match_for_date";
    let detail: string;
    if (publishedSaintsTotal === 0) {
      kind = "empty_catalog";
      detail =
        "There are no PUBLISHED saints in the catalog yet. Seed the database or publish drafts in /admin/saints.";
    } else if (structuredTotal === 0) {
      kind = "no_structured_fields";
      detail =
        "Saints exist but none have structured feast fields. Apply migration 0009_saint_feast_month_day to backfill them.";
    } else {
      kind = "no_match_for_date";
      detail = `No saints match ${month}/${day} in the published catalog.`;
    }
    return jsonOk({
      month,
      day,
      total: 0,
      items: [],
      diagnostic: { kind, detail },
    });
  }

  return jsonOk({ month, day, total: all.length, items });
}
