import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { suggest } from "@/lib/data/search";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`suggest:${ip}`, RATE_POLICIES.search, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const suggestions = await suggest(q);
  return jsonOk({ q, suggestions });
}
