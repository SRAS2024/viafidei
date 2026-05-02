export async function register() {
  // Only run in the Node.js runtime (not edge, not during next build)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Process-level safety net so a stray rejection in background tasks
  // (seeder, scheduled ingestion, HTTP fetches) cannot crash the server.
  process.on("unhandledRejection", (reason) => {
    console.error(
      "[runtime] unhandled rejection",
      reason instanceof Error ? reason.message : reason,
    );
  });

  try {
    const { runStartupTasks } = await import("./lib/startup/auto-seed");
    // Fire-and-forget: register() must return quickly so requests are not blocked.
    runStartupTasks().catch((e: unknown) => {
      console.error("[startup] unhandled error", e instanceof Error ? e.message : e);
    });
  } catch (e) {
    // Failing to load the startup module must not block the server from starting.
    console.error(
      "[startup] failed to load module",
      e instanceof Error ? e.message : e,
    );
  }
}
