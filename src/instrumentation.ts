export async function register() {
  // Only run in the Node.js runtime (not edge, not during next build)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Process-level safety net so a stray rejection in background tasks
  // (seeder, scheduled ingestion, HTTP fetches) cannot crash the server.
  // Logged in the same JSON shape as the regular logger so log aggregators
  // can pick out the kind/route fields uniformly.
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
