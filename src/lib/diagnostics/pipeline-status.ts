/**
 * Pipeline status + blocker identification.
 *
 * The content factory pipeline is:
 *
 *   Queue → Worker → Source documents → Build logs → Complete
 *   packages → Strict QA → Persisted packages → Strict public rows
 *
 * `identifyPipelineBlocker` walks the chain in order and names the
 * first stage that has work upstream but nothing downstream — so the
 * admin (and the recovery flow) always gets a precise blocker code
 * instead of a vague "no content growth".
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { hasHealthyWorker } from "../ingestion/queue/heartbeat";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "../content-qa/thresholds";

export type PipelineBlocker =
  | "worker_not_processing_queue"
  | "source_fetch_not_running"
  | "fetch_to_build_not_enqueued"
  | "builders_not_creating_complete_packages"
  | "strict_qa_rejecting_packages"
  | "public_gate_failed"
  | null;

export type PipelineStatusMetrics = {
  queuePending: number;
  queueRunning: number;
  workerHealthy: boolean;
  sourceDocuments: number;
  buildLogs: number;
  completePackages: number;
  qaPasses: number;
  persistedPackages: number;
  strictPublicRows: number;
};

export type PipelineStatus = PipelineStatusMetrics & {
  generatedAt: Date;
  blocker: PipelineBlocker;
  blockerMessage: string;
  errors: Record<string, string>;
};

/** Distinct public content models the strict-public gate applies to. */
const PUBLIC_MODELS = [
  "prayer",
  "saint",
  "marianApparition",
  "parish",
  "devotion",
  "spiritualLifeGuide",
  "liturgyEntry",
] as const;

const BLOCKER_MESSAGE: Record<NonNullable<PipelineBlocker>, string> = {
  worker_not_processing_queue: "Queue has pending jobs but no healthy worker is processing them.",
  source_fetch_not_running: "Worker is healthy but source fetch has not produced any documents.",
  fetch_to_build_not_enqueued: "Source documents exist but no content build has been enqueued.",
  builders_not_creating_complete_packages:
    "Builds are running but no complete package has been produced.",
  strict_qa_rejecting_packages: "Complete packages exist but strict QA is rejecting all of them.",
  public_gate_failed: "Packages are persisted but the strict public gate is hiding all of them.",
};

/**
 * Walk the pipeline in order and name the first broken stage. The
 * order matters: an upstream blocker is always reported before a
 * downstream one.
 */
export function identifyPipelineBlocker(m: PipelineStatusMetrics): PipelineBlocker {
  if (m.queuePending > 0 && !m.workerHealthy) return "worker_not_processing_queue";
  if (m.workerHealthy && m.sourceDocuments === 0) return "source_fetch_not_running";
  if (m.sourceDocuments > 0 && m.buildLogs === 0) return "fetch_to_build_not_enqueued";
  if (m.buildLogs > 0 && m.completePackages === 0) return "builders_not_creating_complete_packages";
  if (m.completePackages > 0 && m.qaPasses === 0) return "strict_qa_rejecting_packages";
  if (m.persistedPackages > 0 && m.strictPublicRows === 0) return "public_gate_failed";
  return null;
}

async function safe<T>(
  fn: () => Promise<T>,
  label: string,
  errors: Record<string, string>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors[label] = msg;
    logger.warn("pipeline-status.query_failed", { label, error: msg });
    return null;
  }
}

async function sumPublicModels(
  where: Record<string, unknown>,
  labelPrefix: string,
  errors: Record<string, string>,
): Promise<number> {
  const client = prisma as unknown as Record<
    string,
    { count: (a: { where: unknown }) => Promise<number> }
  >;
  let total = 0;
  for (const model of PUBLIC_MODELS) {
    const delegate = client[model];
    if (!delegate) continue;
    const n = await safe(() => delegate.count({ where }), `${labelPrefix}.${model}`, errors);
    total += n ?? 0;
  }
  return total;
}

/**
 * Snapshot the whole pipeline and identify the current blocker. Each
 * query is wrapped — a failed query records an error and counts as 0
 * rather than throwing the whole snapshot away.
 */
export async function getPipelineStatus(): Promise<PipelineStatus> {
  const errors: Record<string, string> = {};
  const generatedAt = new Date();

  const queuePending =
    (await safe(
      () => prisma.ingestionJobQueue.count({ where: { status: "pending" } }),
      "queuePending",
      errors,
    )) ?? 0;
  const queueRunning =
    (await safe(
      () => prisma.ingestionJobQueue.count({ where: { status: "running" } }),
      "queueRunning",
      errors,
    )) ?? 0;
  const workerHealthy = (await safe(() => hasHealthyWorker(), "workerHealthy", errors)) ?? false;
  const sourceDocuments =
    (await safe(() => prisma.sourceDocument.count(), "sourceDocuments", errors)) ?? 0;
  const buildLogs =
    (await safe(() => prisma.contentPackageBuildLog.count(), "buildLogs", errors)) ?? 0;
  const completePackages =
    (await safe(
      () =>
        prisma.contentPackageBuildLog.count({
          where: { buildStatus: "built_complete_package" },
        }),
      "completePackages",
      errors,
    )) ?? 0;
  const qaPasses =
    (await safe(
      () => prisma.queueAuditLog.count({ where: { event: "chain.strict_qa_passed" } }),
      "qaPasses",
      errors,
    )) ?? 0;
  const persistedPackages = await sumPublicModels({ status: "PUBLISHED" }, "persisted", errors);
  const strictPublicRows = await sumPublicModels(
    { ...STRICT_PUBLIC_WHERE_CLAUSE },
    "strictPublic",
    errors,
  );

  const metrics: PipelineStatusMetrics = {
    queuePending,
    queueRunning,
    workerHealthy,
    sourceDocuments,
    buildLogs,
    completePackages,
    qaPasses,
    persistedPackages,
    strictPublicRows,
  };
  const blocker = identifyPipelineBlocker(metrics);
  const blockerMessage = blocker
    ? BLOCKER_MESSAGE[blocker]
    : "Pipeline is flowing — no blocker detected.";

  return { ...metrics, generatedAt, blocker, blockerMessage, errors };
}
