#!/usr/bin/env tsx
/**
 * Via Fidei — LOCAL Admin Worker host.
 *
 * This is the process the native Via Fidei application launches when the
 * operator flips the Admin Worker switch to ON. It is the Admin Worker's body
 * on the operator's MacBook:
 *
 *   - it claims the single execution lease in Postgres (spec §25),
 *   - it supervises the real worker loop as a child process — the same
 *     `scripts/run-worker.ts` that used to run on Railway, now running here,
 *     with the Python brain, headless browser and every existing capability,
 *   - it executes operator-triggered work (manual passes, homepage makeover,
 *     file ingestion, reports) IN THIS PROCESS, on local CPU (spec §12),
 *   - it serves the Admin Worker command center + a JSON control API on
 *     127.0.0.1 only, authenticated with a per-launch token.
 *
 * It never opens an inbound port to the internet (spec acceptance §30): the
 * listener is bound to the loopback interface, the port is ephemeral, and the
 * token is generated per launch and handed to the parent process on stdout.
 *
 * No new environment variables: database connectivity, email, URLs and every
 * other credential come from the repository's existing configuration exactly
 * as the Railway worker read them.
 *
 * Usage:
 *   tsx scripts/local-worker-host.ts            # bind an ephemeral port
 *   tsx scripts/local-worker-host.ts --port N   # bind a fixed local port
 */

import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { cpus } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { markWorkerExecutionOrigin } from "../src/lib/admin-worker/execution-context";

// Claim the local execution origin BEFORE anything from the worker library is
// imported and evaluated, so every guard in the tree sees the right runtime.
markWorkerExecutionOrigin("LOCAL_MACBOOK");

/**
 * Where this runtime's configuration came from — captured BEFORE anything
 * imports @prisma/client, because Prisma loads the repository .env itself and
 * would otherwise mask the distinction.
 *
 * Verified precedence: Prisma does NOT overwrite a variable already present in
 * the environment, so values injected by `railway run` win and a local .env is
 * only the fallback. That is what lets Railway stay the single source of truth
 * with nothing re-entered on this computer.
 */
const CONFIG_AT_BOOT = {
  source: process.env.VIAFIDEI_CONFIG_SOURCE ?? "direct",
  // Recorded by the launcher BEFORE node starts, because it cannot be recovered
  // here: ES imports are hoisted, so @prisma/client has already loaded the
  // repository .env into process.env by the time this line executes, which
  // makes a local .env indistinguishable from an injected environment.
  // null means "launched directly, so genuinely unknown" — not "no".
  databaseUrlFromEnvironment:
    process.env.VIAFIDEI_DB_FROM_ENV === "1"
      ? true
      : process.env.VIAFIDEI_DB_FROM_ENV === "0"
        ? false
        : null,
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? null,
};

import {
  acquireExecutionLease,
  readExecutionStatus,
  readMasterSwitch,
  releaseExecutionLease,
  renewExecutionLease,
  setMasterSwitch,
  LEASE_RENEW_INTERVAL_MS,
  type ExecutionStatus,
} from "../src/lib/admin-worker/execution-host";
import {
  computeLocalConfig,
  leaseRenewDelayMs,
  resolvePublicBaseUrl,
  summarizeDatabaseError,
  type DatabaseProbe,
} from "../src/lib/admin-worker/local-config";
import {
  describeWorkerExitKind,
  interpretWorkerExit,
  LEASE_HELD_ELSEWHERE_MESSAGE,
} from "../src/lib/admin-worker/worker-exit";
import { localHostLabel, sampleLocalResources } from "../src/lib/admin-worker/local-resources";
import { loadCommandCenterSnapshot } from "../src/lib/admin-worker/command-center";
import { writeAdminWorkerLog } from "../src/lib/admin-worker/logs";
import { MAX_FILE_BYTES } from "../src/lib/admin-worker/file-extractors";
import { writeHeartbeat } from "../src/lib/admin-worker/state";
import { appConfig } from "../src/lib/config";
import { prisma } from "../src/lib/db/client";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const DASHBOARD_HTML = path.join(REPO_ROOT, "scripts", "desktop-app", "dashboard.html");

const RUNTIME_ID = `local-macbook-${process.pid}-${Date.now().toString(36)}`;
const CONTROL_TOKEN = randomBytes(32).toString("hex");
const MAX_BODY_BYTES = MAX_FILE_BYTES + 1024;
const LOG_RING_SIZE = 800;

/* ------------------------------------------------------------------ */
/* supervisor state                                                     */
/* ------------------------------------------------------------------ */

type RunState = "off" | "starting" | "running" | "stopping" | "crashed" | "failed";

/** Give up after this many consecutive crashes rather than looping forever. */
const MAX_CONSECUTIVE_RESTARTS = 5;
/** SIGTERM grace for the worker tree before the whole group is SIGKILLed. */
const CHILD_KILL_GRACE_MS = 5_000;
/** Longest any database call may hold up a shutdown or an OFF request. */
const SHUTDOWN_DB_BUDGET_MS = 3_000;
/** How long a cached execution status (switch + lease) is served for. */
const EXECUTION_CACHE_MS = 5_000;
/** With the worker OFF the command-center snapshot is refreshed at most this often. */
const SNAPSHOT_OFF_INTERVAL_MS = 300_000;

interface HostState {
  runState: RunState;
  child: ChildProcess | null;
  startedAt: number | null;
  restarts: number;
  lastExit: { code: number | null; signal: string | null; at: number } | null;
  lastError: string | null;
  /** Set when the host has stopped trying to keep the worker alive. */
  failureReason: string | null;
  /**
   * The worker is not running here because ANOTHER runtime holds the
   * execution lease (exit 3 at boot with the switch ON, or exit 5 mid-run).
   * Surfaced to the app/dashboard so "failed" is never mistaken for a crash.
   */
  leaseHeldElsewhere: boolean;
  activeJobs: Set<string>;
  itemsProcessed: number;
  itemsPublished: number;
  errors: number;
  /**
   * The operator switched OFF while the database was unreachable: the local
   * tree is already stopped, and the durable OFF (switch row + lease release)
   * still has to be written. Retried from the lease tick until it lands.
   */
  pendingDurableOff: boolean;
}

const host: HostState = {
  runState: "off",
  child: null,
  startedAt: null,
  restarts: 0,
  lastExit: null,
  lastError: null,
  failureReason: null,
  leaseHeldElsewhere: false,
  activeJobs: new Set(),
  itemsProcessed: 0,
  itemsPublished: 0,
  errors: 0,
  pendingDurableOff: false,
};

