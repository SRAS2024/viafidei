"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * How long a placeholder made in the browser waits before saying it is loading. A page
 * that arrives sooner says nothing but its new title, which Next's announcer speaks.
 */
export const LOADING_SPOKEN_AFTER_MS = 500;

const noSubscription = () => () => {};

/**
 * What a screen reader is told while a placeholder shows. It goes beside the busy
 * wrapper, never in it: ARIA lets a screen reader hold back a live region that is
 * busy, or inside something busy, until that is over, and this one is gone by then.
 *
 * Sent with the page, it holds its words from the first byte, for a reader who finds
 * it there. Made in the browser, on a client navigation or a client component's own
 * wait, it starts empty and its words follow a moment later: VoiceOver announces a
 * live region whose words change, and says nothing of one that arrives already
 * holding them.
 *
 * It takes its words from the caller and reads no language of its own, so a client
 * component's placeholder can use it as well as a server component's.
 */
export function LoadingStatus({ children }: { children: string }) {
  // False on the server and while hydrating what it sent; true for a status the
  // browser made itself.
  const madeHere = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const [spoken, setSpoken] = useState(!madeHere);
  useEffect(() => {
    if (spoken) return;
    const timer = window.setTimeout(() => setSpoken(true), LOADING_SPOKEN_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [spoken]);
  return (
    <p role="status" className="sr-only">
      {spoken ? children : ""}
    </p>
  );
}
