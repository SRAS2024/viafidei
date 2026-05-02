import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { runAllActiveJobs, runJobByName } from "@/lib/ingestion/scheduler";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";

const schema = z.object({
  jobName: z.string().min(1).max(120).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

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
    return NextResponse.json({ error: "job-not-found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, result });
}
