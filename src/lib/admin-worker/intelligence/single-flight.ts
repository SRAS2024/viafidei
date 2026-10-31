/**
 * One-at-a-time turns for the Python brain's single request pipe.
 *
 * The brain is sequential: intelligence/main.py reads stdin a line at a time
 * and answers each request before it reads the next. Concurrent lanes used to
 * write overlapping requests straight into that pipe, and every call's timeout
 * started at its own write — so calls waiting INSIDE the pipe behind someone
 * else's work timed out while the brain was perfectly healthy, and two such
 * timeouts in a row SIGKILLed the brain for everyone (bridge recycle), failing
 * a publish gate or a readings refresh mid-flight and, after enough recycles,
 * latching the brain down so the next pass ran in safe-degraded mode.
 *
 * A turn is granted to one caller at a time, in arrival order. A caller that
 * cannot get its turn within its wait budget is told "busy" and gives up —
 * that is the brain being popular, not the brain being stuck, so it must
 * never count towards a recycle.
 */

export type Turn =
  /** Your request may be written now; call release() when it has settled. */
  | "granted"
  /** The wait budget ran out before the turn came. */
  | "busy"
  /** The brain was shut down while you waited. */
  | "cancelled";

interface Waiter {
  settle: (turn: Turn) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

export class SingleFlight {
  private busy = false;
  private readonly waiters: Waiter[] = [];

  /** A request is in flight right now. */
  get inFlight(): boolean {
    return this.busy;
  }

  /** Callers waiting for their turn. */
  get waiting(): number {
    return this.waiters.length;
  }

  /** Wait (at most `waitMs`) for the turn. */
  acquire(waitMs: number): Promise<Turn> {
    if (!this.busy) {
      this.busy = true;
      return Promise.resolve("granted");
    }
    if (waitMs <= 0) return Promise.resolve("busy");
    return new Promise<Turn>((resolve) => {
      const waiter: Waiter = { settle: resolve, timer: null };
      waiter.timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        resolve("busy");
      }, waitMs);
      (waiter.timer as { unref?: () => void }).unref?.();
      this.waiters.push(waiter);
    });
  }

  /** End the current turn, handing it straight to the next waiter if there is one. */
  release(): void {
    const next = this.waiters.shift();
    if (!next) {
      this.busy = false;
      return;
    }
    if (next.timer) clearTimeout(next.timer);
    next.settle("granted");
  }

  /** Turn every waiter away (the brain is being shut down). */
  cancelWaiting(): void {
    for (const waiter of this.waiters.splice(0)) {
      if (waiter.timer) clearTimeout(waiter.timer);
      waiter.settle("cancelled");
    }
  }
}
