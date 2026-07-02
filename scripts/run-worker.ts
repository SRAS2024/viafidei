#!/usr/bin/env tsx
/**
 * Via Fidei Admin Worker entry point.
 *
 * Drives the autonomous content / diagnostics / design / security /
 * maintenance system. Each pass:
 *
 *   - writes a heartbeat
 *   - refreshes content goals from live PublishedContent counts
 *   - selects the highest-available priority (security threat, worker
 *     health, content goal, source repair, content build, …)
 *   - generates work items when content goals are unmet — no manual
 *     trigger required
 *   - walks the Admin Worker artifact pipeline via the mission
 *     dispatcher (discovery → fetch → structured read → artifact →
 *     strict QA → publish orchestrator → post-publish verification).
 *     The legacy build/publish engine is removed (spec §1).
 *   - on the last calendar day of the month, generates + emails the
 *     Monthly Admin Worker Report PDF (no separate cron needed)
 *
 * Usage:
 *   tsx scripts/run-worker.ts                # loop forever
 *   tsx scripts/run-worker.ts --one-shot     # one pass then exit
 *   tsx scripts/run-worker.ts --max-jobs N   # exit after N passes
 *   tsx scripts/run-worker.ts --worker-id X  # supply a stable worker id
 *
 * Multiple workers can run in parallel; the build queue lease guard
 * prevents two workers from running the same build.
 *
 * INTERNAL NAMES: the script is still called `run-worker.ts` and the
 * Dockerfile target is still `npm run worker` so existing deployment
 * infrastructure continues to work. The admin-facing UI calls it the
 * "Admin Worker".
 */

import { runAdminWorkerLoop, runMonthlyReportJobIfDue } from "../src/lib/admin-worker";
import { ensureBrainStarted, shutdownBrain } from "../src/lib/admin-worker/intelligence";
import { reapStaleRunningPasses } from "../src/lib/admin-worker/passes";
import { writeAdminWorkerLog } from "../src/lib/admin-worker/logs";
import { prisma } from "../src/lib/db/client";

function parseArgs(argv: string[]): {
  oneShot: boolean;
  maxJobs: number | null;
  workerId: string;
} {
  let oneShot = false;
  let maxJobs: number | null = null;
  let workerId = process.env.WORKER_ID ?? `admin-worker-${process.pid}-${Date.now()}`;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--one-shot") oneShot = true;
    else if (arg === "--max-jobs") {
      maxJobs = parseInt(argv[++i] ?? "0", 10);
    } else if (arg === "--worker-id") {
      workerId = argv[++i] ?? workerId;
    }
  }
  return { oneShot, maxJobs, workerId };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Reuse the shared, connection-pool-capped client so the worker and the web
  // service don't exhaust Postgres (P2037 "too many clients already").
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[admin-worker:${args.workerId}] received ${signal}; exiting...`);
    setTimeout(() => process.exit(0), 1_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    console.log(
      `[admin-worker:${args.workerId}] starting (oneShot=${args.oneShot}, maxJobs=${args.maxJobs ?? "∞"})`,
    );

    // Reap any pass left RUNNING by a previous process that crashed or was
    // killed mid-pass. Those rows can never complete on their own and otherwise
    // show forever as "Last pass … (status: RUNNING)" in the audit. A fresh
    // process owns none of them, so anything older than the liveness cutoff is
    // closed as FAILED. Fail-open — must not block boot.
    const reaped = await reapStaleRunningPasses(prisma);
    if (reaped > 0) {
      console.log(`[admin-worker:${args.workerId}] reaped ${reaped} stale RUNNING pass(es)`);
    }

    // Bring the permanent intelligence brain online up front so it is
    // available for the first decision — it stays resident for the life of
    // the worker rather than being spawned per call.
    const brainUp = ensureBrainStarted();
    console.log(
      `[admin-worker:${args.workerId}] intelligence brain: ${brainUp ? "online" : "disabled/unavailable (deterministic fallbacks)"}`,
    );
    // Record the intelligence-layer boot state to the audit trail so the admin
    // UI / diagnostics can distinguish "brain never started this process" from
    // "brain made no recent decision" — the two look identical from decisions
    // alone. Fail-open.
    await writeAdminWorkerLog(prisma, {
      category: "OVERVIEW",
      severity: brainUp ? "INFO" : "WARN",
      eventName: "brain_startup",
      message: brainUp
        ? "Admin Worker intelligence layer started (Python brain online)."
        : "Admin Worker intelligence layer unavailable at startup — running deterministic fallbacks.",
      safeMetadata: { available: brainUp },
    }).catch(() => undefined);

    // System/code-update version memory: record the running build at startup so
    // an upgrade-at-deploy is captured immediately (before the first pass) and
    // is available as escalation/diagnostics context. Fail-open.
    try {
      const { recordCodeVersionIfChanged } = await import("../src/lib/admin-worker/code-version");
      const v = await recordCodeVersionIfChanged(prisma);
      if (v.changed) {
        console.log(`[admin-worker:${args.workerId}] code version: ${v.label} — ${v.summary}`);
      }
    } catch (err) {
      console.error(`[admin-worker:${args.workerId}] code-version check failed:`, err);
    }

    // Best-effort monthly report check on startup. The job gates itself
    // on "is today the last day of the month?" so calling it daily is
    // safe; we trigger once on start so a restart on the last day of
    // the month still fires the report.
    await runMonthlyReportJobIfDue(prisma).catch((err) => {
      console.error(`[admin-worker:${args.workerId}] monthly report check failed:`, err);
    });

    // Best-effort escalation check on startup (forced past the throttle) so a
    // freshly-restarted worker immediately surfaces any serious standing issue.
    try {
      const { runEscalationCheckIfDue } = await import("../src/lib/admin-worker/escalation");
      await runEscalationCheckIfDue(prisma, { force: true });
    } catch (err) {
      console.error(`[admin-worker:${args.workerId}] startup escalation check failed:`, err);
    }

    const result = await runAdminWorkerLoop(prisma, {
      workerId: args.workerId,
      oneShot: args.oneShot,
      maxPasses: args.maxJobs ?? Infinity,
    });
    console.log(`[admin-worker:${args.workerId}] result:`, result);
  } finally {
    shutdownBrain();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[admin-worker] fatal:", err);
  process.exitCode = 1;
});
