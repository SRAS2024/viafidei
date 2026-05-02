import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { getPublishedPrayerBySlug } from "@/lib/data/prayers";
import { getLocale } from "@/lib/i18n/server";
import { isSaved } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:prayer:${ip}`, RATE_POLICIES.publicRead, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const locale = await getLocale();
  const prayer = await getPublishedPrayerBySlug(params.slug, locale);
  if (!prayer) return jsonError("not_found");

  const user = await requireUser();
  const saved = user ? await isSaved("prayer", user.id, prayer.id) : false;
  return jsonOk({ prayer, locale, saved });
}