const logRing: Array<{ at: string; stream: "worker" | "host"; line: string }> = [];
let snapshotInFlight = false;
let lastSnapshot: unknown = null;
let lastSnapshotAt = 0;
const sseClients = new Set<ServerResponse>();

/**
 * Cached durable execution status (master switch + lease). With the worker
 * OFF the app, the dashboard and the SSE stream all want this, and each read
 * is two round-trips to production over the public proxy. One read every
 * EXECUTION_CACHE_MS, shared by everyone, is plenty for a monitoring screen.
 */
let executionCache: {
  value: ExecutionStatus | null;
  at: number;
  inFlight: Promise<ExecutionStatus> | null;
} = {
  value: null,
  at: 0,
  inFlight: null,
};

async function readExecutionStatusCached(maxAgeMs = EXECUTION_CACHE_MS): Promise<ExecutionStatus> {
  const fresh = executionCache.value && Date.now() - executionCache.at < maxAgeMs;
  if (fresh && executionCache.value) return executionCache.value;
  if (executionCache.inFlight) return executionCache.inFlight;
  const pending = readExecutionStatus(prisma)
    .then((value) => {
      executionCache = { value, at: Date.now(), inFlight: null };
      return value;
    })
    .catch((err: unknown) => {
      executionCache.inFlight = null;
      if (executionCache.value) return executionCache.value;
      throw err;
    });
  executionCache.inFlight = pending;
  return pending;
}

/** Forget the cached status after a write so the next read reflects it. */
function invalidateExecutionCache(): void {
  executionCache = { value: null, at: 0, inFlight: null };
}

function pushLog(stream: "worker" | "host", line: string): void {
  const entry = { at: new Date().toISOString(), stream, line: line.slice(0, 2000) };
  logRing.push(entry);
  if (logRing.length > LOG_RING_SIZE) logRing.splice(0, logRing.length - LOG_RING_SIZE);
  broadcast("log", entry);
  if (stream === "host") console.log(`[local-host] ${line}`);
}

function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

/* ------------------------------------------------------------------ */
/* worker child supervision                                             */
/* ------------------------------------------------------------------ */

function tsxBinary(): { cmd: string; prefix: string[] } {
  const local = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");
  if (existsSync(local)) return { cmd: local, prefix: [] };
  return { cmd: "npx", prefix: ["--yes", "tsx"] };
}

function startWorkerChild(): void {
  if (host.child) return;
  const { cmd, prefix } = tsxBinary();
  const args = [
    ...prefix,
    path.join("scripts", "run-worker.ts"),
    "--origin",
    "local",
    "--worker-id",
    RUNTIME_ID,
  ];

  host.runState = "starting";
  ensurePublicBaseUrl();
  pushLog("host", `starting the Admin Worker loop locally (${cmd} ${args.join(" ")})`);

  // detached: the worker gets its own process group, so stopping the switch can
  // take down the whole tree — worker, Python brain, and any Chromium it
  // launched. OFF must genuinely mean OFF (spec §4).
  const child = spawn(cmd, args, {
    cwd: REPO_ROOT,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      // The launcher pins this supervisor's pool at 3; the worker does the
      // real work and gets the full pool (lanes concurrency 8 + pass + heartbeat).
      PRISMA_CONNECTION_LIMIT: process.env.VIAFIDEI_WORKER_CONNECTION_LIMIT ?? "10",
      // The host renews the lease (with jitter) and writes the heartbeat on
      // its tick; the child only needs to CHECK the lease, not rewrite it.
      VIAFIDEI_LEASE_RENEWED_BY_HOST: "1",
    },
  });

  host.child = child;
  host.startedAt = Date.now();
  host.runState = "running";
  // If it stays up for a while, treat the crash streak as over.
  setTimeout(() => {
    if (host.child === child && host.runState === "running") host.restarts = 0;
  }, 120_000).unref();

  const onLine = (chunk: Buffer) => {
    for (const line of chunk.toString("utf8").split("\n")) {
      const trimmed = line.trimEnd();
      if (!trimmed) continue;
      pushLog("worker", trimmed);
      if (/published/i.test(trimmed)) host.itemsPublished += 1;
      if (/\bpass \d+|dispatch|stage/i.test(trimmed)) host.itemsProcessed += 1;
      if (/error|failed|fatal/i.test(trimmed)) host.errors += 1;
    }
  };
  child.stdout?.on("data", onLine);
  child.stderr?.on("data", onLine);

  child.on("exit", (code, signal) => {
    host.child = null;
    host.lastExit = { code, signal, at: Date.now() };
    const wasStopping = host.runState === "stopping";
    // Decide synchronously from the exit code (worker-exit.ts) so the state can
    // never lag behind a restart that begins meanwhile. Exit 3 (refused) is
    // provisionally "lease held elsewhere"; the durable switch, read below,
    // downgrades it to a plain operator OFF when that is what it was.
    const plan = interpretWorkerExit({
      code,
      signal,
      wasStopping,
      switchOn: null,
      databaseHost: configPayload().databaseHost,
    });
    host.runState = plan.runState;
    host.failureReason = plan.failureReason;
    host.leaseHeldElsewhere = plan.leaseHeldElsewhere;
    pushLog(
      "host",
      `worker process exited (code=${code ?? "null"}, signal=${signal ?? "none"})` +
        `${plan.kind === "crashed" ? " unexpectedly" : ` — ${describeWorkerExitKind(plan.kind)}`}`,
    );
    if (plan.failureReason) pushLog("host", plan.failureReason);
    // The other holder is now the truth every surface should show.
    if (plan.leaseHeldElsewhere) invalidateExecutionCache();
    broadcast("status", statusPayload());
    if (wasStopping || shuttingDown) return;

    void (async () => {
      if (plan.kind === "refused") {
        // Only the durable switch tells an operator OFF (nothing to report)
        // from a live lease on another computer (surface it, never restart).
        const master = await readMasterSwitch(prisma).catch(
          () => ({ on: false, known: false }) as const,
        );
        if (host.child || shuttingDown) return; // a newer child's state wins
        const refined = interpretWorkerExit({
          code,
          signal,
          wasStopping: false,
          switchOn: master.known ? master.on : null,
        });
        host.runState = refined.runState;
        host.failureReason = refined.failureReason;
        host.leaseHeldElsewhere = refined.leaseHeldElsewhere;
        if (refined.runState === "off") {
          pushLog(
            "host",
            "the master switch is OFF — the worker declined to start (operator stop)",
          );
        }
        broadcast("status", statusPayload());
        return;
      }
      if (!plan.restart) return;
      if (plan.kind === "db_unreachable") {
        // run-worker.ts exit 4: it could not read the switch. That is an
        // outage, not a crash — do not burn the restart budget; wait for the
        // database and resume (the switch is durable, so ON survives).
        void probeDatabase().catch(() => undefined);
        setTimeout(
          () => {
            if (!shuttingDown && !host.child) void resumeIfSwitchOn();
          },
          30_000 + Math.round(Math.random() * 30_000),
        ).unref();
        return;
      }
      // A genuine crash: restart locally when the master switch is still ON —
      // but never hand the work back to Railway (spec §5: no cloud failover).
      {
        const master = await readMasterSwitch(prisma).catch(
          () => ({ on: false, known: false }) as const,
        );
        if (shuttingDown) return;
        if (!master.known) {
          // The database is unreachable: neither restart-loop nor give up. Wait
          // for it to come back and re-check (the lease tick keeps probing).
          host.runState = "crashed";
          host.failureReason =
            "The worker stopped and the database cannot be reached right now — it will be restarted when the database answers again.";
          pushLog("host", host.failureReason);
          broadcast("status", statusPayload());
          setTimeout(() => {
            if (!shuttingDown && !host.child) void resumeIfSwitchOn();
          }, 30_000).unref();
          return;
        }
        if (!master.on) return;
        host.restarts += 1;

        if (host.restarts > MAX_CONSECUTIVE_RESTARTS) {
          // Stop pretending. A worker that dies on every launch (missing Python,
          // bad DATABASE_URL, no Chromium) must surface as a failure rather than
          // an eternally-restarting "active" worker.
          host.runState = "failed";
          host.failureReason =
            `The local Admin Worker exited ${host.restarts} times in a row ` +
            `(last: code=${code ?? "null"}, signal=${signal ?? "none"}). Giving up — ` +
            `check the runtime log, then switch the Admin Worker off and on again.`;
          pushLog("host", host.failureReason);
          await writeAdminWorkerLog(prisma, {
            category: "ERROR",
            severity: "ERROR",
            eventName: "local_worker_gave_up",
            message: host.failureReason,
            safeMetadata: { restarts: host.restarts, runtimeId: RUNTIME_ID },
          }).catch(() => undefined);
          // Release the lease so no surface claims this machine is executing.
          await releaseExecutionLease(prisma, RUNTIME_ID).catch(() => undefined);
          broadcast("status", statusPayload());
          return;
        }

        const backoffMs = Math.min(60_000, 2_000 * host.restarts);
        pushLog(
          "host",
          `master switch is still ON — restarting the local worker in ${Math.round(backoffMs / 1000)}s (restart #${host.restarts})`,
        );
        await writeAdminWorkerLog(prisma, {
          category: "ERROR",
          severity: "WARN",
          eventName: "local_worker_restart",
          message: `Local Admin Worker runtime exited (code=${code ?? "null"}, signal=${signal ?? "none"}) and is being restarted on the operator MacBook. Execution was NOT moved to the cloud.`,
          safeMetadata: { restarts: host.restarts, runtimeId: RUNTIME_ID },
        }).catch(() => undefined);
        setTimeout(() => {
          if (!shuttingDown) startWorkerChild();
        }, backoffMs).unref();
      }
    })();
  });

  child.on("error", (err) => {
    host.lastError = err.message;
    host.runState = "failed";
    host.failureReason =
      `Could not start the Admin Worker process: ${err.message}. ` +
      `Check that Node and this repository's dependencies are installed (npm install).`;
    pushLog("host", host.failureReason);
    broadcast("status", statusPayload());
  });
}

