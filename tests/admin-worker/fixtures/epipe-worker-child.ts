/**
 * Fixture for worker-epipe-exit.test.ts: the worker child's stdio wiring from
 * scripts/run-worker.ts — guardStdio, the safety net with its broken-pipe hook,
 * silenceStdio, exit WORKER_EXIT_SUPERVISOR_LOST — without a database. It logs
 * the way a busy worker does, and reports what happened on fd 3 (a pipe the
 * test reads) because its own stdout/stderr are the pipes being broken.
 *
 *   GUARD=0  leaves out guardStdio, so the closed pipe reaches the safety net
 *            as an uncaught EPIPE (the second line of defence).
 */
import { writeSync } from "node:fs";

import {
  guardStdio,
  isClosedPipe,
  silenceStdio,
} from "../../../src/lib/admin-worker/supervised-host";
import { WORKER_EXIT_SUPERVISOR_LOST } from "../../../src/lib/admin-worker/worker-exit";
import { installProcessSafetyNet } from "../../../src/lib/admin-worker/worker-supervisor";

const counts = { uncaught: 0, auditRows: 0, brokenPipeHooks: 0, writes: 0 };

function report(outcome: string): void {
  try {
    writeSync(3, `${JSON.stringify({ outcome, ...counts })}\n`);
  } catch {
    /* the test stopped listening */
  }
}

let leaving = false;
const supervisorLost = (reason: string) => {
  if (leaving) return;
  leaving = true;
  silenceStdio();
  report(reason);
  process.exit(WORKER_EXIT_SUPERVISOR_LOST);
};

if (process.env.GUARD !== "0") guardStdio(supervisorLost);

installProcessSafetyNet({
  workerId: "epipe-fixture",
  register: (event, handler) =>
    process.on(event, (arg: unknown) => {
      counts.uncaught += 1;
      handler(arg);
    }),
  errorLog: (m) => console.error(m),
  isBrokenPipe: isClosedPipe,
  onBrokenPipe: () => {
    counts.brokenPipeHooks += 1;
    supervisorLost("safety net: log pipe closed");
  },
  onEvent: () => {
    counts.auditRows += 1;
  },
  onAlert: () => undefined,
});

setInterval(() => {
  counts.writes += 1;
  console.log(`[admin-worker:epipe-fixture] pass ${counts.writes} ${"x".repeat(200)}`);
}, 2);

setTimeout(() => {
  report("still running after 4s");
  process.exit(0);
}, 4_000);
