import { type NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { jsonOk } from "@/lib/http";
import { enqueueJob } from "@/lib/ingestion/queue/queue";
import { auditRawRows } from "@/lib/content-qa/raw-row-audit";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

/**
 * Admin "Convert valid raw rows through factory" action. Enqueues a
 * `content_revalidate` sweep so the factory re-runs every catalog
 * row through the real QA + public gate — rows that pass become
 * public, rows that fail are rejected/deleted by the existing strict
 * rules. This route never publishes a row directly.
 */
export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;

  const audit = await auditRawRows();
  await enqueueJob({
    jobName: "convert-raw-rows",
    jobKind: "content_revalidate",
    dedupeKey: "convert_raw_rows_revalidate",
    payload: { contentType: "all", sweepReason: "manual", triggeredBy: "manual" },
    triggeredBy: "manual",
  });
  logger.info("admin.content_qa.convert_raw_rows.enqueued", {
    totalConvertible: audit.totalConvertible,
  });
  return jsonOk({
    enqueued: true,
    convertibleRows: audit.totalConvertible,
    note: "content_revalidate sweep enqueued — the factory will convert valid rows and reject the rest.",
  });
}
