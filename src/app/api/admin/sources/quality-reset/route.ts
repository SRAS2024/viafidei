/**
 * Source quality reset action.
 *
 * Resets the auto-pause state on a source after its underlying
 * configuration problem has been fixed. Spec #24/#26: an
 * auto-paused source stays paused until an admin intervenes; this
 * action zeroes out the wrong-content / build-failure counters,
 * lifts the autoPaused flag on both SourceQualityScore and
 * IngestionSource, and clears the pausedAt timestamp so the source
 * is eligible for the next discovery wave.
 *
 * The historical score row is NOT deleted — it stays for forensic
 * audit, but the rolling failure rates restart from zero so a
 * one-off bad streak doesn't poison the source forever.
 *
 * POST body: { sourceId: string, contentType?: string }
 *   - contentType omitted: reset every per-content-type score row
 *     and lift the source-level autoPause.
 *   - contentType set: reset just that one score row (source-level
 *     autoPause is lifted only when no per-type rows remain paused).
 */

import { type NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { ADMIN_ACTION, writeAdminActionLog } from "@/lib/audit/admin-action-log";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as {
    sourceId?: string;
    contentType?: string;
  } | null;
  if (!body?.sourceId) {
    return jsonError("invalid", { message: "sourceId is required" });
  }

  const source = await prisma.ingestionSource.findUnique({
    where: { id: body.sourceId },
    select: { id: true, host: true, autoPaused: true, pausedAt: true, pausedReason: true },
  });
  if (!source) {
    return jsonError("not_found", { message: `Source ${body.sourceId} not found` });
  }

  // Reset the matching score row(s). Counts are zeroed; the row
  // itself is kept so the historical first-seen timestamps survive.
  const scoreWhere = body.contentType
    ? { sourceId: body.sourceId, contentType: body.contentType }
    : { sourceId: body.sourceId };
  const scoreReset = await prisma.sourceQualityScore.updateMany({
    where: scoreWhere,
    data: {
      buildSuccessCount: 0,
      buildFailureCount: 0,
      qaPassCount: 0,
      qaFailCount: 0,
      deletedCount: 0,
      duplicateCount: 0,
      wrongContentCount: 0,
      validPackageRate: null,
      wrongContentRate: null,
      averageCompleteness: null,
      lastFailureAt: null,
      lastFailureReason: null,
      autoPaused: false,
      autoPausedAt: null,
    },
  });

  // Lift the source-level pause when the admin reset every (or the
  // last) auto-paused score row.
  let sourceUnpaused = false;
  if (source.autoPaused) {
    const stillPaused = await prisma.sourceQualityScore.count({
      where: { sourceId: source.id, autoPaused: true },
    });
    if (stillPaused === 0) {
      await prisma.ingestionSource.update({
        where: { id: source.id },
        data: {
          autoPaused: false,
          autoPausedAt: null,
          pausedAt: null,
          pausedReason: null,
          healthState: "active",
        },
      });
      sourceUnpaused = true;
    }
  }

  logger.info("admin.source_quality_reset", {
    actor: gate.admin.username,
    sourceId: body.sourceId,
    host: source.host,
    contentType: body.contentType ?? null,
    scoreRowsReset: scoreReset.count,
    sourceUnpaused,
  });

  await writeAdminActionLog({
    adminUsername: gate.admin.username,
    actionType: ADMIN_ACTION.sourceQualityReset,
    route: "/api/admin/sources/quality-reset",
    method: "POST",
    result: "success",
    deviceCredential: req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    metadata: {
      sourceId: body.sourceId,
      host: source.host,
      contentType: body.contentType ?? null,
      scoreRowsReset: scoreReset.count,
      sourceUnpaused,
    },
  });

  return jsonOk({
    sourceId: body.sourceId,
    host: source.host,
    contentType: body.contentType ?? null,
    scoreRowsReset: scoreReset.count,
    sourceUnpaused,
  });
}
