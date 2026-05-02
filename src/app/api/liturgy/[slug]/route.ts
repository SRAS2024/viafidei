import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { getPublishedLiturgyBySlug } from "@/lib/data/liturgy";
import { getLocale } from "@/lib/i18n/server";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:liturgy-detail:${ip}`, RATE_POLICIES.publicRead, {
    ipAddress: ip,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const locale = await getLocale();
  const entry = await getPublishedLiturgyBySlug(params.slug, locale);
  if (!entry) return jsonError("not_found");
  return jsonOk({ entry, locale });
}
