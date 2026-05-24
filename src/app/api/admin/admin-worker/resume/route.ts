import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { resume } from "@/lib/admin-worker";
import { prisma } from "@/lib/db/client";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });

  const next = await resume(prisma, { byUsername: admin.username });

  await writeAudit({
    action: "admin_worker.resume",
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
