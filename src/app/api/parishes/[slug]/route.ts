import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { getPublishedParishBySlug } from "@/lib/data/parishes";
import { isSaved } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:parish:${ip}`, RATE_POLICIES.publicRead, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const parish = await getPublishedParishBySlug(params.slug);
  if (!parish) return jsonError("not_found");

  const user = await requireUser();
  const saved = user ? await isSaved("parish", user.id, parish.id) : false;
  return jsonOk({ parish, saved });
}
