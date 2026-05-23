/**
 * Persist a critical-severity ErrorLog row and fire a Critical Failure
 * admin email. We dynamic-import the data layer because instrumentation
 * runs before request handlers (and therefore before the regular module
 * graph is fully wired up); a static import here would force the heavy
 * Prisma client into the instrumentation bundle and break the build.
 */
async function notifyCriticalFailure(params: {
  kind: string;
  message: string;
  stack?: string;
}): Promise<void> {
  try {
    const { recordError } = await import("./lib/data/error-log");
    await recordError({
      source: "uncaught",
      kind: params.kind,
      message: params.message,
      stack: params.stack,
      severity: "critical",
    });
  } catch {
    // Never throw from the safety net.
  }
}

export async function register() {
  // Only run in the Node.js runtime (not edge, not during next build)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Process-level safety net so a stray rejection in background tasks
  // (seeder, scheduled ingestion, HTTP fetches) cannot crash the server.
  // Logged in the same JSON shape as the regular logger so log aggregators
  // can pick out the kind/route fields uniformly. Both handlers also
  // persist a critical-severity ErrorLog row and fire a Critical Failure
  // admin email — these are by definition site-crash-class events, which
  // is the only category the requirements allow as "critical".
  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : null;
    console.error(
      JSON.stringify({
        level: "error",
        time: new Date().toISOString(),
        msg: "runtime.unhandled_rejection",
        kind: "unhandled_rejection",
        error: err ? err.message : String(reason ?? "unknown"),
        stack: err?.stack,
      }),
    );
    void notifyCriticalFailure({
      kind: "unhandled_rejection",
      message: err ? err.message : String(reason ?? "unknown"),
      stack: err?.stack,
    });
  });

  process.on("uncaughtException", (err) => {
    console.error(
      JSON.stringify({
        level: "error",
        time: new Date().toISOString(),
        msg: "runtime.uncaught_exception",
        kind: "uncaught_exception",
        error: err.message,
        stack: err.stack,
      }),
    );
    void notifyCriticalFailure({
      kind: "uncaught_exception",
      message: err.message,
      stack: err.stack,
    });
  });

  try {
    const { runStartupTasks } = await import("./lib/startup/auto-seed");
    // Fire-and-forget: register() must return quickly so requests are not blocked.
    // The boot-time DB validator (scripts/validate-db.js) has already proved
    // the schema is sound by the time this code runs, so any error here is
    // a runtime / data issue rather than a startup blocker.
    runStartupTasks().catch((e: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          time: new Date().toISOString(),
          msg: "startup.tasks_failed",
          kind: "startup_error",
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    });
  } catch (e) {
    // Failing to load the startup module must not block the server from starting.
    console.error(
      JSON.stringify({
        level: "error",
        time: new Date().toISOString(),
        msg: "startup.module_load_failed",
        kind: "startup_error",
        error: e instanceof Error ? e.message : String(e),
      }),
    );
  }
}
