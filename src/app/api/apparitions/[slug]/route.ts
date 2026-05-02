import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { getPublishedApparitionBySlug } from "@/lib/data/apparitions";
import { getLocale } from "@/lib/i18n/server";
import { isSaved } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:apparition:${ip}`, RATE_POLICIES.publicRead, {
    ipAddress: ip,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const locale = await getLocale();
  const apparition = await getPublishedApparitionBySlug(params.slug, locale);
  if (!apparition) return jsonError("not_found");

  const user = await requireUser();
  const saved = user ? await isSaved("apparition", user.id, apparition.id) : false;
  return jsonOk({ apparition, locale, saved });
}
