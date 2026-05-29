import { requireAdmin } from "@/lib/auth/admin";
import { legacyDisabledResponse } from "@/lib/worker/legacy-disabled";
import { NextResponse } from "next/server";

/**
 * Spec §1: hard-disabled. Manual legacy publish is no longer an active
 * content path — public content is created only by the Admin Worker
 * artifact pipeline via runPublishOrchestrator().
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return legacyDisabledResponse();
}
