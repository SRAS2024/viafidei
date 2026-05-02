import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { searchAll } from "@/lib/data/search";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`search:${ip}`, RATE_POLICIES.search, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q)
    return jsonOk({
      q: "",
      hits: {
        prayers: [],
        saints: [],
        apparitions: [],
        parishes: [],
        devotions: [],
        liturgy: [],
        spiritualLife: [],
      },
    });

  const hits = await searchAll(q);
  const totals = {
    prayers: hits.prayers.length,
    saints: hits.saints.length,
    apparitions: hits.apparitions.length,
    parishes: hits.parishes.length,
    devotions: hits.devotions.length,
    liturgy: hits.liturgy.length,
    spiritualLife: hits.spiritualLife.length,
  };
  return jsonOk({ q, hits, totals });
}
