import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { getAdminWorkerState } from "@/lib/admin-worker";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });

  const state = await getAdminWorkerState(prisma);
  return NextResponse.json({
    currentMode: state.currentMode,
    currentPriority: state.currentPriority,
    currentGoal: state.currentGoal,
    currentTask: state.currentTask,
    paused: state.paused,
    pausedReason: state.pausedReason,
    lastHeartbeatAt: state.lastHeartbeatAt,
    lastSuccessfulAt: state.lastSuccessfulAt,
    lastFailedAt: state.lastFailedAt,
    currentBlocker: state.currentBlocker,
    recoveryAction: state.recoveryAction,
    workerVersion: state.workerVersion,
  });
}
