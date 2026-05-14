import { type NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/http";
import { listSaintsForFeastDate } from "@/lib/data/saints";
import { getTranslator } from "@/lib/i18n/server";

export const runtime = "nodejs";

/**
 * Returns saints whose feast day matches the user-supplied calendar
 * date (typically the user's local date, computed in the browser from
 * `new Date()`, so the result respects whatever timezone the user is
 * physically in). Falls back to today-UTC when no params are passed.
 *
 * Response shape:
 *   {
 *     month, day, total,
 *     items: [{ slug, name, biography, patronages, feastDay }]
 *   }
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
  const take = Math.min(
    Math.max(Number(url.searchParams.get("take") ?? 0), 0),
    50,
  );
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

  const all = await listSaintsForFeastDate(locale, month, day);
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

  return jsonOk({ month, day, total: all.length, items });
}
