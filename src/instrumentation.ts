export async function register() {
  // Only run in the Node.js runtime (not edge, not during next build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupTasks } = await import("./lib/startup/auto-seed");
    // Fire-and-forget: don't block server startup
    runStartupTasks().catch((e: unknown) => {
      console.error("[startup] unhandled error", e instanceof Error ? e.message : e);
    });
  }
}
