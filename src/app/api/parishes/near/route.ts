import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { findParishesNear } from "@/lib/data/parishes";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:parishes-near:${ip}`, RATE_POLICIES.publicRead, {
    ipAddress: ip,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const radiusKm = Math.min(Math.max(Number(url.searchParams.get("radiusKm")) || 25, 1), 250);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return jsonError("invalid");

  const items = await findParishesNear(lat, lon, radiusKm, 40);
  return jsonOk({ items, radiusKm });
}
