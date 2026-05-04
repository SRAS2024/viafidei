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
  // The client sends `limit` to scope the per-group cap (2 on mobile,
  // 3 on tablet/desktop). Bound it server-side so a malicious caller can't
  // pass a huge number and pull a giant payload.
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const perGroup = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 6) : 3;
  const suggestions = await suggest(q, perGroup);
  return jsonOk({ q, suggestions });
}
