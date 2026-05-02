import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { getDailyLiturgyForDate, listDailyLiturgyRange } from "@/lib/data/daily-liturgy";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:daily:${ip}`, RATE_POLICIES.publicRead, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  if (fromParam && toParam) {
    const from = new Date(fromParam);
    const to = new Date(toParam);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return jsonError("invalid");
    const items = await listDailyLiturgyRange(from, to);
    return jsonOk({ items });
  }

  const date = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(date.getTime())) return jsonError("invalid");
  const item = await getDailyLiturgyForDate(date);
  if (!item) return jsonError("not_found");
  return jsonOk({ item });
}
