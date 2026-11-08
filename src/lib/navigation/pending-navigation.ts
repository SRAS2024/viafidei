/**
 * Tells a reader who cannot see the page that the next one is on its way.
 *
 * Most pages have a placeholder of their own, which comes up at once with its own
 * words. Some waits have none: a link whose address carries a query, a page with no
 * placeholder at all (/history keeps working without script that way), or a server
 * that is slow to send even the placeholder. In those the old page stays put and the
 * address does not move, so nothing is said until the new title is announced.
 *
 * So once a client navigation has gone half a second without moving the address, the
 * one status in the layout says it is loading. It is said once per wait, however many
 * navigations that wait holds, and it clears the moment the address moves: that is
 * when the new page is committed, and Next's route announcer speaks its title, or the
 * page's own placeholder takes over. A navigation that lands sooner says nothing more.
 */

/** The same wait as the placeholders' own status (see LoadingStatus). */
export const PENDING_SPOKEN_AFTER_MS = 500;

/** How often a waiting navigation looks to see whether the address has moved. */
const ARRIVAL_CHECK_MS = 50;

type Listener = (pending: boolean) => void;

const listeners = new Set<Listener>();
let from: string | null = null;
let speakTimer: ReturnType<typeof setTimeout> | null = null;
let arrivalCheck: ReturnType<typeof setInterval> | null = null;
let pending = false;

function tell(next: boolean) {
  if (pending === next) return;
  pending = next;
  listeners.forEach((listener) => listener(next));
}

/** The wait is over, however it ended: the status is cleared, and nothing more is said. */
function settle() {
  if (speakTimer !== null) clearTimeout(speakTimer);
  if (arrivalCheck !== null) clearInterval(arrivalCheck);
  speakTimer = null;
  arrivalCheck = null;
  from = null;
  tell(false);
}

// Back and Forward move the address themselves, and a page being left needs no status.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", settle);
  window.addEventListener("pagehide", settle);
}

export function notePendingNavigation(url: string, type: "push" | "replace" | "traverse"): void {
  if (type === "traverse") {
    settle();
    return;
  }
  const here = window.location.href;
  const to = new URL(url, here);
  // A link to the page already showing never moves the address, and another site is the
  // browser's to load: there is no arrival to wait for. Nor is there for a wait whose
  // page has landed in the moment before this one began.
  if (from !== null && from !== here) settle();
  if (to.href === here || to.origin !== window.location.origin) {
    settle();
    return;
  }
  // A second navigation before the first has landed is the same wait: once it has been
  // said, it is not said again.
  from = here;
  if (!pending) {
    if (speakTimer !== null) clearTimeout(speakTimer);
    speakTimer = setTimeout(() => {
      speakTimer = null;
      if (window.location.href === from) tell(true);
    }, PENDING_SPOKEN_AFTER_MS);
  }
  arrivalCheck ??= setInterval(() => {
    if (window.location.href !== from) settle();
  }, ARRIVAL_CHECK_MS);
}

/** Calls back with true when the wait should be said, and false when it is over. */
export function subscribePendingNavigation(listener: Listener): () => void {
  listeners.add(listener);
  listener(pending);
  return () => {
    listeners.delete(listener);
  };
}
