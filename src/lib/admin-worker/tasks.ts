/**
 * Admin Worker tasks. A task is one planned action (build a piece of
 * content, verify a source, repair a stalled queue). The planner
 * generates tasks; mode handlers consume them.
 */

import type {
  AdminWorkerPriority,
  AdminWorkerTaskStatus,
  AdminWorkerTaskType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

export interface CreateTaskInput {
  passId?: string;
  taskType: AdminWorkerTaskType;
  priority: AdminWorkerPriority;
  contentType?: string;
  sourceId?: string;
  sourceUrl?: string;
  relatedContentId?: string;
  plannedAction?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function createTask(
  prisma: PrismaClient,
  input: CreateTaskInput,
): Promise<{ id: string }> {
  const row = await prisma.adminWorkerTask.create({
    data: {
      passId: input.passId,
      taskType: input.taskType,
      priority: input.priority,
      contentType: input.contentType,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      relatedContentId: input.relatedContentId,
      plannedAction: input.plannedAction,
      metadata: input.metadata,
      status: "PENDING",
    },
    select: { id: true },
  });
  return row;
}

export async function startTask(prisma: PrismaClient, taskId: string): Promise<void> {
  await prisma.adminWorkerTask.update({
    where: { id: taskId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}

export interface CompleteTaskInput {
  status: AdminWorkerTaskStatus;
  result?: string;
  failureReason?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function completeTask(
  prisma: PrismaClient,
  taskId: string,
  input: CompleteTaskInput,
): Promise<void> {
  await prisma.adminWorkerTask.update({
    where: { id: taskId },
    data: {
      status: input.status,
      result: input.result,
      failureReason: input.failureReason,
      completedAt: new Date(),
      metadata: input.metadata,
    },
  });
}

export async function listPendingTasks(prisma: PrismaClient, opts: { limit?: number } = {}) {
  return prisma.adminWorkerTask.findMany({
    where: { status: "PENDING" },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    take: opts.limit ?? 25,
  });
}
