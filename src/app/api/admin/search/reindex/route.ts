import { type NextRequest } from "next/server";
import { requireAdmin, pruneExpiredTokens } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { appConfig } from "@/lib/config";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { pruneExpiredRateLimits } from "@/lib/security/rate-limit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const limit = await rateLimit(`admin-reindex:${admin.username}`, RATE_POLICIES.adminWrite);
  if (!limit.ok) return jsonError("rate_limited");

  // The current app queries Postgres directly, so there is no external index
  // to push to. The reindex endpoint runs the standard housekeeping pass
  // (expired tokens + rate-limit buckets) and writes an audit entry.
  const [prunedTokens, prunedLimits] = await Promise.all([
    pruneExpiredTokens(),
    pruneExpiredRateLimits(),
  ]);

  await writeAudit({
    action: "admin.search.reindex",
    entityType: "Search",
    entityId: "all",
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: { prunedTokens, prunedLimits },
  });
  return jsonOk({
    provider: appConfig.searchProvider,
    prunedTokens,
    prunedLimits,
  });
}
