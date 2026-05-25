import Link from "next/link";

import { prisma } from "@/lib/db/client";

/**
 * Compact banner shown on /admin that surfaces the live status of the
 * checklist-first worker queue. Replaces the legacy "ingestion status"
 * banner.
 */
export async function AdminWorkerStatusBanner() {
  let pending = 0;
  let running = 0;
  let failed = 0;
  let qaPending = 0;
  try {
    const [pendingCount, runningCount, failedCount, qaPendingCount] = await Promise.all([
      prisma.workerBuildJob.count({ where: { status: "pending" } }),
      prisma.workerBuildJob.count({ where: { status: "running" } }),
      prisma.workerBuildJob.count({ where: { status: "failed" } }),
      prisma.checklistItem.count({ where: { approvalStatus: "QA_PENDING" } }),
    ]);
    pending = pendingCount;
    running = runningCount;
    failed = failedCount;
    qaPending = qaPendingCount;
  } catch {
    return null;
  }

  const tone =
    failed > 0
      ? { color: "#8b1a1a", bg: "#fdf6f6", label: "Failed builds" }
      : running > 0
        ? { color: "#185c2a", bg: "#f0f7f1", label: "Running" }
        : pending > 0
          ? { color: "#9b6b00", bg: "#fdf7e6", label: "Pending" }
          : { color: "#3b3f4a", bg: "#f4f3f0", label: "Idle" };

  return (
    <div
      role="status"
      className="mx-auto mb-4 max-w-3xl rounded-sm border p-3 font-serif text-sm"
      style={{ borderColor: tone.color, backgroundColor: tone.bg, color: tone.color }}
      data-status={tone.label.toLowerCase()}
    >
      <p>
        <span className="font-bold">Admin Worker · {tone.label}.</span> Queue: {pending} pending,{" "}
        {running} running, {failed} failed · QA pending: {qaPending}.{" "}
        <Link href="/admin/checklist" className="underline">
          Open dashboard
        </Link>
      </p>
    </div>
  );
}
