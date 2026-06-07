/**
 * Build-intent queue.
 *
 * When a checklist item is approved for build, a `WorkerBuildJob` row is
 * created as a build-intent signal. The Admin Worker dispatcher and planner
 * read these rows (to avoid double-enqueuing the same item and to surface
 * queue depth on the dashboard); the autonomous artifact pipeline in
 * `src/lib/admin-worker/` is what actually builds, QA-checks, and publishes.
 */

import type { PrismaClient, WorkerBuildJob } from "@prisma/client";

const DEFAULT_MAX_ATTEMPTS = 5;

export interface EnqueueOptions {
  checklistItemId: string;
  priority?: number;
  runAt?: Date;
  maxAttempts?: number;
  triggeredBy?: string;
  actorUsername?: string;
}

export async function enqueueBuild(
  prisma: PrismaClient,
  options: EnqueueOptions,
): Promise<WorkerBuildJob> {
  const lastAttempt = await prisma.workerBuildJob.findFirst({
    where: { checklistItemId: options.checklistItemId },
    orderBy: { attempt: "desc" },
    select: { attempt: true },
  });
  const attempt = (lastAttempt?.attempt ?? 0) + 1;

  return prisma.workerBuildJob.create({
    data: {
      checklistItemId: options.checklistItemId,
      attempt,
      priority: options.priority ?? 100,
      runAt: options.runAt ?? new Date(),
      maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      triggeredBy: options.triggeredBy ?? "automatic",
      actorUsername: options.actorUsername,
    },
  });
}
