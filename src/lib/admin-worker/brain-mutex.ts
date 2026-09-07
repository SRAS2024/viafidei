/**
 * In-process mutex for supplementary Python-brain work.
 *
 * The resident brain answers strictly one request at a time, and the bridge
 * (`intelligence/client.ts`) does not queue: every caller writes straight to
 * the process's stdin and starts its own timeout the moment it writes. So two
 * lanes calling the brain at once do not run concurrently — the second one
 * silently waits in the Python loop while its 8s timeout is already ticking,
 * and a lane the watchdog has given up on keeps queueing calls into the next
 * pass. The awareness lanes (maint-schema / maint-ui), the self-model pass and
 * the custody scan all call the brain outside the `intelligence` lane, so they
 * take this mutex around their brain work: at most one of them talks to the
 * brain at a time, and each one's timeout starts only once it actually holds
 * the process.
 *
 * Deliberately tiny: a promise chain, no re-entrancy, no priorities. A holder
 * that throws still releases (the chain is settled in `finally`), and every
 * brain call already carries its own timeout, so a holder can never hang the
 * queue indefinitely.
 */

let _tail: Promise<void> = Promise.resolve();
let _holders = 0;
let _waiting = 0;

/** Run `fn` once every earlier holder has finished. Rejections propagate. */
export async function withBrainMutex<T>(fn: () => Promise<T>): Promise<T> {
  const previous = _tail;
  let release!: () => void;
  _tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  _waiting += 1;
  try {
    await previous;
  } finally {
    _waiting -= 1;
  }
  _holders += 1;
  try {
    return await fn();
  } finally {
    _holders -= 1;
    release();
  }
}

/** Live occupancy — for diagnostics and tests. */
export function brainMutexState(): { held: boolean; waiting: number } {
  return { held: _holders > 0, waiting: _waiting };
}
