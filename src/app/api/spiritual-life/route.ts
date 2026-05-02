import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { listPublishedSpiritualLifeGuides } from "@/lib/data/spiritual-life";
import { getLocale } from "@/lib/i18n/server";
import type { SpiritualLifeKind } from "@prisma/client";

const KINDS: SpiritualLifeKind[] = [
  "ROSARY",
  "CONFESSION",
  "ADORATION",
  "DEVOTION",
  "CONSECRATION",
  "VOCATION",
  "GENERAL",
];

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:spiritual:${ip}`, RATE_POLICIES.publicRead, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const url = new URL(req.url);
  const kindParam = url.searchParams.get("kind");
  const kind = KINDS.includes(kindParam as SpiritualLifeKind)
    ? (kindParam as SpiritualLifeKind)
    : undefined;
  const locale = await getLocale();
  const items = await listPublishedSpiritualLifeGuides(locale, kind);
  return jsonOk({ items, locale });
}
