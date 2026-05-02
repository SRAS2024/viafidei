import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { getPublishedSaintBySlug } from "@/lib/data/saints";
import { getLocale } from "@/lib/i18n/server";
import { isSaved } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:saint:${ip}`, RATE_POLICIES.publicRead, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const locale = await getLocale();
  const saint = await getPublishedSaintBySlug(params.slug, locale);
  if (!saint) return jsonError("not_found");

  const user = await requireUser();
  const saved = user ? await isSaved("saint", user.id, saint.id) : false;
  return jsonOk({ saint, locale, saved });
}
