import { execFile } from "node:child_process";

/**
 * Safeguards for a local worker host that the Via Fidei Mac app launched
 * (`--watch-parent`). The app owns the ON/OFF switch, so the host must never
 * outlive it.
 *
 * Found 2026-10-05: an app that went away without closing the pipe cleanly
 * left the host orphaned for 8 days at 100% CPU. Its log pipe had no reader,
 * every console write failed with EPIPE, and the crash handler logged that
 * failure — to the same dead pipe — forever, so shutdown never got to run.
 *
 * Any one of these means the app is gone, and each triggers shutdown:
 *   1. stdin reaches EOF (the app closed its end — the normal path);
 *   2. writing to stdout/stderr fails with a broken pipe;
 *   3. no `*.app/Contents/MacOS/*` process is left among our ancestors
 *      (checked on a timer, two misses in a row), i.e. launchd adopted us.
 * Once the app is gone, logging to the console is switched off so a dead
 * pipe can never feed an error loop again.
 *
 * The worker child the host supervises had the same loop one level down (its
 * stdout/stderr are pipes to the host), so scripts/run-worker.ts uses the same
 * stdio guard and silencing.
 */

/** A write to one of OUR stdio streams failed because nobody reads it any more. */
export function isBrokenPipe(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  return code === "EPIPE" || code === "ERR_STREAM_DESTROYED" || code === "ECONNRESET";
}

/**
 * The narrower test for PROCESS-WIDE handlers (uncaughtException,
 * unhandledRejection), which see errors from every socket in the process: an
 * unhandled ECONNRESET there is far more often a network peer than our own
 * stdio, and reading it as "the app is gone" would silence the log and stop the
 * runtime for an unrelated failure. Only a closed pipe qualifies.
 */
export function isClosedPipe(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  return code === "EPIPE" || code === "ERR_STREAM_DESTROYED";
}

/**
 * Route a broken pipe on stdout/stderr to `onBroken` instead of letting it
 * reach uncaughtException. Node keeps its stdio streams "undestroyed" after a
 * failed write, so with no 'error' listener EVERY later write raises a fresh
 * uncaught EPIPE (measured: ~114k in 1.5 s from 300 writes). With a listener,
 * none do.
 */
export function guardStdio(onBroken: (reason: string) => void): void {
  for (const stream of [process.stdout, process.stderr]) {
    stream.on("error", (err) => {
      if (isBrokenPipe(err)) onBroken("parent-exit (log pipe closed)");
    });
  }
}

let silenced = false;

/** Stop writing to the console; the reader is gone. */
export function silenceStdio(): void {
  if (silenced) return;
  silenced = true;
  const swallow = ((..._args: unknown[]) => true) as unknown as typeof process.stdout.write;
  process.stdout.write = swallow;
  process.stderr.write = swallow;
}

export function stdioSilenced(): boolean {
  return silenced;
}

type Proc = { ppid: number; comm: string };

/** Walk our ancestry; true when a macOS app bundle is still above us. */
export function hasAppAncestor(table: Map<number, Proc>, startPid: number): boolean {
  let pid = startPid;
  for (let hops = 0; hops < 64 && pid > 1; hops++) {
    const p = table.get(pid);
    if (!p) return false;
    if (p.comm.includes(".app/Contents/MacOS/")) return true;
    pid = p.ppid;
  }
  return false;
}

export function parseProcessTable(out: string): Map<number, Proc> {
  const table = new Map<number, Proc>();
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
    if (m) table.set(Number(m[1]), { ppid: Number(m[2]), comm: m[3] });
  }
  return table;
}

export function watchSupervisor(
  shutdown: (reason: string) => void,
  opts: { pollMs?: number } = {},
): void {
  let gone = false;
  const supervisorGone = (reason: string) => {
    if (gone) return;
    gone = true;
    silenceStdio();
    shutdown(reason);
  };

  // 1. The app closing its end of our stdin.
  process.stdin.on("end", () => supervisorGone("parent-exit"));
  process.stdin.on("error", () => supervisorGone("parent-exit"));
  process.stdin.resume();

  // 2. Nobody left to read our log output.
  guardStdio(supervisorGone);

  // 3. Adopted by launchd: no app bundle among our ancestors any more.
  let misses = 0;
  const timer = setInterval(() => {
    execFile(
      "/bin/ps",
      ["-axo", "pid=,ppid=,comm="],
      { maxBuffer: 8 * 1024 * 1024 },
      (err, out) => {
        if (err || gone) return;
        if (hasAppAncestor(parseProcessTable(out), process.pid)) {
          misses = 0;
        } else if (++misses >= 2) {
          supervisorGone("orphaned (the Via Fidei app is no longer running)");
        }
      },
    );
  }, opts.pollMs ?? 5000);
  timer.unref();
}
