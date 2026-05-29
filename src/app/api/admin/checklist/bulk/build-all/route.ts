import { requireAdmin } from "@/lib/auth/admin";
import { legacyDisabledResponse } from "@/lib/worker/legacy-disabled";
import { NextResponse } from "next/server";

/**
 * Spec §1: hard-disabled. The legacy bulk build/publish path is no
 * longer active — the Admin Worker artifact pipeline is the only
 * system that builds + publishes content.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return legacyDisabledResponse();
}
