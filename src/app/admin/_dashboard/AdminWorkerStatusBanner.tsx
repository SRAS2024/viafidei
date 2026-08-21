import Link from "next/link";

import { readExecutionStatus } from "@/lib/admin-worker/execution-host";
import { prisma } from "@/lib/db/client";

/**
 * READ-ONLY execution banner on /admin.
 *
 * The Admin Worker runs on the operator's MacBook, launched from the native
 * Via Fidei application. This banner reports what the database says about that
 * — whether the worker is intentionally off, actively running locally, or
 * switched on with its local runtime disconnected — plus the state of the build
 * queue it left behind. It exposes no controls: nothing here can start Admin
 * Worker computation on the production web service.
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

  const execution = await readExecutionStatus(prisma).catch(() => null);
  const state = execution?.state ?? "OFF";

  const tone =
    state === "LOCAL_ACTIVE"
      ? { color: "#185c2a", bg: "#f0f7f1", label: "Running on the operator's Mac" }
      : state === "OFF"
        ? { color: "#3b3f4a", bg: "#f4f3f0", label: "Off (intentionally inactive)" }
        : state === "LOCAL_DISCONNECTED"
          ? { color: "#9b6b00", bg: "#fdf7e6", label: "On — local runtime disconnected" }
          : { color: "#8b1a1a", bg: "#fdf6f6", label: "Remote runtime (manual override)" };

  return (
    <div
      role="status"
      className="mx-auto mb-4 max-w-3xl rounded-sm border p-3 font-serif text-sm"
      style={{ borderColor: tone.color, backgroundColor: tone.bg, color: tone.color }}
      data-status={state.toLowerCase()}
    >
      <p>
        <span className="font-bold">Admin Worker · {tone.label}.</span> Queue: {pending} pending,{" "}
        {running} running, {failed} failed · QA pending: {qaPending}.
      </p>
      <p className="mt-1 text-xs">
        Worker controls live in the native Via Fidei application on the operator&apos;s MacBook.
        This browser admin keeps user management,{" "}
        <Link href="/admin/diagnostics" className="underline">
          diagnostics
        </Link>{" "}
        and{" "}
        <Link href="/admin/logs/worker" className="underline">
          logs
        </Link>
        .
      </p>
    </div>
  );
}
