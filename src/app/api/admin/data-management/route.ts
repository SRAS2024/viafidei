import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit/log";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { getDataManagementSettings, upsertDataManagementSettings } from "@/lib/data/site-settings";

export const runtime = "nodejs";

const schema = z.object({
  autoCleanupEnabled: z.boolean(),
  hardDeleteAfterDays: z.number().int().min(0).max(3650),
});

/**
 * Admin endpoint backing the Ingestion & Data Management settings panel.
 *
 *   GET  — returns the current settings (admin only).
 *   POST — replaces the stored settings (admin only). The cron job
 *          reads them on every tick, so changes take effect on the
 *          next ingest cycle.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const settings = await getDataManagementSettings();
  return jsonOk({ settings });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError("invalid", { details: parsed.error.flatten() });
  }
  const previous = await getDataManagementSettings();
  await upsertDataManagementSettings(parsed.data);
  // Log to the Admin actions log so the toggle history is auditable.
  await writeAudit({
    action: "data_management.settings.update",
    entityType: "SiteSetting",
    entityId: "data_management",
    previousValue: previous,
    newValue: parsed.data,
    actorUsername: admin.username,
  });
  return jsonOk({ settings: parsed.data });
}
