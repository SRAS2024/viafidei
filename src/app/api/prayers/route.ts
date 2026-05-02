import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { listPublishedPrayers, searchPrayers } from "@/lib/data/prayers";
import { getLocale } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:prayers:${ip}`, RATE_POLICIES.publicRead, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const take = Math.min(Number(url.searchParams.get("take")) || 60, 200);
  const locale = await getLocale();
  const items = q ? await searchPrayers(q, take) : await listPublishedPrayers(locale, take);
  return jsonOk({ items, locale });
}
