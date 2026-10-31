/**
 * A worker whose host went away must stop, once, quietly.
 *
 * The worker child's stdout/stderr are pipes to the local host. When the host
 * dies first, every console write fails with EPIPE; Node keeps its stdio
 * streams "undestroyed", so each failure is a fresh uncaught exception, which
 * the safety net logged (to the same dead pipe) and audited as an unsampled
 * ERROR row — a reproduced storm made 213,085 handler calls in 3 s from 29 log
 * lines, and the worker never exited.
 *
 * This runs the real stdio wiring (guardStdio + safety net + silenceStdio, as
 * scripts/run-worker.ts composes them) in a real child process, breaks its
 * pipes, and requires a prompt exit with the supervisor-lost code, no audit
 * rows and no handler storm.
 */
import { spawn } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { WORKER_EXIT_SUPERVISOR_LOST } from "@/lib/admin-worker/worker-exit";

const FIXTURE = path.join(process.cwd(), "tests/admin-worker/fixtures/epipe-worker-child.ts");

interface ChildReport {
  outcome: string;
  uncaught: number;
  auditRows: number;
  brokenPipeHooks: number;
  writes: number;
}

function runWithBrokenPipes(
  env: Record<string, string>,
): Promise<{ code: number | null; report: ChildReport | null; ms: number }> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, ["--import", "tsx", FIXTURE], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    let reportText = "";
    child.stdio[3]?.on("data", (chunk) => (reportText += String(chunk)));
    // The host dying, as the worker sees it: nobody reads its output any more.
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.on("error", reject);
    child.on("exit", (code) => {
      const line = reportText.trim().split("\n").filter(Boolean).pop();
      resolve({
        code,
        report: line ? (JSON.parse(line) as ChildReport) : null,
        ms: Date.now() - started,
      });
    });
  });
}

describe("worker child with a closed log pipe", () => {
  it("exits promptly with the supervisor-lost code instead of looping", async () => {
    const run = await runWithBrokenPipes({});
    expect(run.code).toBe(WORKER_EXIT_SUPERVISOR_LOST);
    expect(run.report?.outcome).toBe("parent-exit (log pipe closed)");
    // Nothing reached the process-level handlers, so nothing was audited.
    expect(run.report?.uncaught).toBe(0);
    expect(run.report?.auditRows).toBe(0);
    expect(run.ms).toBeLessThan(4_000);
  }, 15_000);

  it("still exits once if a closed pipe reaches the safety net", async () => {
    const run = await runWithBrokenPipes({ GUARD: "0" });
    expect(run.code).toBe(WORKER_EXIT_SUPERVISOR_LOST);
    expect(run.report?.outcome).toBe("safety net: log pipe closed");
    expect(run.report?.brokenPipeHooks).toBe(1);
    // Never logged, never audited — and nowhere near a storm.
    expect(run.report?.auditRows).toBe(0);
    expect(run.report?.uncaught).toBeLessThan(10);
    expect(run.ms).toBeLessThan(4_000);
  }, 15_000);
});
