import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { getPublishedSpiritualLifeGuideBySlug } from "@/lib/data/spiritual-life";
import { getLocale } from "@/lib/i18n/server";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:spiritual-detail:${ip}`, RATE_POLICIES.publicRead, {
    ipAddress: ip,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const locale = await getLocale();
  const guide = await getPublishedSpiritualLifeGuideBySlug(params.slug, locale);
  if (!guide) return jsonError("not_found");
  return jsonOk({ guide, locale });
}
