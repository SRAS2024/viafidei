import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";
import {
  archiveDuplicatePrayers,
  cleanupMiscategorisedContent,
  purgeStaleArchivedContent,
} from "@/lib/data/cleanup";
import { getDataManagementSettings } from "@/lib/data/site-settings";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { logger } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Admin-triggered "Run data cleanup now". Runs the same three passes
 * the cron job runs:
 *
 *   1. cleanupMiscategorisedContent — archive rows whose body now
 *      reads like a source summary / TV listing / newsletter blurb.
 *   2. archiveDuplicatePrayers — collapse rows that share a content
 *      checksum but landed under different slugs.
 *   3. purgeStaleArchivedContent — permanently delete rows that have
 *      been ARCHIVED for ≥ hardDeleteAfterDays days.
 *
 * Records an AdminAuditLog row so the admin's manual trigger is
 * traceable, and returns a per-bucket summary so the UI can show
 * what was archived and what was deleted.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const started = Date.now();
  const settings = await getDataManagementSettings();
  let miscategorised: Awaited<ReturnType<typeof cleanupMiscategorisedContent>> = {
    buckets: [],
    totalArchived: 0,
  };
  let duplicatePrayers = 0;
  let purged: Awaited<ReturnType<typeof purgeStaleArchivedContent>> = {
    buckets: [],
    totalDeleted: 0,
  };
  let errorMessage: string | null = null;

  try {
    [miscategorised, duplicatePrayers, purged] = await Promise.all([
      cleanupMiscategorisedContent(),
      archiveDuplicatePrayers(),
      purgeStaleArchivedContent(settings.hardDeleteAfterDays),
    ]);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("admin.data_management.cleanup.failed", {
      actor: admin.username,
      errorMessage,
    });
  }

  await writeAudit({
    action: "admin.data_management.cleanup.run",
    entityType: "SiteSetting",
    entityId: "data_management",
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: {
      miscategorisedArchived: miscategorised.totalArchived,
      duplicatePrayers,
      hardDeleted: purged.totalDeleted,
      hardDeleteAfterDays: settings.hardDeleteAfterDays,
      errorMessage,
    },
  });

  logger.info("admin.data_management.cleanup.run", {
    actor: admin.username,
    durationMs: Date.now() - started,
    miscategorisedArchived: miscategorised.totalArchived,
    duplicatePrayers,
    hardDeleted: purged.totalDeleted,
    errorMessage,
  });

  if (errorMessage) {
    return jsonError("server_error", { message: errorMessage });
  }
  return jsonOk({
    durationMs: Date.now() - started,
    miscategorised,
    duplicatePrayers,
    hardDeleted: purged,
    autoCleanupEnabled: settings.autoCleanupEnabled,
    hardDeleteAfterDays: settings.hardDeleteAfterDays,
  });
}
