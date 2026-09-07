#!/usr/bin/env tsx
/**
 * Via Fidei Admin Worker entry point.
 *
 * EXECUTION HOST: this process now runs on the OPERATOR'S MACBOOK, launched and
 * supervised by the native Via Fidei application through
 * `scripts/local-worker-host.ts`. It is the same worker it has always been —
 * TypeScript body, Python brain, browser rendering, discovery, verification,
 * publishing, security and repair — but the CPU, memory and network it consumes
 * are the MacBook's, not Railway's.
 *
 * Pass `--origin local` (the local host does) to claim the local runtime. Run
 * without it and the process refuses to execute: the retained Railway worker
 * service is deliberately parked, and there is no automatic cloud failover
 * (spec §5). `--force-remote-execution "<reason>"` is the documented, manual
 * escape hatch for deliberately restoring cloud execution in the future.
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

import {
  allowRemoteExecutionOverride,
  markWorkerExecutionOrigin,
} from "../src/lib/admin-worker/execution-context";

// Claim the execution origin BEFORE the worker library is imported, so every
// guard in the module tree evaluates against the right runtime.
const ORIGIN_ARG_INDEX = process.argv.indexOf("--origin");
const ORIGIN_ARG = ORIGIN_ARG_INDEX >= 0 ? (process.argv[ORIGIN_ARG_INDEX + 1] ?? "") : "";
const FORCE_REMOTE_INDEX = process.argv.indexOf("--force-remote-execution");
markWorkerExecutionOrigin(ORIGIN_ARG === "local" ? "LOCAL_MACBOOK" : "RAILWAY_WORKER");
if (ORIGIN_ARG !== "local" && FORCE_REMOTE_INDEX >= 0) {
  allowRemoteExecutionOverride(process.argv[FORCE_REMOTE_INDEX + 1] ?? "operator override");
}

import { runAdminWorkerLoop, runMonthlyReportJobIfDue } from "../src/lib/admin-worker";
import { seedContentGoals } from "../src/lib/admin-worker/content-goals";
import { abandonCurrentPass } from "../src/lib/admin-worker/loop";
import {
  acquireExecutionLease,
  holdsExecutionLease,
  readMasterSwitch,
  releaseExecutionLease,
  setMasterSwitch,
} from "../src/lib/admin-worker/execution-host";
import { localHostLabel } from "../src/lib/admin-worker/local-resources";
import {
  ensureBrainStarted,
  resolvedPythonExe,
  shutdownBrain,
} from "../src/lib/admin-worker/intelligence";
import { reapStaleRunningPasses } from "../src/lib/admin-worker/passes";
import { writeAdminWorkerLog } from "../src/lib/admin-worker/logs";
import {
  installProcessSafetyNet,
  runLoopSupervised,
} from "../src/lib/admin-worker/worker-supervisor";
import { prisma } from "../src/lib/db/client";

function parseArgs(argv: string[]): {
  oneShot: boolean;
  maxJobs: number | null;
  workerId: string;
  local: boolean;
  switchOn: boolean;
  forceRemote: boolean;
} {
  let oneShot = false;
  let maxJobs: number | null = null;
  let workerId = process.env.WORKER_ID ?? `admin-worker-${process.pid}-${Date.now()}`;
  let local = false;
  let switchOn = false;
  let forceRemote = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--one-shot") oneShot = true;
    else if (arg === "--max-jobs") {
      maxJobs = parseInt(argv[++i] ?? "0", 10);
    } else if (arg === "--worker-id") {
      workerId = argv[++i] ?? workerId;
    } else if (arg === "--origin") {
      local = (argv[++i] ?? "") === "local";
    } else if (arg === "--switch-on") {
      switchOn = true;
    } else if (arg === "--force-remote-execution") {
      forceRemote = true;
      i += 1;
    }
  }
  return { oneShot, maxJobs, workerId, local, switchOn, forceRemote };
}

/**
 * Durable-state gate (spec §4, §5, §25): the master switch must be ON, and this
 * runtime must hold the single execution lease. Returns false when the process
 * should exit instead of running.
 */
