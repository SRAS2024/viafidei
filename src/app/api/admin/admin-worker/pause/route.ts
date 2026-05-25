import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { pause } from "@/lib/admin-worker";
import { prisma } from "@/lib/db/client";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });

  let reason: string;
  try {
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    reason = (body.reason ?? "Paused by admin").slice(0, 500);
  } catch {
    reason = "Paused by admin";
  }

  const next = await pause(prisma, { reason, byUsername: admin.username });

  await writeAudit({
    action: "admin_worker.pause",
    entityType: "AdminWorkerState",
    entityId: "singleton",
    actorUsername: admin.username,
  });

  return NextResponse.json({
    paused: next.paused,
    pausedReason: next.pausedReason,
    pausedAt: next.pausedAt,
  });
}
