/**
 * The safety net under every client navigation: a <Link>, router.push, router.replace.
 *
 * A navigation that goes quiet is the worst thing a link can do, above all to a reader
 * who cannot see the page: nothing changes and nothing is said. Whatever the cause, the
 * page and its address can still be had the plain way, so if the address has not moved
 * after a good while, the browser is sent there directly.
 *
 * A healthy navigation takes well under a second on the live site, and up to six seconds
 * when the server is having a slow moment, so the wait is longer than that. If a slow
 * server does outlast it, the cost is a full page load instead of a soft one, which still
 * lands on the right page.
 */
export const NAVIGATION_PATIENCE_MS = 8000;

let watching: ReturnType<typeof setTimeout> | null = null;

function stopWatching() {
  if (watching !== null) clearTimeout(watching);
  watching = null;
}

// A page kept in the back/forward cache keeps its timers too. Coming back to it must not
// finish a navigation the reader has already left behind.
if (typeof window !== "undefined") window.addEventListener("pagehide", stopWatching);

export function watchNavigation(url: string, type: "push" | "replace" | "traverse"): void {
  // Only the newest navigation counts: the router drops any older one.
  stopWatching();
  // Back and forward have moved the address already, so there would be nothing to see.
  if (type === "traverse") return;
  const from = window.location.href;
  const to = new URL(url, from);
  // Nowhere to go, or the router is leaving the site with a real page load of its own.
  if (to.href === from || to.origin !== window.location.origin) return;
  watching = setTimeout(() => {
    watching = null;
    // Any move counts as landed, since a redirect can land somewhere other than `to`.
    if (window.location.href !== from) return;
    if (type === "replace") window.location.replace(to.href);
    else window.location.assign(to.href);
  }, NAVIGATION_PATIENCE_MS);
}
