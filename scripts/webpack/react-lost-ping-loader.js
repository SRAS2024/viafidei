/**
 * Backports one line of React to the copy Next 15.5 bundles, while the site builds.
 *
 * A client navigation could stop dead: the link was pressed, the server's answer arrived
 * whole, and the address and the page never changed, with nothing said and nothing logged.
 * Safari lost as many as one in three on the worst links and Chromium fewer, all of them
 * links that stay on the same page: a filter, a page number, a Mass choice, the readings
 * correcting to the visitor's date.
 *
 * On its way through the new page, React reaches a part of the server's answer that has not
 * arrived, and yields for a moment. If that part lands in that moment, React goes on to ask
 * it for a wake-up, and it answers at once, in the middle of the render. A render already
 * marked as waiting cannot restart from inside itself, so pingSuspendedRoot drops the
 * answer, and the render ends waiting for a wake-up that has been and gone. Only some later,
 * unrelated update ever moved it on.
 *
 * React fixed this in 19.3 (its PR #36134): a wake-up during a render is recorded, as the
 * other branch already did. Next 16.4.5 bundles the fix; Next 15.5.29 does not. Upgrade Next
 * past it and this file passes through untouched: delete it then, along with its rule in
 * next.config.js. Anything else fails the build, because a quiet miss here brings the bug
 * back.
 */

// `0 === (executionContext & 2) && prepareFreshStack(root, 0)` in the production builds,
// `(executionContext & RenderContext) === NoContext && prepareFreshStack(root, 0)` in the
// development builds. Either way, the wake-up is dropped when the condition is false.
const DROPPED =
  /\?\s*(0 === \(executionContext & 2\)|\(executionContext & RenderContext\) === NoContext)\s*&&\s*prepareFreshStack\(root, 0\)\s*:\s*\(workInProgressRootPingedLanes \|= pingedLanes\)/g;
const RECORDED =
  /\?\s*(0 === \(executionContext & 2\)|\(executionContext & RenderContext\) === NoContext)\s*\?\s*prepareFreshStack\(root, 0\)\s*:\s*\(workInProgressRootPingedLanes \|= pingedLanes\)\s*:\s*\(workInProgressRootPingedLanes \|= pingedLanes\)/;

function recordRenderPhasePing(source) {
  const dropped = source.match(DROPPED);
  if (dropped?.length === 1) {
    return source.replace(
      DROPPED,
      "? $1 ? prepareFreshStack(root, 0) : (workInProgressRootPingedLanes |= pingedLanes) : (workInProgressRootPingedLanes |= pingedLanes)",
    );
  }
  if (!dropped && RECORDED.test(source)) return source;
  throw new Error(
    "react-lost-ping-loader: this React's pingSuspendedRoot is not one it knows. " +
      "See scripts/webpack/react-lost-ping-loader.js: check that a wake-up during a render is still recorded.",
  );
}

module.exports = recordRenderPhasePing;
