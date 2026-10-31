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
    // The race must be what triggers the exit — not a bare timer alongside it.
    expect(shutdown).toMatch(
      /Promise\.race\(\[cleanup, deadline\]\)\.then\(\(\) => process\.exit\(exitCode\)\)/,
    );
    // A signal (the host's normal stop) still exits 0.
    expect(shutdown).toContain("const shutdown = (signal: string, exitCode = 0) =>");
    expect(src).toContain('process.on("SIGTERM", () => shutdown("SIGTERM"));');
  });

  it("is idempotent: a second signal cannot start a second cleanup", () => {
    expect(shutdown).toContain("if (shuttingDown) return;");
  });
});

describe("run-worker without its supervisor", () => {
  const beforeClaim = src.slice(
    0,
    src.indexOf("const authority = await claimExecutionAuthority(args);"),
  );

  it("guards stdio before the first log line, and exits with the supervisor-lost code", () => {
    // A closed log pipe is routed to shutdown, never to the console (the write
    // that reports it would fail too, and each failure used to loop).
    expect(beforeClaim).toContain("guardStdio(supervisorLost);");
    expect(beforeClaim).toMatch(
      /const supervisorLost = \(reason: string\) => \{\s*silenceStdio\(\);\s*shutdown\(reason, WORKER_EXIT_SUPERVISOR_LOST\);/,
    );
  });

  it("watches the host pid the host hands it, not only its own parent", () => {
    expect(beforeClaim).toContain("process.env.VIAFIDEI_HOST_PID");
    expect(beforeClaim).toContain("watchSupervisingHost({");
    expect(beforeClaim).toContain("process.kill(pid, 0)");
    expect(beforeClaim).toContain("onGone: supervisorLost");
  });

  it("lets the safety net hand a closed pipe to the same exit instead of logging it", () => {
    const net = src.slice(src.indexOf("installProcessSafetyNet({"));
    expect(net).toContain("isBrokenPipe: isClosedPipe,");
    expect(net).toContain('onBrokenPipe: () => supervisorLost("parent-exit (log pipe closed)")');
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
    // The refusal code comes from a typed reason, not from message wording.
    expect(src).toContain("process.exitCode = refusalExitCode(authority.refusal);");
    expect(src).toContain("process.exitCode = 0;");
    expect(src).toContain("process.exitCode = 5;");
  });

  it("reports a database error while claiming the lease as an outage, not a lease elsewhere", () => {
    const claim = src.slice(
      src.indexOf("async function claimExecutionAuthority"),
      src.indexOf("async function main()"),
    );
    // Both outage paths: the switch read and the lease claim.
    expect(claim).toContain('return { ok: false, refusal: "db_unreachable" };');
    expect(claim).toContain('claim.refusal === "db_unreachable" ? "db_unreachable"');
    expect(claim).toContain('return { ok: false, refusal: "switch_off" };');
  });
});
