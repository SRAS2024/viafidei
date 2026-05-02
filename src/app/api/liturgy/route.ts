import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { listPublishedLiturgyEntries } from "@/lib/data/liturgy";
import { getLocale } from "@/lib/i18n/server";
import type { LiturgyKind } from "@prisma/client";

const KINDS: LiturgyKind[] = [
  "MASS_STRUCTURE",
  "LITURGICAL_YEAR",
  "SYMBOLISM",
  "MARRIAGE_RITE",
  "FUNERAL_RITE",
  "ORDINATION_RITE",
  "COUNCIL_TIMELINE",
  "GLOSSARY",
  "GENERAL",
];

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:liturgy:${ip}`, RATE_POLICIES.publicRead, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const url = new URL(req.url);
  const kindParam = url.searchParams.get("kind");
  const kind = KINDS.includes(kindParam as LiturgyKind) ? (kindParam as LiturgyKind) : undefined;
  const locale = await getLocale();
  const items = await listPublishedLiturgyEntries(locale, kind);
  return jsonOk({ items, locale });
}
