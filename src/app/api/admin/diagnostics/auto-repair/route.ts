import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { runAutoRepairPass, replaySourceDocument } from "@/lib/ingestion/queue/auto-repair";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  // Admin-triggered single source-document replay OR a full auto-repair pass.
  // The body chooses the mode.
  //
  // Spec #11/#26: `forceRebuild` lets admin recover a previously-failed
  // build at the current builder version (e.g. after a parser/router/
  // source-config fix) without needing an artificial builder version
  // bump. Defaults to true since the assumed use-case for manual
  // replay IS the post-fix repair.
  const body = (await req.json().catch(() => null)) as {
    mode?: "auto";
    sourceDocumentId?: string;
    contentType?: string;
    forceRebuild?: boolean;
  } | null;
  if (body?.sourceDocumentId) {
    const result = await replaySourceDocument({
      sourceDocumentId: body.sourceDocumentId,
      contentType: body.contentType as never,
      forceRebuild: body.forceRebuild ?? true,
    });
    logger.info("admin.auto_repair.replay", {
      actor: admin.username,
      sourceDocumentId: body.sourceDocumentId,
      forceRebuild: body.forceRebuild ?? true,
      result,
    });
    return jsonOk({ result, requestId: req.headers.get(REQUEST_ID_HEADER) ?? null });
  }
  const report = await runAutoRepairPass();
  logger.info("admin.auto_repair.full_pass", {
    actor: admin.username,
    actionsTaken: report.actionsTaken.length,
    errors: report.errors.length,
  });
  return jsonOk({ report, requestId: req.headers.get(REQUEST_ID_HEADER) ?? null });
}
