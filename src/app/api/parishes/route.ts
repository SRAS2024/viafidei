import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { findPublishedParishes } from "@/lib/data/parishes";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:parishes:${ip}`, RATE_POLICIES.publicRead, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const url = new URL(req.url);
  const items = await findPublishedParishes(
    {
      q: url.searchParams.get("q")?.trim() || undefined,
      city: url.searchParams.get("city")?.trim() || undefined,
      region: url.searchParams.get("region")?.trim() || undefined,
      country: url.searchParams.get("country")?.trim() || undefined,
    },
    Math.min(Number(url.searchParams.get("take")) || 40, 200),
  );
  return jsonOk({ items });
}
