import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { runAllActiveJobs, runJobByName } from "@/lib/ingestion/scheduler";
import { ensureVaticanSchedule } from "@/lib/ingestion/sources";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z.object({
  jobName: z.string().min(1).max(120).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const body = await readJsonBody<unknown>(req);
  const candidate = body.ok ? body.data : {};
  if (!body.ok && body.reason === "too_large") {
    return jsonError("too_large");
  }
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    return jsonError("invalid", { details: parsed.error.flatten() });
  }

  await ensureVaticanSchedule();
  const result = parsed.data.jobName
    ? await runJobByName(parsed.data.jobName)
    : await runAllActiveJobs();

  await writeAudit({
    action: parsed.data.jobName ? "admin.ingestion.run.job" : "admin.ingestion.run.all",
    entityType: "IngestionJob",
    entityId: parsed.data.jobName ?? "all",
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: result as never,
  });

  if (result === null) {
    return jsonError("not_found", { message: "job-not-found" });
  }
  return jsonOk({ result });
}