async function stopWorkerChild(reason: string): Promise<void> {
  const child = host.child;
  if (!child || child.pid == null) {
    host.runState = "off";
    return;
  }
  host.runState = "stopping";
  pushLog("host", `stopping the local Admin Worker (${reason})`);

  const pid = child.pid;
  const killGroup = (signal: NodeJS.Signals) => {
    try {
      process.kill(-pid, signal); // whole process group: worker + brain + browser
    } catch {
      try {
        child.kill(signal);
      } catch {
        /* already gone */
      }
    }
  };

  killGroup("SIGTERM");
  await new Promise<void>((resolve) => {
    // 5 s, not longer: the app's own quit deadline is 10 s and the DB release
    // that follows has its own budget — the tree must be gone well inside that.
    const timer = setTimeout(() => {
      killGroup("SIGKILL");
      resolve();
    }, CHILD_KILL_GRACE_MS);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  host.child = null;
  host.runState = "off";
}

/**
 * Bound a best-effort database write so an unreachable proxy can never hold
 * up an OFF request or a shutdown. Resolves false on timeout or error.
 */
async function withDbBudget(label: string, work: () => Promise<unknown>): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`${label} did not finish within ${SHUTDOWN_DB_BUDGET_MS / 1000}s`)),
          SHUTDOWN_DB_BUDGET_MS,
        );
      }),
    ]);
    return true;
  } catch (err) {
    pushLog("host", `${label} failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Write the durable OFF (switch row, lease release, audit log). Called right
 * after the local tree is stopped and, when that failed, again from the lease
 * tick until the database accepts it.
 */
async function writeDurableOff(actor: string): Promise<boolean> {
  const wroteSwitch = await withDbBudget("recording the switch OFF", () =>
    setMasterSwitch(prisma, { on: false, actor, from: "swift-app" }),
  );
  const released = await withDbBudget("releasing the execution lease", () =>
    releaseExecutionLease(prisma, RUNTIME_ID),
  );
  invalidateExecutionCache();
  if (!wroteSwitch || !released) {
    host.pendingDurableOff = true;
    return false;
  }
  host.pendingDurableOff = false;
  await writeAdminWorkerLog(prisma, {
    category: "OVERVIEW",
    severity: "INFO",
    eventName: "local_worker_deactivated",
    message:
      "Admin Worker switched OFF. The local runtime, Python brain and browser rendering were stopped. " +
      "No cloud worker takes over.",
    safeMetadata: { runtimeId: RUNTIME_ID },
  }).catch(() => undefined);
  return true;
}

/**
 * After a database outage: if the switch is still ON (a durable fact we can
 * now read again), start the worker; otherwise stay off. Used by the
 * crash-handler's deferred retry so an outage never ends in "gave up".
 */
async function resumeIfSwitchOn(): Promise<void> {
  const master = await readMasterSwitch(prisma).catch(() => ({ on: false, known: false }) as const);
  if (!master.known) {
    setTimeout(() => {
      if (!shuttingDown && !host.child) void resumeIfSwitchOn();
    }, 30_000).unref();
    return;
  }
  if (master.on && !host.child) {
    host.failureReason = null;
    host.leaseHeldElsewhere = false;
    pushLog("host", "database reachable again and the switch is ON — restarting the worker");
    startWorkerChild();
  } else if (!master.on) {
    host.runState = "off";
    host.failureReason = null;
    broadcast("status", statusPayload());
  }
}

/**
 * Stop the resident Python intelligence brain this process holds. The host runs
 * operator-triggered work in-process (file ingestion, manual passes, homepage
 * makeovers), which brings the brain online here as well as in the worker
 * child — so switching the Admin Worker off has to close both.
 */
async function shutdownLocalBrain(): Promise<void> {
  try {
    const { shutdownBrain } = await import("../src/lib/admin-worker/intelligence");
    shutdownBrain();
    pushLog("host", "local Python intelligence brain shut down");
  } catch {
    /* the brain was never started here */
  }
}

/* ------------------------------------------------------------------ */
/* status                                                              */
/* ------------------------------------------------------------------ */

/**
 * Resident size + CPU of the supervised worker child (and its own children: the
 * Python brain and any Chromium), read from the OS. Without this the dashboard
 * would report only the small supervisor process and understate what the
 * machine is actually doing — which is the opposite of spec §20's intent.
 * Sampled on a timer rather than per request so a poll never blocks on `ps`.
 */
let workerProcessSample: { rssBytes: number; cpuPercent: number; processes: number } | null = null;

function sampleWorkerProcessTree(): void {
  const pid = host.child?.pid;
  if (pid == null) {
    workerProcessSample = null;
    return;
  }
  // `ps` is cheap, universally present on macOS, and needs no dependency.
  execFile(
    "/bin/ps",
    ["-Ao", "pid=,ppid=,rss=,pcpu="],
    { timeout: 4_000, maxBuffer: 4 * 1024 * 1024 },
    (err, stdout) => {
      if (err) return;
      const rows: Array<{ pid: number; ppid: number; rss: number; cpu: number }> = [];
      for (const line of stdout.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;
        const [p, pp, rss, cpu] = parts.map(Number);
        if (!Number.isFinite(p)) continue;
        rows.push({ pid: p, ppid: pp, rss, cpu });
      }
      // Walk the tree from the worker child downwards (brain, browser, helpers).
      const byParent = new Map<number, Array<{ pid: number; rss: number; cpu: number }>>();
      for (const r of rows) {
        const list = byParent.get(r.ppid) ?? [];
        list.push({ pid: r.pid, rss: r.rss, cpu: r.cpu });
        byParent.set(r.ppid, list);
      }
      let rssKb = 0;
      let cpu = 0;
      let processes = 0;
      const stack = [pid];
      const seen = new Set<number>();
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (seen.has(current)) continue;
        seen.add(current);
        const self = rows.find((r) => r.pid === current);
        if (self) {
          rssKb += self.rss;
          cpu += self.cpu;
          processes += 1;
        }
        for (const child of byParent.get(current) ?? []) stack.push(child.pid);
      }
      workerProcessSample =
        processes > 0
          ? { rssBytes: rssKb * 1024, cpuPercent: Number(cpu.toFixed(1)), processes }
          : null;
    },
  );
}

/**
 * Result of the last database preflight. The worker must never be started
 * against a database that cannot be reached: it would crash-loop five times,
 * release the lease and report "failed" with a stack trace, when the real
 * problem is one line of configuration. Probed at boot, before every switch-ON,
 * and on demand from the console.
 */
let dbProbe: DatabaseProbe = {
  reachable: false,
  latencyMs: null,
  error: "not checked yet",
  at: new Date(0).toISOString(),
};

async function probeDatabase(timeoutMs = 15_000): Promise<DatabaseProbe> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`no answer from the database within ${timeoutMs / 1000}s`)),
          timeoutMs,
        );
      }),
    ]);
    dbProbe = {
      reachable: true,
      latencyMs: Date.now() - started,
      error: null,
      at: new Date().toISOString(),
    };
  } catch (err) {
    dbProbe = {
      reachable: false,
      latencyMs: null,
      // The cause line only (never a stack, never credentials) — see local-config.
      error: summarizeDatabaseError(err),
      at: new Date().toISOString(),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
  return dbProbe;
}

/**
 * Where published pages are verified: explicit PUBLIC_BASE_URL, else the
 * Railway public domain the launcher derived, else — for a remote database in
 * the production environment only — the canonical origin. Applied to this
 * process (operator work runs in-process) and inherited by the worker child.
 * The decision itself lives in local-config.ts so it is testable.
 */
function ensurePublicBaseUrl(): void {
  if (process.env.PUBLIC_BASE_URL) return;
  const resolved = resolvePublicBaseUrl({
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
    databaseUrl: process.env.DATABASE_URL,
    railwayEnvironmentName: process.env.RAILWAY_ENVIRONMENT_NAME,
    canonicalUrl: appConfig.canonicalUrl,
  });
  if (resolved) process.env.PUBLIC_BASE_URL = resolved;
}

/**
 * Non-sensitive description of the effective configuration: which source it
 * came from, which database host it points at (host and database name only —
 * never the credentials), whether that database answered, where published
 * pages will be verified, and the one structured reason (if any) the worker
 * may not start. Surfaced in the app so a misconfiguration is visible rather
 * than silently wrong.
 */
function configPayload() {
  return computeLocalConfig({
    databaseUrl: process.env.DATABASE_URL,
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
    source: CONFIG_AT_BOOT.source,
    route: process.env.VIAFIDEI_DB_ROUTE ?? "unknown",
    databaseUrlFromEnvironment: CONFIG_AT_BOOT.databaseUrlFromEnvironment,
    probe: dbProbe,
    railwayEnvironmentName: process.env.RAILWAY_ENVIRONMENT_NAME,
    launcherMessage: process.env.VIAFIDEI_LAUNCHER_MESSAGE,
  });
}

/** The worker child's pid and process group, so the app can verify nothing is left after quit. */
function childProcessInfo(): { pid: number; pgid: number } | null {
  const pid = host.child?.pid;
  // Spawned `detached`, so the child leads its own process group: pgid === pid.
  return pid != null ? { pid, pgid: pid } : null;
}

function statusPayload() {
  const resources = sampleLocalResources(workerProcessSample?.rssBytes ?? null);
  return {
    runtimeId: RUNTIME_ID,
    runState: host.runState,
    failureReason: host.failureReason,
    leaseHeldElsewhere: host.leaseHeldElsewhere,
    executionHost: "LOCAL_MACBOOK" as const,
    hostLabel: localHostLabel(),
    hostPid: process.pid,
    child: childProcessInfo(),
    startedAt: host.startedAt ? new Date(host.startedAt).toISOString() : null,
    uptimeMs: host.startedAt ? Date.now() - host.startedAt : 0,
    restarts: host.restarts,
    lastExit: host.lastExit,
    lastError: host.lastError,
    activeJobs: Array.from(host.activeJobs),
    config: configPayload(),
    // Durable switch + lease as last read (≤5 s old); null before the first
    // read. Carried in every SSE frame so the dashboard need not poll for it.
    execution: executionCache.value,
    executionAt: executionCache.at ? new Date(executionCache.at).toISOString() : null,
    pendingDurableOff: host.pendingDurableOff,
    counters: {
      itemsProcessed: host.itemsProcessed,
      itemsPublished: host.itemsPublished,
      errors: host.errors,
    },
    // What the WORKER (and its brain/browser children) is consuming, distinct
    // from this supervisor's own footprint.
    worker: workerProcessSample,
    // Headless-browser rendering activity + whether a browser is even usable
    // here (spec §20.4). Both matter: without a browser binary every JS-rendered
    // source silently degrades to its static shell.
    browser: browserStatus,
    resources,
  };
}

let browserStatus: {
  available: boolean;
  detail: string;
  active: number;
  waiting: number;
  maxConcurrent: number;
} = { available: false, detail: "not checked yet", active: 0, waiting: 0, maxConcurrent: 1 };

/**
 * Check whether headless rendering can actually work on this machine, and keep
 * the live render counters fresh. The cloud image installed Chromium at build
 * time; a laptop has to be told to, so the honest thing is to check and say so
 * rather than let every JS-rendered source quietly fall back to its static
 * shell.
 */
async function refreshBrowserStatus(): Promise<void> {
  try {
    const { browserRenderActivity, chromiumStatus } =
      await import("../src/lib/admin-worker/dynamic-fetcher");
    const activity = browserRenderActivity();
    const status = await chromiumStatus();
    const wasAvailable = browserStatus.available;
    browserStatus = { ...activity, available: status.available, detail: status.detail };
    if (!status.available && wasAvailable !== false) {
      pushLog("host", `headless browser rendering unavailable: ${status.detail}`);
    }
  } catch (err) {
    browserStatus = {
      ...browserStatus,
      available: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/* ------------------------------------------------------------------ */
/* HTTP control surface (loopback only)                                 */
/* ------------------------------------------------------------------ */

function constantTimeEquals(supplied: string): boolean {
  const a = Buffer.from(supplied);
  const b = Buffer.from(CONTROL_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Bearer token per launch. The EventSource API cannot set headers, so the
 * dashboard's SSE stream passes the same token as a query parameter — safe
 * here because the listener is loopback-only and the token never leaves this
 * machine.
 */
function authorized(req: IncomingMessage, url: URL): boolean {
  const header = req.headers.authorization ?? "";
  if (header.startsWith("Bearer ") && constantTimeEquals(header.slice(7))) return true;
  const queryToken = url.searchParams.get("token");
  return queryToken != null && constantTimeEquals(queryToken);
}

function isLoopback(req: IncomingMessage): boolean {
  const addr = req.socket.remoteAddress ?? "";
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > MAX_BODY_BYTES) throw new Error("request body too large");
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const body = await readBody(req);
  return body.length ? (JSON.parse(body.toString("utf8")) as T) : ({} as T);
}

/**
 * Operator-triggered work still obeys the master switch: OFF means no Admin
 * Worker workload runs anywhere, including work a button would start (spec §4).
 */
async function requireSwitchOn(res: ServerResponse): Promise<boolean> {
  const master = await readMasterSwitch(prisma).catch(() => ({ on: false }) as const);
  if (master.on) return true;
  json(res, 409, {
    error: "worker_off",
    detail:
      "The Admin Worker master switch is OFF. Switch it on in the Via Fidei application before " +
      "starting worker work — nothing runs in the cloud in the meantime.",
  });
  return false;
}

/** Run an operator-triggered job locally, tracked so the dashboard shows it. */
async function withJob<T>(name: string, fn: () => Promise<T>): Promise<T> {
  host.activeJobs.add(name);
  broadcast("status", statusPayload());
  try {
    return await fn();
  } finally {
    host.activeJobs.delete(name);
    broadcast("status", statusPayload());
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isLoopback(req)) {
    res.writeHead(403).end("local only");
    return;
  }
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const route = url.pathname;

  // The dashboard page itself carries the token in its query string so the
  // WKWebView can load it; every API call then uses the Authorization header.
  if (route === "/" || route === "/dashboard") {
    if (url.searchParams.get("token") !== CONTROL_TOKEN) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const html = readFileSync(DASHBOARD_HTML, "utf8").replace("__CONTROL_TOKEN__", CONTROL_TOKEN);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:",
    });
    res.end(html);
    return;
  }

  if (route === "/health") {
    json(res, 200, { ok: true, runtimeId: RUNTIME_ID, runState: host.runState });
    return;
  }

  if (!authorized(req, url)) {
    json(res, 401, { error: "unauthorized" });
    return;
  }

  try {
    switch (`${req.method} ${route}`) {
      case "GET /api/status": {
        const execution = await readExecutionStatusCached();
        json(res, 200, { ...statusPayload(), execution });
        return;
      }

      case "GET /api/snapshot": {
        // The console polls this. Three guards keep an open window from
        // becoming a workload of its own: never refresh goals (a write) unless
        // asked; never run two snapshots at once — a slow remote database
        // would otherwise stack them up; and with the worker OFF serve the
        // last snapshot for up to five minutes (~30 queries per refresh
        // against production, for a screen that reads "OFF") unless the
        // operator presses Refresh (?refresh=1).
        const forced = url.searchParams.get("refresh") === "1";
        if (snapshotInFlight) {
          json(res, 200, { ...(lastSnapshot ?? {}), reusedInFlight: true });
          return;
        }
        const idle = host.runState === "off" && executionCache.value?.state === "OFF";
        if (
          !forced &&
          idle &&
          lastSnapshot &&
          Date.now() - lastSnapshotAt < SNAPSHOT_OFF_INTERVAL_MS
        ) {
          json(res, 200, {
            ...(lastSnapshot as object),
            cached: true,
            snapshotAgeMs: Date.now() - lastSnapshotAt,
          });
          return;
        }
        snapshotInFlight = true;
        try {
          const snapshot = await withJob("command-center-snapshot", () =>
            loadCommandCenterSnapshot(prisma, { refreshGoals: forced }),
          );
          lastSnapshot = snapshot;
          lastSnapshotAt = Date.now();
          json(res, 200, snapshot);
        } finally {
          snapshotInFlight = false;
        }
        return;
      }

      case "GET /api/logs": {
        const limit = Number(url.searchParams.get("limit") ?? 200);
        json(res, 200, { lines: logRing.slice(-Math.min(LOG_RING_SIZE, Math.max(1, limit))) });
        return;
      }

      case "GET /api/db-check": {
        const probe = await withJob("database-check", () => probeDatabase());
        json(res, 200, { ...probe, config: configPayload() });
        return;
      }

      case "POST /api/switch": {
        const body = await readJson<{ on?: boolean; actor?: string }>(req);
        const on = body.on === true;
        if (on) {
          // Preflight: never start a worker against a database that does not
          // answer (or a local one masquerading as production). The refusal is
          // the whole message — the switch stays OFF and the reason is shown.
          // `blockingReason` is structured (local-config.ts), never a regex
          // over warning prose, so a reworded warning cannot disarm the gate.
          const probe = await probeDatabase();
          const cfg = configPayload();
          if (cfg.blockingReason || !probe.reachable) {
            json(res, 503, {
              error: "database_unavailable",
              blockingReason: cfg.blockingReason ?? "unreachable",
              detail:
                cfg.warnings.find((w) => !cfg.launcherMessage || w !== cfg.launcherMessage) ??
                cfg.launcherMessage ??
                `The database at ${cfg.databaseHost ?? "?"} is not answering: ${probe.error ?? "unreachable"}. The Admin Worker was not started.`,
            });
            return;
          }
          host.pendingDurableOff = false;
          // Claim the lease FIRST. The master switch is shared state: if another
          // computer is already executing, writing the switch here (and then
          // rolling it back to OFF) would stop that machine's worker mid-pass.
          const claim = await acquireExecutionLease(prisma, {
            runtimeId: RUNTIME_ID,
            origin: "LOCAL_MACBOOK",
            host: {
              label: localHostLabel(),
              platform: process.platform,
              arch: process.arch,
              cpuCount: cpus().length,
              launchedBy: "swift-app",
            },
          });
          if (!claim.acquired) {
            // Leave the switch exactly as it was — the other computer keeps working.
            json(res, 409, {
              error: "lease_unavailable",
              detail:
                `${claim.refusedBecause ?? "Another runtime holds the execution lease."} ` +
                `Switch the Admin Worker OFF there first; nothing was changed here.`,
            });
            return;
          }
          await setMasterSwitch(prisma, {
            on: true,
            actor: body.actor ?? "operator",
            from: "swift-app",
          });
          invalidateExecutionCache();
          host.restarts = 0;
          host.failureReason = null;
          host.leaseHeldElsewhere = false;
          startWorkerChild();
          await writeAdminWorkerLog(prisma, {
            category: "OVERVIEW",
            severity: "INFO",
            eventName: "local_worker_activated",
            message: `Admin Worker switched ON. Active execution host: ${localHostLabel()} (local MacBook runtime ${RUNTIME_ID}).`,
            safeMetadata: { runtimeId: RUNTIME_ID, origin: "LOCAL_MACBOOK" },
          }).catch(() => undefined);
        } else {
          // Stop the LOCAL workload first — it is purely local and cannot fail
          // on the network. Only then record OFF durably, best-effort: an
          // unreachable proxy must never leave Chromium, Python and the
          // fetchers running because a row could not be written. The durable
          // write is retried from the lease tick until it lands.
          await stopWorkerChild("master switch OFF");
          // The host itself keeps a resident Python brain while it runs
          // operator work (ingestion, manual passes, makeovers). OFF means OFF:
          // shut that down too, so no intelligence process survives the switch.
          await shutdownLocalBrain();
          host.failureReason = null;
          const durable = await writeDurableOff(body.actor ?? "operator");
          if (!durable) {
            pushLog(
              "host",
              "stopped locally; could not record OFF in the database — it will be retried until it lands",
            );
            const execution = await readExecutionStatusCached().catch(() => null);
            broadcast("status", statusPayload());
            json(res, 200, {
              ...statusPayload(),
              execution,
              durableSwitchWrite: false,
              detail:
                "Stopped locally. The database could not be reached to record OFF — the local worker is stopped and the switch will be recorded as OFF automatically when the database answers again.",
            });
            return;
          }
        }
        const execution = await readExecutionStatusCached(0);
        broadcast("status", statusPayload());
        json(res, 200, { ...statusPayload(), execution, durableSwitchWrite: true });
        return;
      }

      case "POST /api/pass": {
        if (!(await requireSwitchOn(res))) return;
        const body = await readJson<{ passType?: string }>(req);
        const passType = (body.passType ?? "").trim();
        const { FORCED_OPERATOR_PASSES, runOperatorPass } =
          await import("../src/lib/admin-worker/operator-passes");
        const { runCleanupPass, runOnePass } = await import("../src/lib/admin-worker");

        if (passType === "cleanup") {
          const out = await withJob("pass:cleanup", () => runCleanupPass(prisma));
          json(res, 200, { ok: true, kind: "cleanup", result: out });
          return;
        }
        if (passType === "content_goal") {
          const out = await withJob("pass:content_goal", () => runOnePass(prisma, RUNTIME_ID));
          json(res, 200, { ok: true, kind: "loop_pass", result: out });
          return;
        }
        if (!FORCED_OPERATOR_PASSES.includes(passType as never)) {
          json(res, 400, {
            error: "invalid_pass",
            allowed: [...FORCED_OPERATOR_PASSES, "content_goal", "cleanup"],
          });
          return;
        }
        const result = await withJob(`pass:${passType}`, () =>
          runOperatorPass(prisma, passType as never, {
            workerId: RUNTIME_ID,
            source: "operator",
          }),
        );
        json(res, 200, { ok: result.ok, kind: "operator_pass", result });
        return;
      }

      case "POST /api/homepage-makeover": {
        if (!(await requireSwitchOn(res))) return;
        const { redesignHomepage } = await import("../src/lib/admin-worker/homepage-mutator");
        const { createTask } = await import("../src/lib/admin-worker/tasks");
        const task = await createTask(prisma, {
          taskType: "UPDATE_HOMEPAGE",
          priority: "HOMEPAGE",
          plannedAction: "Homepage makeover requested from the local command center",
          metadata: { requestedFrom: "swift-app", runtimeId: RUNTIME_ID },
        }).catch(() => null);
        const result = await withJob("homepage-makeover", () =>
          redesignHomepage(prisma, { mode: "ADMIN_REQUESTED", force: true }),
        );
        json(res, 200, { taskId: task?.id ?? null, ...result });
        return;
      }

      case "POST /api/ingest": {
        if (!(await requireSwitchOn(res))) return;
        const filename = String(req.headers["x-filename"] ?? "upload.bin");
        const operator = String(req.headers["x-operator"] ?? "operator");
        const note = req.headers["x-note"] ? String(req.headers["x-note"]) : null;
        const buffer = await readBody(req);
        const { ingestOperatorFile } = await import("../src/lib/admin-worker/file-ingest");
        const result = await withJob(`ingest:${filename}`, () =>
          ingestOperatorFile(prisma, {
            filename: decodeURIComponent(filename),
            buffer,
            operator,
            note,
          }),
        );
        json(res, 200, result);
        return;
      }

      case "POST /api/report": {
        if (!(await requireSwitchOn(res))) return;
        const body = await readJson<{ period?: string }>(req);
        const period = (body.period ?? "LAST_30_DAYS") as
          | "LAST_24_HOURS"
          | "LAST_7_DAYS"
          | "LAST_30_DAYS";
        const { generateAdminWorkerDeveloperAuditPdf } =
          await import("../src/lib/admin-worker/pdf");
        const { pdf } = await withJob(`report:${period}`, () =>
          generateAdminWorkerDeveloperAuditPdf(prisma, period, "local-command-center"),
        );
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Length": pdf.length,
          "Content-Disposition": `attachment; filename="admin-worker-audit-${period.toLowerCase()}.pdf"`,
        });
        res.end(pdf);
        return;
      }

      case "GET /api/events": {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
        });
        res.write(`event: status\ndata: ${JSON.stringify(statusPayload())}\n\n`);
        sseClients.add(res);
        req.on("close", () => sseClients.delete(res));
        return;
      }
    }

    // Parameterised routes.
    const draftMatch = /^\/api\/homepage-draft\/([\w-]+)$/.exec(route);
    if (draftMatch && req.method === "POST") {
      if (!(await requireSwitchOn(res))) return;
      const body = await readJson<{ action?: string }>(req);
      const id = draftMatch[1];
      const { applyHomepageDraft, discardHomepageDraft } =
        await import("../src/lib/admin-worker/homepage-designer");
      const result =
        body.action === "publish"
          ? await withJob(`homepage-draft:publish`, () => applyHomepageDraft(prisma, id))
          : await withJob(`homepage-draft:discard`, () => discardHomepageDraft(prisma, id));
      json(res, 200, result);
      return;
    }

    const reviewMatch = /^\/api\/review\/([\w-]+)$/.exec(route);
    if (reviewMatch && req.method === "POST") {
      if (!(await requireSwitchOn(res))) return;
      const body = await readJson<{ action?: string; note?: string; actor?: string }>(req);
      const { resolveReview } = await import("../src/lib/admin-worker/human-review");
      const result = await withJob("review-resolve", () =>
        resolveReview(prisma, reviewMatch[1], {
          status: body.action === "approve" ? "APPROVED" : "REJECTED",
          byUsername: body.actor ?? "operator",
          notes: body.note,
        }),
      );
      json(res, 200, result);
      return;
    }

    json(res, 404, { error: "not_found", route });
  } catch (err) {
    host.errors += 1;
    const message = err instanceof Error ? err.message : String(err);
    pushLog("host", `request ${route} failed: ${message}`);
    json(res, 500, { error: "internal", detail: message });
  }
}

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */

let shuttingDown = false;

async function main(): Promise<void> {
  const portArgIndex = process.argv.indexOf("--port");
  const port = portArgIndex >= 0 ? Number(process.argv[portArgIndex + 1] ?? 0) : 0;

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  // Never die silently: the parent application is watching stdout, so a listen
  // failure has to be said out loud or the operator just sees a blank console.
  server.on("error", (err: NodeJS.ErrnoException) => {
    const detail =
      err.code === "EADDRINUSE"
        ? `port ${port} is already in use — start the app again to pick a free port`
        : err.message;
    process.stdout.write(`${JSON.stringify({ viafideiLocalHostError: detail })}\n`);
    console.error(`[local-host] cannot listen: ${detail}`);
    process.exitCode = 1;
    void (async () => {
      await releaseExecutionLease(prisma, RUNTIME_ID).catch(() => undefined);
      await prisma.$disconnect().catch(() => undefined);
      process.exit(1);
    })();
  });

  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    const boundPort = typeof address === "object" && address ? address.port : port;
    // The parent (Swift) app reads exactly this line to learn where to connect.
    process.stdout.write(
      `${JSON.stringify({
        viafideiLocalHost: {
          port: boundPort,
          token: CONTROL_TOKEN,
          runtimeId: RUNTIME_ID,
          hostLabel: localHostLabel(),
          pid: process.pid,
        },
      })}\n`,
    );
    pushLog("host", `control surface listening on 127.0.0.1:${boundPort} (loopback only)`);
  });

  // Decide where published pages are verified BEFORE anything reads the
  // configuration (the worker child inherits this process's environment).
  ensurePublicBaseUrl();

  // Preflight the database once at boot so the console can say, in one line,
  // whether this Mac is actually talking to production.
  await probeDatabase();
  {
    const cfg = configPayload();
    pushLog(
      "host",
      `configuration source: ${cfg.source}; db via ${cfg.route}; database ${cfg.databaseHost ?? "NOT CONFIGURED"} ` +
        `${cfg.database.reachable ? `reachable in ${cfg.database.latencyMs}ms` : `UNREACHABLE (${cfg.database.error ?? "?"})`}` +
        `${cfg.publicBaseUrl ? `; verifying against ${cfg.publicBaseUrl}` : ""}`,
    );
    for (const warning of cfg.warnings) pushLog("host", `WARNING: ${warning}`);
    // Same rule the post-publish probe applies before touching a row: a
    // localhost origin against a remote database means no live verification
    // can run. Say so at boot, next to the origin line, instead of letting it
    // surface pass by pass as "verification deferred".
    try {
      const { probeOriginMismatch } = await import("../src/lib/admin-worker/post-publish-probe");
      const mismatch = probeOriginMismatch();
      if (mismatch) pushLog("host", `WARNING: post-publish verification is disabled — ${mismatch}`);
    } catch {
      /* diagnostics only */
    }
  }

  // Resume a previously-ON switch: if the operator left the worker ON and the
  // application is relaunched, pick the work back up where Postgres says it was.
  // Never resume against a database that is unreachable or plainly not
  // production — the switch is durable, so it stays ON and the console shows why.
  const master = await readMasterSwitch(prisma).catch(() => ({ on: false, known: false }) as const);
  const bootConfig = configPayload();
  if (master.on && (bootConfig.blockingReason || !bootConfig.database.reachable)) {
    host.runState = "failed";
    host.failureReason =
      bootConfig.warnings.find((w) => w !== bootConfig.launcherMessage) ??
      bootConfig.launcherMessage ??
      `The database at ${bootConfig.databaseHost ?? "?"} is not answering — the Admin Worker was not started.`;
    pushLog("host", `cannot resume: ${host.failureReason}`);
  } else if (master.on) {
    const claim = await acquireExecutionLease(prisma, {
      runtimeId: RUNTIME_ID,
      origin: "LOCAL_MACBOOK",
      host: {
        label: localHostLabel(),
        platform: process.platform,
        arch: process.arch,
        cpuCount: cpus().length,
        launchedBy: "swift-app",
      },
    });
    if (claim.acquired) {
      pushLog("host", "master switch was already ON — resuming local execution");
      startWorkerChild();
    } else {
      pushLog("host", `cannot resume: ${claim.refusedBecause ?? "execution lease unavailable"}`);
    }
  }

  // Keep the lease warm while this host owns execution, and push live status.
  // Self-rescheduling with ±20% jitter (local-config.ts) rather than a fixed
  // interval, so renewals never line up on one congested instant of the
  // proxy link and a retry after a blip is spread out.
  let leaseTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleLeaseTick = () => {
    if (shuttingDown) return;
    leaseTimer = setTimeout(() => {
      void leaseTick().finally(scheduleLeaseTick);
    }, leaseRenewDelayMs(LEASE_RENEW_INTERVAL_MS));
    leaseTimer.unref();
  };
  const leaseTick = async () => {
    {
      // A switch-OFF that could not be recorded durably (LH: OFF stops the
      // tree first, then writes). Keep trying until the database takes it.
      if (host.pendingDurableOff && host.runState === "off") {
        if (await writeDurableOff("operator")) {
          pushLog("host", "recorded the pending switch OFF in the database");
          broadcast("status", statusPayload());
        }
        return;
      }

      // Renew ONLY while the worker is actually running: renewing while it is
      // crashed/failed would keep every surface reporting "active locally" for a
      // machine that is doing nothing.
      if (host.runState !== "running") return;

      // OFF is authoritative wherever it was flipped (spec §4). The pill in THIS
      // app stops the worker directly, but the switch is a durable fact in
      // Postgres and can be turned off from somewhere else entirely — the app on
      // another computer, `npm run worker:local`, or an operator resetting state.
      // Without this check the host keeps its worker child alive until the
      // child's loop happens to notice between passes, which can be minutes of
      // crawling, rendering and publishing after the operator said stop.
      // Fail-open on a read error, for the same reason lease renewal does below.
      try {
        const master = await readMasterSwitch(prisma);
        if (!master.known) {
          pushLog("host", "could not read the master switch (database unreachable) — continuing");
          return;
        }
        if (!master.on) {
          pushLog("host", "master switch is OFF — stopping the local Admin Worker");
          await stopWorkerChild("master switch turned OFF");
          await shutdownLocalBrain();
          await releaseExecutionLease(prisma, RUNTIME_ID).catch(() => undefined);
          broadcast("status", statusPayload());
          return;
        }
      } catch {
        pushLog("host", "could not read the master switch (database unreachable) — continuing");
      }

      const renewed = await renewExecutionLease(prisma, RUNTIME_ID).catch(() => "unknown" as const);
      if (renewed === "unknown") {
        // A transient Postgres error is NOT proof that someone took the lease.
        // The loop fails open on the identical error; do the same here rather
        // than killing a healthy worker over one bad round-trip.
        pushLog("host", "lease renewal failed (database unreachable) — keeping the worker running");
        return;
      }
      if (renewed === "lost") {
        pushLog(
          "host",
          "execution lease is held by another runtime — stopping the local worker to avoid double execution",
        );
        await stopWorkerChild("execution lease lost");
        // stopWorkerChild leaves runState "off" and no reason — which reads as
        // an ordinary operator stop. It is not: another computer is executing.
        // Say so on the same surfaces the exit-5 path uses (worker-exit.ts), so
        // the app never shows a silent "off" for a lease hand-off.
        host.runState = "failed";
        host.failureReason = `The local worker stopped: ${LEASE_HELD_ELSEWHERE_MESSAGE}`;
        host.leaseHeldElsewhere = true;
        invalidateExecutionCache();
        broadcast("status", statusPayload());
        return;
      }
      // The heartbeat is otherwise written once per pass; a long pass would
      // show HEARTBEAT_STALE (>5 min) for a perfectly healthy worker. One cheap
      // update per tick from the process that owns the child keeps it honest.
      await writeHeartbeat(prisma).catch(() => undefined);
    }
  };
  scheduleLeaseTick();

  // Live status every 2 s for the dashboard. The durable execution status is
  // refreshed at most every EXECUTION_CACHE_MS, and only when someone is
  // listening — an OFF worker with no console open costs the database nothing.
  const statusTimer = setInterval(() => {
    if (sseClients.size > 0 && Date.now() - executionCache.at >= EXECUTION_CACHE_MS) {
      void readExecutionStatusCached().catch(() => undefined);
    }
    broadcast("status", statusPayload());
  }, 2_000);
  statusTimer.unref();

  // Sample what the worker tree is really consuming, and keep the browser
  // capability + render counters current.
  const sampleTimer = setInterval(() => {
    sampleWorkerProcessTree();
    void refreshBrowserStatus();
  }, 3_000);
  sampleTimer.unref();
  void refreshBrowserStatus();

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    pushLog("host", `received ${signal} — shutting the local Admin Worker down`);
    if (leaseTimer) clearTimeout(leaseTimer);
    void (async () => {
      // Local first (bounded by CHILD_KILL_GRACE_MS), then the database with
      // a hard budget: the app SIGKILLs the whole group 10 s after asking, so
      // an unreachable proxy must never keep this process (and its lease)
      // alive past that.
      await stopWorkerChild(`host received ${signal}`);
      await shutdownLocalBrain();
      await withDbBudget("releasing the execution lease", () =>
        releaseExecutionLease(prisma, RUNTIME_ID),
      );
      await withDbBudget("disconnecting from the database", () => prisma.$disconnect());
      server.close();
      process.exit(0);
    })();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  // A crash in the supervisor must not leave an orphaned worker tree holding a
  // lease that makes every surface report "active locally".
  process.on("uncaughtException", (err) => {
    console.error("[local-host] uncaught exception:", err);
    shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[local-host] unhandled rejection:", reason);
    shutdown("unhandledRejection");
  });

  // When the native application supervises this host it passes --watch-parent
  // and keeps a pipe on our stdin; closing that pipe (the app quitting) is the
  // signal to stop the whole local workload. Run from a terminal without the
  // flag and stdin is left alone, so `npm run worker:host` behaves normally.
  if (process.argv.includes("--watch-parent")) {
    process.stdin.on("end", () => shutdown("parent-exit"));
    process.stdin.resume();
  }
}

main().catch((err) => {
  console.error("[local-host] fatal:", err);
  process.exitCode = 1;
});
