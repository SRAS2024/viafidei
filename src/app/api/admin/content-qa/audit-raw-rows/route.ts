import { type NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonOk } from "@/lib/http";
import { auditRawRows } from "@/lib/content-qa/raw-row-audit";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

/**
 * Admin "Audit existing raw rows" action. Read-only — classifies
 * every catalog row (already valid public / blocked by public gate /
 * missing source evidence / convertible through factory / invalid
 * and deletable) and returns a JSON report. Never publishes or
 * deletes anything.
 */
export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;

  const report = await auditRawRows();
  logger.info("admin.content_qa.audit_raw_rows.completed", {
    totalRows: report.totalRows,
    totalRawRows: report.totalRawRows,
    totalConvertible: report.totalConvertible,
  });
  return jsonOk({ report });
}