async function claimExecutionAuthority(args: ReturnType<typeof parseArgs>): Promise<boolean> {
  if (!args.local && !args.forceRemote) {
    console.error(
      "[admin-worker] refusing to run: the Admin Worker executes on the operator's MacBook.\n" +
        "               Start it from the Via Fidei application (or run `npm run worker:local`).\n" +
        "               Cloud execution requires the deliberate --force-remote-execution flag.",
    );
    return false;
  }

  const master = await readMasterSwitch(prisma);
  if (!master.known) {
    console.error(
      `[admin-worker] refusing to run: the database could not be reached (${master.error ?? "error"}).`,
    );
    process.exitCode = 4;
    return false;
  }
  if (!master.on) {
    if (args.switchOn) {
      await setMasterSwitch(prisma, { on: true, actor: "cli", from: "run-worker" });
      console.log("[admin-worker] master switch turned ON by --switch-on");
    } else {
      console.error(
        "[admin-worker] refusing to run: the Admin Worker master switch is OFF.\n" +
          "               Turn it on in the Via Fidei application, or pass --switch-on.",
      );
      return false;
    }
  }

  if (await holdsExecutionLease(prisma, args.workerId)) return true;

  const claim = await acquireExecutionLease(prisma, {
    runtimeId: args.workerId,
    origin: args.local ? "LOCAL_MACBOOK" : "RAILWAY_WORKER",
    host: {
      label: localHostLabel(),
      platform: process.platform,
      arch: process.arch,
      cpuCount: (await import("node:os")).cpus().length,
      launchedBy: args.local ? "cli" : "remote-override",
    },
  });
  if (!claim.acquired) {
    console.error(`[admin-worker] refusing to run: ${claim.refusedBecause}`);
    return false;
  }
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!(await claimExecutionAuthority(args))) {
    await prisma.$disconnect().catch(() => undefined);
    // Exit NON-ZERO. Refusing to run is a failure from the caller's point of
    // view: a cron entry, deploy hook or script wrapping `npm run worker` must
    // be able to notice that no work happened instead of reading success.
    // Exit 4 (set above) means "database unreachable" — a different problem
    // from "switch OFF / lease held" (3), and the host treats it differently.
    if (process.exitCode !== 4) process.exitCode = 3;
    return;
  }

  // Reuse the shared, connection-pool-capped client so the worker and the web
  // service don't exhaust Postgres (P2037 "too many clients already").
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[admin-worker:${args.workerId}] received ${signal}; exiting...`);
    // SIGTERM is the host's NORMAL stop (every switch-OFF). Exiting after a
    // fixed 1s skipped the `finally` below, so every operator stop left the
    // in-flight pass RUNNING, the lease row in place and the brain to the
    // process-group kill. Do the cleanup here, bounded to 3s so a dead database
    // can never hold the stop hostage, then exit 0.
    const cleanup = (async () => {
      await abandonCurrentPass(prisma, "stopped by operator").catch(() => false);
      shutdownBrain();
      await releaseExecutionLease(prisma, args.workerId).catch(() => undefined);
      await prisma.$disconnect().catch(() => undefined);
    })();
    const deadline = new Promise<void>((resolve) => setTimeout(resolve, 3_000).unref());
    void Promise.race([cleanup, deadline]).then(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Install the process-level safety net BEFORE anything else runs, so a stray
  // throw during startup or in the loop can never silently kill the worker.
  // (The worker is a bare `tsx` process; the Next-runtime handlers in
  // instrumentation.ts never load here — see worker-supervisor.ts.)
  installProcessSafetyNet({
    workerId: args.workerId,
    register: (event, handler) => process.on(event, handler as never),
    errorLog: (m) => console.error(m),
    onEvent: (kind, detail) =>
      writeAdminWorkerLog(prisma, {
        category: "ERROR",
        severity: "ERROR",
        eventName: `worker_${kind}`,
        message: `Process-level ${kind} caught; worker kept alive: ${detail.slice(0, 480)}`,
      }).then(() => undefined),
    onAlert: (kind, detail) =>
      import("../src/lib/email/admin-send").then(({ sendCriticalFailureAlert }) =>
        sendCriticalFailureAlert({
          kind: `Admin Worker ${kind} (process kept alive by safety net)`,
          message: detail.slice(0, 1000),
          context: { workerId: args.workerId },
        }).then(() => undefined),
      ),
  });

  try {
    console.log(
      `[admin-worker:${args.workerId}] starting on ${args.local ? `LOCAL MacBook runtime (${localHostLabel()})` : "an operator-overridden remote runtime"} ` +
        `(oneShot=${args.oneShot}, maxJobs=${args.maxJobs ?? "∞"})`,
    );

    // Enable outbound egress through a proxy when the deployment provides one
    // (HTTPS_PROXY/HTTP_PROXY/ALL_PROXY) — before any outbound call at startup
    // (email, escalation) or in the loop. No-op when no proxy is set.
    try {
      const { installOutboundProxy } = await import("../src/lib/admin-worker/outbound-network");
      const proxy = await installOutboundProxy();
      console.log(
        `[admin-worker:${args.workerId}] outbound egress: ${proxy.installed ? `proxied (${proxy.mode}) ${proxy.proxyUrl ?? ""}` : "direct"}`,
      );
    } catch {
      /* fail-open — direct egress */
    }

    // Reap any pass left RUNNING by a previous process that crashed or was
    // killed mid-pass. Those rows can never complete on their own and otherwise
    // show forever as "Last pass … (status: RUNNING)" in the audit. A fresh
    // process owns none of them, so anything older than the liveness cutoff is
    // closed as FAILED. Fail-open — must not block boot.
    const reaped = await reapStaleRunningPasses(prisma);
    if (reaped > 0) {
      console.log(`[admin-worker:${args.workerId}] reaped ${reaped} stale RUNNING pass(es)`);
    }

    // Seed the content-goal rows once per boot (creates missing types only —
    // it never overwrites an operator-edited target). The loop no longer does
    // this every pass; it only re-seeds if the table is empty.
    await seedContentGoals(prisma).catch((err) => {
      console.error(`[admin-worker:${args.workerId}] content-goal seed failed:`, err);
    });

    // Bring the permanent intelligence brain online up front so it is
    // available for the first decision — it stays resident for the life of
    // the worker rather than being spawned per call. VERIFIED: the brain must
    // answer a real request; a spawn that "succeeds" and then dies at import
    // (wrong Python version) used to be reported as "online".
    const brain = await ensureBrainStarted();
    console.log(
      `[admin-worker:${args.workerId}] intelligence brain: ${
        brain.online
          ? `online (${brain.python}, protocol v${brain.protocolVersion ?? "?"})`
          : `UNAVAILABLE (${brain.python}): ${brain.reason ?? "unknown"} — safe degraded mode, content lanes will not run`
      }`,
    );
    // Record the intelligence-layer boot state to the audit trail so the admin
    // UI / diagnostics can distinguish "brain never started this process" from
    // "brain made no recent decision" — the two look identical from decisions
    // alone. A failed probe is an ERROR + critical alert naming the interpreter:
    // a degraded brain silently skips every content lane, so it must be loud.
    await writeAdminWorkerLog(prisma, {
      category: "OVERVIEW",
      severity: brain.online ? "INFO" : "ERROR",
      eventName: "brain_startup",
      message: brain.online
        ? `Admin Worker intelligence layer started (Python brain online via ${brain.python}).`
        : `Admin Worker intelligence layer UNAVAILABLE at startup (${brain.python}): ${brain.reason ?? "unknown"}. Running in safe degraded mode — content ingest/discovery lanes are skipped until the brain is fixed.`,
      safeMetadata: {
        available: brain.online,
        python: brain.python,
        protocolVersion: brain.protocolVersion,
        reason: brain.reason,
      },
    }).catch(() => undefined);
    if (!brain.online && brain.reason !== "brain disabled in this runtime") {
      try {
        const { sendCriticalFailureAlert } = await import("../src/lib/email/admin-send");
        await sendCriticalFailureAlert({
          kind: "Admin Worker Python brain unavailable at startup",
          message: `${brain.reason ?? "unknown"} (interpreter: ${brain.python}). The worker is running in safe degraded mode and will not grow content until this is fixed — set INTELLIGENCE_PYTHON to a Python >= 3.10.`,
          context: { workerId: args.workerId, python: resolvedPythonExe() },
        });
      } catch {
        /* fail-open */
      }
    }

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

    // Schema-integrity self-check: if the deployed DB is behind the Prisma
    // schema (a migration didn't apply / a column is missing), full-row reads
    // throw P2022, the funnel's fail-open catches swallow them as "no rows", and
    // NOTHING publishes while builds keep succeeding — the recurring
    // EXTRACTING_WITHOUT_PUBLISHING escalation with no surfaced error. Surface it
    // LOUDLY at boot (critical log + email) naming the exact column so it is
    // instantly actionable (`prisma migrate deploy`). Fail-open — never blocks
    // boot; the per-pass diagnostics rating keeps it visible until resolved.
    try {
      const { checkSchemaIntegrity, summarizeDrift } =
        await import("../src/lib/admin-worker/schema-integrity");
      const schema = await checkSchemaIntegrity(prisma);
      if (!schema.ok) {
        const detail = summarizeDrift(schema);
        console.error(`[admin-worker:${args.workerId}] SCHEMA DRIFT — ${detail}`);
        await writeAdminWorkerLog(prisma, {
          category: "OVERVIEW",
          severity: "ERROR",
          eventName: "schema_drift_detected",
          message: detail,
          safeMetadata: { drifts: JSON.parse(JSON.stringify(schema.drifts)) },
        }).catch(() => undefined);
        try {
          const { sendCriticalFailureAlert } = await import("../src/lib/email/admin-send");
          await sendCriticalFailureAlert({
            kind: "Database schema drift — publishing is stalled",
            message: detail,
            context: Object.fromEntries(schema.drifts.map((d) => [d.model, d.detail])),
          });
        } catch {
          /* fail-open */
        }
      }
    } catch (err) {
      console.error(`[admin-worker:${args.workerId}] schema-integrity check failed:`, err);
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

    // Supervised: in continuous mode the loop is re-entered after a bounded
    // backoff if its machinery ever throws, so the worker self-heals in-process
    // rather than exiting the container (whose restart policy may back off).
    const maxPasses = args.maxJobs ?? Infinity;
    const supervised = await runLoopSupervised({
      workerId: args.workerId,
      oneShot: args.oneShot,
      maxPasses,
      runLoop: () =>
        runAdminWorkerLoop(prisma, {
          workerId: args.workerId,
          oneShot: args.oneShot,
          maxPasses,
        }),
      isShuttingDown: () => shuttingDown,
      log: (m) => console.log(m),
      errorLog: (m) => console.error(m),
      onLoopRestart: (detail) =>
        writeAdminWorkerLog(prisma, {
          category: "ERROR",
          severity: "ERROR",
          eventName: "worker_loop_restart",
          message: `Admin Worker loop threw and was restarted in-process: ${detail.slice(0, 480)}`,
        }).then(() => undefined),
    });
    // Distinct exit codes so the host / a wrapper can tell an operator's OFF
    // (0: clean, intended) from a lease take-over (5: another runtime now owns
    // execution) without parsing logs.
    if (supervised.stopReason === "switch_off") {
      console.log(`[admin-worker:${args.workerId}] master switch is OFF — exiting cleanly.`);
      process.exitCode = 0;
    } else if (supervised.stopReason === "lease_lost") {
      console.error(
        `[admin-worker:${args.workerId}] execution lease lost to another runtime — exiting.`,
      );
      process.exitCode = 5;
    }
  } finally {
    shutdownBrain();
    // Release the lease so the next local launch can claim it immediately
    // (a stale lease would otherwise block until its TTL expires).
    await releaseExecutionLease(prisma, args.workerId).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[admin-worker] fatal:", err);
  process.exitCode = 1;
});
