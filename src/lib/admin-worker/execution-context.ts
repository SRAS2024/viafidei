/**
 * Where is this Admin Worker code actually running?
 *
 * The Admin Worker's active execution host is the operator's MacBook (the
 * native Swift Via Fidei application launches and supervises it). The Railway
 * web service exists to serve the public website — it must never execute the
 * autonomous worker, spawn the Python brain, or drive a headless browser.
 *
 * This module is the process-level half of that boundary. It answers "may THIS
 * process run Admin Worker computation?" with no new environment variables and
 * no database round-trip:
 *
 *   - `LOCAL_MACBOOK`  the local runtime launched by the Swift app (or by
 *                      `npm run worker:local`). Full authority.
 *   - `RAILWAY_WORKER` the retained-but-parked cloud worker service. Refuses
 *                      to run unless an operator deliberately passes the
 *                      documented override flag.
 *   - `SERVER_WEB`     the Next.js server (public site + admin website). Never
 *                      allowed to run worker computation.
 *   - `STANDALONE`     a plain CLI / test / proof-script process. Allowed —
 *                      this is how `npm run admin-worker:proof:*`, the
 *                      dry-run scripts, and the vitest suites already run.
 *
 * The Next.js runtime is detected through `process.env.NEXT_RUNTIME`, which
 * Next sets for both its node and edge runtimes (see `src/instrumentation.ts`,
 * which has always relied on it). Nothing new has to be configured anywhere.
 */

export type WorkerExecutionOrigin =
  | "LOCAL_MACBOOK"
  | "RAILWAY_WORKER"
  | "SERVER_WEB"
  | "STANDALONE";

let markedOrigin: WorkerExecutionOrigin | null = null;
let remoteOverrideReason: string | null = null;

/**
 * Claim an execution origin for this process. Called once, very early, by an
 * entry point script:
 *
 *   scripts/local-worker-host.ts   → LOCAL_MACBOOK
 *   scripts/run-worker.ts          → LOCAL_MACBOOK (with `--origin local`)
 *                                    or RAILWAY_WORKER otherwise
 *   scripts/worker-service-parked.ts → RAILWAY_WORKER
 */
export function markWorkerExecutionOrigin(origin: WorkerExecutionOrigin): void {
  markedOrigin = origin;
}

/**
 * Deliberate, operator-initiated override that lets the retained Railway
 * worker service execute again (spec §6: the service stays *recoverable*).
 * Never set automatically — there is no cloud failover (spec §5).
 */
export function allowRemoteExecutionOverride(reason: string): void {
  remoteOverrideReason = reason || "operator override";
}

export function remoteExecutionOverride(): string | null {
  return remoteOverrideReason;
}

function isNextServerRuntime(): boolean {
  const rt = process.env.NEXT_RUNTIME;
  return rt === "nodejs" || rt === "edge";
}

/** The resolved execution origin of the current process. */
export function workerExecutionOrigin(): WorkerExecutionOrigin {
  if (markedOrigin) return markedOrigin;
  if (isNextServerRuntime()) return "SERVER_WEB";
  return "STANDALONE";
}

/** True when this process is the local (MacBook) Admin Worker runtime. */
export function isLocalWorkerRuntime(): boolean {
  return workerExecutionOrigin() === "LOCAL_MACBOOK";
}

export class WorkerExecutionForbiddenError extends Error {
  readonly origin: WorkerExecutionOrigin;
  readonly operation: string;

  constructor(operation: string, origin: WorkerExecutionOrigin) {
    super(
      `Admin Worker operation "${operation}" is not permitted in the ${origin} runtime. ` +
        `The Admin Worker executes on the operator's MacBook, launched from the native ` +
        `Via Fidei application. The production web service serves the website only.`,
    );
    this.name = "WorkerExecutionForbiddenError";
    this.origin = origin;
    this.operation = operation;
  }
}

/**
 * Hard guard placed at the top of every entry point that performs Admin Worker
 * computation (the loop, a pass, the mission dispatcher, an operator pass, the
 * homepage makeover, file ingestion, the Python brain bridge).
 *
 * Throwing — rather than quietly returning — is deliberate: an accidental
 * server-side worker invocation must be loud and visible, not a silent
 * relapse into cloud execution.
 */
export function assertWorkerExecutionAllowed(operation: string): void {
  const origin = workerExecutionOrigin();
  if (origin === "SERVER_WEB") {
    throw new WorkerExecutionForbiddenError(operation, origin);
  }
  if (origin === "RAILWAY_WORKER" && !remoteOverrideReason) {
    throw new WorkerExecutionForbiddenError(operation, origin);
  }
}

/** Non-throwing form for callers that want to degrade instead of fail. */
export function workerExecutionAllowed(): boolean {
  try {
    assertWorkerExecutionAllowed("probe");
    return true;
  } catch {
    return false;
  }
}

/** Test-only reset. */
export function __resetWorkerExecutionOrigin(): void {
  markedOrigin = null;
  remoteOverrideReason = null;
}
