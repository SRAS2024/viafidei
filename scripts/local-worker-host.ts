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
} from "../src/lib/admin-worker/execution-host";
import { localHostLabel, sampleLocalResources } from "../src/lib/admin-worker/local-resources";
import { loadCommandCenterSnapshot } from "../src/lib/admin-worker/command-center";
import { writeAdminWorkerLog } from "../src/lib/admin-worker/logs";
import { MAX_FILE_BYTES } from "../src/lib/admin-worker/file-extractors";
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

interface HostState {
  runState: RunState;
  child: ChildProcess | null;
  startedAt: number | null;
  restarts: number;
  lastExit: { code: number | null; signal: string | null; at: number } | null;
  lastError: string | null;
  /** Set when the host has stopped trying to keep the worker alive. */
  failureReason: string | null;
  activeJobs: Set<string>;
  itemsProcessed: number;
  itemsPublished: number;
  errors: number;
}

const host: HostState = {
  runState: "off",
  child: null,
  startedAt: null,
  restarts: 0,
  lastExit: null,
  lastError: null,
  failureReason: null,
  activeJobs: new Set(),
  itemsProcessed: 0,
  itemsPublished: 0,
  errors: 0,
};

const logRing: Array<{ at: string; stream: "worker" | "host"; line: string }> = [];
let snapshotInFlight = false;
let lastSnapshot: unknown = null;
const sseClients = new Set<ServerResponse>();

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
    env: { ...process.env },
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
    host.runState = wasStopping ? "off" : "crashed";
    pushLog(
      "host",
      `worker process exited (code=${code ?? "null"}, signal=${signal ?? "none"})${wasStopping ? "" : " unexpectedly"}`,
    );
    broadcast("status", statusPayload());

    // Restart locally when the master switch is still ON — but never hand the
    // work back to Railway (spec §5: no automatic cloud failover).
    if (!wasStopping) {
      void (async () => {
        const master = await readMasterSwitch(prisma).catch(() => ({ on: false }) as const);
        if (!master.on || shuttingDown) return;
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
      })();
    }
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
    const timer = setTimeout(() => {
      killGroup("SIGKILL");
      resolve();
    }, 8_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  host.child = null;
  host.runState = "off";
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

/** Host[:port]/database of the configured connection string — never the credentials. */
function describeDatabaseHost(raw: string): string | null {
  try {
    const url = new URL(raw);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return raw ? "unparseable" : null;
  }
}

function isLocalDatabaseHost(databaseHost: string | null): boolean {
  return databaseHost != null && /^(localhost|127\.0\.0\.1|\[::1\])/.test(databaseHost);
}

/**
 * Result of the last database preflight. The worker must never be started
 * against a database that cannot be reached: it would crash-loop five times,
 * release the lease and report "failed" with a stack trace, when the real
 * problem is one line of configuration. Probed at boot, before every switch-ON,
 * and on demand from the console.
 */
let dbProbe: { reachable: boolean; latencyMs: number | null; error: string | null; at: string } = {
  reachable: false,
  latencyMs: null,
  error: "not checked yet",
  at: new Date(0).toISOString(),
};

async function probeDatabase(timeoutMs = 15_000): Promise<typeof dbProbe> {
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
    const message = err instanceof Error ? err.message : String(err);
    dbProbe = {
      reachable: false,
      latencyMs: null,
      // Prisma's connection errors quote the host but never the password; keep
      // the first line only so the console shows the cause, not a stack.
      error:
        message
          .split("\n")
          .find((l) => l.trim())
          ?.trim()
          .slice(0, 300) ?? "unreachable",
      at: new Date().toISOString(),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
  return dbProbe;
}

/**
 * Where published pages are verified. A worker connected to the production
 * database is working on the production site, so when nothing sets
 * PUBLIC_BASE_URL the canonical public origin is the only sensible default —
 * `publicOrigin()` would otherwise fall back to http://localhost:3000 outside
 * NODE_ENV=production and every post-publish probe would check a site that is
 * not there. Applied to this process (operator work runs in-process) and
 * inherited by the worker child.
 */
function ensurePublicBaseUrl(): void {
  if (process.env.PUBLIC_BASE_URL) return;
  const databaseHost = describeDatabaseHost(process.env.DATABASE_URL ?? "");
  if (databaseHost && !isLocalDatabaseHost(databaseHost)) {
    process.env.PUBLIC_BASE_URL = appConfig.canonicalUrl;
  }
}

/**
 * Non-sensitive description of the effective configuration: which source it
 * came from, which database host it points at (host and database name only —
 * never the credentials), whether that database answered, and where published
 * pages will be verified. Surfaced in the app so a misconfiguration is visible
 * rather than silently wrong — in particular the trap where a laptop .env
 * points at a LOCAL Postgres and the worker "publishes" into it while every
 * dashboard reports success.
 */
function configPayload() {
  const raw = process.env.DATABASE_URL ?? "";
  const databaseHost = describeDatabaseHost(raw);
  const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? null;
  const localDatabase = isLocalDatabaseHost(databaseHost);
  const remoteDatabase = databaseHost != null && !localDatabase;
  const route = process.env.VIAFIDEI_DB_ROUTE ?? "unknown";
  const internalHost = /\.railway\.internal/.test(raw);

  const warnings: string[] = [];
  if (!databaseHost) {
    warnings.push(
      "No database configured. Link this checkout to Railway (railway login && railway link) " +
        "so the worker inherits production configuration, or provide a local .env.",
    );
  } else if (internalHost) {
    warnings.push(
      `DATABASE_URL points at Railway's private network (${databaseHost}), which this computer cannot reach. ` +
        "Link the Railway project (railway link) so the launcher can resolve the Postgres service's " +
        "DATABASE_PUBLIC_URL, then switch the Admin Worker off and on again.",
    );
  } else if (localDatabase) {
    warnings.push(
      `The worker is pointed at a LOCAL database (${databaseHost}) from the repository .env — ` +
        "production (etviafidei.com) is NOT being updated. Run `railway login` and `railway link` " +
        "in the repository, then relaunch the app.",
    );
  } else if (!dbProbe.reachable && dbProbe.error) {
    warnings.push(`The database at ${databaseHost} is not answering: ${dbProbe.error}`);
  }
  if (remoteDatabase && !publicBaseUrl) {
    warnings.push(
      "Connected to a remote database but PUBLIC_BASE_URL is unset — published pages would be " +
        "verified against http://localhost:3000 instead of the live site.",
    );
  }

  return {
    source: CONFIG_AT_BOOT.source,
    databaseUrlFromEnvironment: CONFIG_AT_BOOT.databaseUrlFromEnvironment,
    databaseHost,
    remoteDatabase,
    route,
    database: dbProbe,
    publicBaseUrl,
    warnings,
  };
}

function statusPayload() {
  const resources = sampleLocalResources(workerProcessSample?.rssBytes ?? null);
  return {
    runtimeId: RUNTIME_ID,
    runState: host.runState,
    failureReason: host.failureReason,
    executionHost: "LOCAL_MACBOOK" as const,
    hostLabel: localHostLabel(),
    startedAt: host.startedAt ? new Date(host.startedAt).toISOString() : null,
    uptimeMs: host.startedAt ? Date.now() - host.startedAt : 0,
    restarts: host.restarts,
    lastExit: host.lastExit,
    lastError: host.lastError,
    activeJobs: Array.from(host.activeJobs),
    config: configPayload(),
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
        const execution = await readExecutionStatus(prisma);
        json(res, 200, { ...statusPayload(), execution });
        return;
      }

      case "GET /api/snapshot": {
        // The console polls this. Two guards keep an open window from becoming a
        // workload of its own: never refresh goals (a write) unless asked, and
        // never run two snapshots at once — a slow remote database would
        // otherwise stack them up every 20 seconds.
        if (snapshotInFlight) {
          json(res, 200, { ...(lastSnapshot ?? {}), reusedInFlight: true });
          return;
        }
        snapshotInFlight = true;
        try {
          const snapshot = await withJob("command-center-snapshot", () =>
            loadCommandCenterSnapshot(prisma, {
              refreshGoals: url.searchParams.get("refresh") === "1",
            }),
          );
          lastSnapshot = snapshot;
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
          const probe = await probeDatabase();
          const cfg = configPayload();
          const blocking = cfg.warnings.find((w) =>
            /private network|LOCAL database|No database|not answering/.test(w),
          );
          if (!probe.reachable || blocking) {
            json(res, 503, {
              error: "database_unavailable",
              detail:
                blocking ??
                `The database at ${cfg.databaseHost ?? "?"} is not answering: ${probe.error ?? "unreachable"}. The Admin Worker was not started.`,
            });
            return;
          }
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
          host.restarts = 0;
          host.failureReason = null;
          startWorkerChild();
          await writeAdminWorkerLog(prisma, {
            category: "OVERVIEW",
            severity: "INFO",
            eventName: "local_worker_activated",
            message: `Admin Worker switched ON. Active execution host: ${localHostLabel()} (local MacBook runtime ${RUNTIME_ID}).`,
            safeMetadata: { runtimeId: RUNTIME_ID, origin: "LOCAL_MACBOOK" },
          }).catch(() => undefined);
        } else {
          await setMasterSwitch(prisma, {
            on: false,
            actor: body.actor ?? "operator",
            from: "swift-app",
          });
          await stopWorkerChild("master switch OFF");
          // The host itself keeps a resident Python brain while it runs
          // operator work (ingestion, manual passes, makeovers). OFF means OFF:
          // shut that down too, so no intelligence process survives the switch.
          await shutdownLocalBrain();
          await releaseExecutionLease(prisma, RUNTIME_ID);
          await writeAdminWorkerLog(prisma, {
            category: "OVERVIEW",
            severity: "INFO",
            eventName: "local_worker_deactivated",
            message:
              "Admin Worker switched OFF. The local runtime, Python brain and browser rendering were stopped. " +
              "No cloud worker takes over.",
            safeMetadata: { runtimeId: RUNTIME_ID },
          }).catch(() => undefined);
        }
        const execution = await readExecutionStatus(prisma);
        broadcast("status", statusPayload());
        json(res, 200, { ...statusPayload(), execution });
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
      `configuration source: ${cfg.source} (${cfg.route}); database ${cfg.databaseHost ?? "NOT CONFIGURED"} ` +
        `${cfg.database.reachable ? `reachable in ${cfg.database.latencyMs}ms` : `UNREACHABLE (${cfg.database.error ?? "?"})`}` +
        `${cfg.publicBaseUrl ? `; verifying against ${cfg.publicBaseUrl}` : ""}`,
    );
    for (const warning of cfg.warnings) pushLog("host", `WARNING: ${warning}`);
  }

  // Resume a previously-ON switch: if the operator left the worker ON and the
  // application is relaunched, pick the work back up where Postgres says it was.
  // Never resume against a database that is unreachable or plainly not
  // production — the switch is durable, so it stays ON and the console shows why.
  const master = await readMasterSwitch(prisma).catch(() => ({ on: false }) as const);
  const bootConfig = configPayload();
  const bootBlocked = bootConfig.warnings.find((w) =>
    /private network|LOCAL database|No database|not answering/.test(w),
  );
  if (master.on && (bootBlocked || !bootConfig.database.reachable)) {
    host.runState = "failed";
    host.failureReason =
      bootBlocked ??
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
  const leaseTimer = setInterval(() => {
    void (async () => {
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

      let renewed: boolean;
      try {
        renewed = await renewExecutionLease(prisma, RUNTIME_ID);
      } catch {
        // A transient Postgres error is NOT proof that someone took the lease.
        // The loop fails open on the identical error; do the same here rather
        // than killing a healthy worker over one bad round-trip.
        pushLog("host", "lease renewal failed (database unreachable) — keeping the worker running");
        return;
      }
      if (!renewed) {
        pushLog(
          "host",
          "execution lease is held by another runtime — stopping the local worker to avoid double execution",
        );
        await stopWorkerChild("execution lease lost");
      }
    })();
  }, LEASE_RENEW_INTERVAL_MS);
  leaseTimer.unref();

  const statusTimer = setInterval(() => broadcast("status", statusPayload()), 2_000);
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
    void (async () => {
      await stopWorkerChild(`host received ${signal}`);
      await shutdownLocalBrain();
      await releaseExecutionLease(prisma, RUNTIME_ID).catch(() => undefined);
      await prisma.$disconnect().catch(() => undefined);
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
