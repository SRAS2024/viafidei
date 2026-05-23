/**
 * Structured worker build logs.
 *
 * Every meaningful step the worker takes during a build writes one
 * WorkerBuildLog row: which source it fetched, which field it extracted,
 * which warnings it raised, and what confidence it finalised. Admins read
 * these from the dashboard to debug failed builds.
 */

import type { PrismaClient } from "@prisma/client";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogInput {
  step: string;
  level?: LogLevel;
  message: string;
  fieldName?: string;
  sourceUrl?: string;
  warnings?: string[];
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export class BuildLogger {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly buildJobId: string,
  ) {}

  async log(input: LogInput): Promise<void> {
    await this.prisma.workerBuildLog.create({
      data: {
        buildJobId: this.buildJobId,
        step: input.step,
        level: input.level ?? "info",
        message: input.message,
        fieldName: input.fieldName,
        sourceUrl: input.sourceUrl,
        warnings: input.warnings ?? [],
        confidence: input.confidence,
        metadata: input.metadata as never,
      },
    });
  }

  debug(step: string, message: string, extra: Partial<LogInput> = {}) {
    return this.log({ ...extra, step, message, level: "debug" });
  }

  info(step: string, message: string, extra: Partial<LogInput> = {}) {
    return this.log({ ...extra, step, message, level: "info" });
  }

  warn(step: string, message: string, extra: Partial<LogInput> = {}) {
    return this.log({ ...extra, step, message, level: "warn" });
  }

  error(step: string, message: string, extra: Partial<LogInput> = {}) {
    return this.log({ ...extra, step, message, level: "error" });
  }
}

export async function listBuildLogs(
  prisma: PrismaClient,
  buildJobId: string,
): Promise<
  Array<{
    id: string;
    step: string;
    level: string;
    message: string;
    fieldName: string | null;
    sourceUrl: string | null;
    warnings: string[];
    confidence: number | null;
    metadata: unknown;
    createdAt: Date;
  }>
> {
  return prisma.workerBuildLog.findMany({
    where: { buildJobId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      step: true,
      level: true,
      message: true,
      fieldName: true,
      sourceUrl: true,
      warnings: true,
      confidence: true,
      metadata: true,
      createdAt: true,
    },
  });
}
