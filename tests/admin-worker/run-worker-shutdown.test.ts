/**
 * The worker child's boot and shutdown contract with the local host.
 *
 * SIGTERM is the host's NORMAL stop (every switch-OFF). The old handler exited
 * after a fixed 1s timer, skipping the cleanup entirely: every operator stop
 * left the in-flight pass RUNNING, the execution lease row in place — so the
 * next boot refused with "another runtime holds the lease" — and the Python
 * brain to the process-group kill (audit LH-09). Cleanup now runs on the way
 * out, bounded by a 3s race so a dead database can never hold the stop hostage.
 *
 * Asserted against the source: `scripts/run-worker.ts` is a process entry point
 * (it connects, spawns and installs signal handlers at import), so importing it
 * in the unit suite is not an option. Same approach as local-launcher.test.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const src = readFileSync(join(process.cwd(), "scripts/run-worker.ts"), "utf8");
const shutdown = src.slice(src.indexOf("const shutdown = "), src.indexOf('process.on("SIGINT"'));

describe("run-worker shutdown", () => {
  it("handles both SIGINT and SIGTERM through the same path", () => {
    expect(src).toContain('process.on("SIGINT", () => shutdown("SIGINT"));');
    expect(src).toContain('process.on("SIGTERM", () => shutdown("SIGTERM"));');
  });

  it("releases the lease and disconnects BEFORE exiting", () => {
    expect(shutdown).toContain("releaseExecutionLease(prisma, args.workerId)");
    expect(shutdown).toContain("prisma.$disconnect()");
    // The in-flight pass is closed honestly rather than orphaned as RUNNING.
    expect(shutdown).toContain("abandonCurrentPass(prisma,");
    expect(shutdown).toContain("shutdownBrain()");
  });

  it("bounds the cleanup with a 3s race so a dead database cannot hang the stop", () => {
    expect(shutdown).toMatch(/setTimeout\(resolve, 3_000\)/);
    expect(shutdown).toContain("Promise.race([cleanup, deadline])");
    expect(shutdown).toContain("process.exit(0)");
    // The race must be what triggers the exit — not a bare timer alongside it.
    expect(shutdown).toMatch(
      /Promise\.race\(\[cleanup, deadline\]\)\.then\(\(\) => process\.exit\(0\)\)/,
    );
  });

  it("is idempotent: a second signal cannot start a second cleanup", () => {
    expect(shutdown).toContain("if (shuttingDown) return;");
  });
});

describe("run-worker boot", () => {
  it("records the code version with force, so a restarted upgrade lands now", () => {
    // This IS a new process; the recorder's hourly in-process throttle would
    // otherwise defer the compare by up to an hour after an upgrade restart.
    expect(src).toContain("recordCodeVersionIfChanged(prisma, { force: true })");
  });

  it("keeps the distinct exit codes the host's exit plan reads", () => {
    // 4 = database unreachable (an outage, restartable), 3 = refused at boot,
    // 0 = clean stop, 5 = the lease was taken mid-run. See worker-exit.ts.
    expect(src).toContain("process.exitCode = 4;");
    expect(src).toContain("if (process.exitCode !== 4) process.exitCode = 3;");
    expect(src).toContain("process.exitCode = 0;");
    expect(src).toContain("process.exitCode = 5;");
  });
});
