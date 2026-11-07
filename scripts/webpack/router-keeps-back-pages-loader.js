/**
 * Keeps the page a reader can go Back to, while the site builds on Next 15.5.
 *
 * In a production build, Next reads a move to another view of the page on screen
 * (/saints to /saints?page=2) as a use of the prefetched /saints, in order to show its
 * loading state at once. No loading state shows, because the page is already on screen.
 * But the move rebuilds the router's cache from that prefetch alone, and everything it
 * held is forgotten, so Back finds nothing: the title goes blank while the page is
 * fetched again, the route announcer reads out the <h1> and then the title when it
 * comes, a placeholder takes the page's place, and the scroll position goes with it.
 * It also drops a `scroll: false`. A development build skips this path altogether.
 *
 * Next's own way out is for this function to answer false: the move then goes the
 * ordinary way, which keeps the cache and still holds the old page until the new one
 * arrives. So it answers false for a move within a page, and a move from elsewhere keeps
 * its loading state.
 *
 * Next's newer routers have no such function. Upgrade past it and this rule matches
 * nothing: delete this file, its rule in next.config.js and its test. If the function is
 * there but is not the one this was written for, the build fails, because a quiet miss
 * here brings the bug back.
 */

const SIGNATURE =
  /function handleAliasedPrefetchEntry\(navigatedAt, state, flightData, url, mutable\) \{/;
const SAME_PAGE = "if (new URL(state.canonicalUrl, url).pathname === url.pathname) return false;";

function keepBackPages(source) {
  if (source.includes(SAME_PAGE)) return source;
  if (!SIGNATURE.test(source)) {
    throw new Error(
      "router-keeps-back-pages-loader: this Next's handleAliasedPrefetchEntry is not one it knows. " +
        "See scripts/webpack/router-keeps-back-pages-loader.js: check that Back still finds a page in the cache.",
    );
  }
  return source.replace(SIGNATURE, (signature) => `${signature} ${SAME_PAGE}`);
}

module.exports = keepBackPages;
