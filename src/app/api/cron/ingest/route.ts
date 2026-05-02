import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/security/cron-auth";
import { runAllActiveJobs } from "@/lib/ingestion/scheduler";

// Long-lived cron invocation; allow up to 60s for slow upstreams.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runAllActiveJobs();
  return NextResponse.json({ ok: true, summary });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
