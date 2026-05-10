import { requireAdmin } from "@/lib/auth/admin";
import { ensureAccountEmailTables } from "@/lib/startup/ensure-email-tables";
import { jsonError, jsonOk } from "@/lib/http";
import { logger } from "@/lib/observability";

/**
 * POST /api/admin/email/ensure-tables
 *
 * Runs the same idempotent SQL the 0006 migration / instrumentation
 * safety net runs, but on demand from the admin diagnostic. Useful
 * when the operator wants to fix a missing-table situation without
 * waiting for the next deploy. Locked behind requireAdmin.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const result = await ensureAccountEmailTables();
  logger.info("admin.email.ensure_tables", {
    actor: admin.username,
    created: result.created,
    ok: result.ok,
    message: result.message,
  });
  if (!result.ok) {
    return jsonError("server_error", {
      message: result.message ?? "ensure_failed",
      details: { created: result.created },
    });
  }
  return jsonOk({ created: result.created });
}
