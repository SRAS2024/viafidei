import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const keepBackPages: (source: string) => string = require("../../scripts/webpack/router-keeps-back-pages-loader.js");
const nextConfig = require("../../next.config.js");

const NEXT = path.dirname(require.resolve("next/package.json"));
const BUILDS = [
  "dist/client/components/router-reducer/aliased-prefetch-navigations.js",
  "dist/esm/client/components/router-reducer/aliased-prefetch-navigations.js",
].map((file) => path.join(NEXT, file));

/** What the rule does to a move, on the one thing it reads: the state and the URL. */
function answerFor(patched: string, canonicalUrl: string, to: string): unknown {
  const body = patched.match(/function handleAliasedPrefetchEntry\([^)]*\) \{ (if [^;]+;)/)?.[1];
  // eslint-disable-next-line no-new-func -- the patched line itself, not a copy of it
  return new Function("state", "url", `${body} return "the aliased path";`)(
    { canonicalUrl },
    new URL(to, "https://etviafidei.com"),
  );
}

describe("the rule that keeps the page Back leads to", () => {
  it("is needed: Next's router drops a segment's other pages on an aliased move", () => {
    // If this fails, Next has changed this path. Check Back on a production build,
    // and delete the loader, its rule in next.config.js and this file if it holds.
    const source = readFileSync(BUILDS[0]!, "utf8");
    expect(source).toContain("fillNewTreeWithOnlyLoadingSegments");
    const prefetch = readFileSync(
      path.join(NEXT, "dist/client/components/router-reducer/prefetch-cache-utils.js"),
      "utf8",
    );
    expect(prefetch).toContain("aliased: true");
  });

  it.each(BUILDS)("sends a move within a page the ordinary way: %s", (file) => {
    const patched = keepBackPages(readFileSync(file, "utf8"));
    expect(answerFor(patched, "/saints", "/saints?page=2")).toBe(false);
    expect(answerFor(patched, "/saints?page=2", "/saints?page=3")).toBe(false);
    expect(answerFor(patched, "/saints?page=2", "/saints")).toBe(false);
  });

  it.each(BUILDS)("leaves a move from elsewhere its loading state: %s", (file) => {
    const patched = keepBackPages(readFileSync(file, "utf8"));
    expect(answerFor(patched, "/prayers", "/saints?page=2")).toBe("the aliased path");
    expect(answerFor(patched, "/saints/saint-joseph", "/saints")).toBe("the aliased path");
  });

  it("changes a build once", () => {
    const once = keepBackPages(readFileSync(BUILDS[0]!, "utf8"));
    expect(keepBackPages(once)).toBe(once);
  });

  it("fails the build on a function it does not know, rather than quietly doing nothing", () => {
    expect(() => keepBackPages("function handleAliasedPrefetchEntry(state, data) {}")).toThrow(
      /is not one it knows/,
    );
  });

  it("is wired to the files a site build really uses", () => {
    const config = { module: { rules: [] as Array<{ test: RegExp; use: string }> } };
    nextConfig.webpack(config);
    const rule = config.module.rules.find((r) => r.use.includes("router-keeps-back-pages"))!;
    expect(existsSync(rule.use)).toBe(true);
    for (const file of BUILDS) expect(rule.test.test(file), file).toBe(true);
    expect(rule.test.test("/app/src/lib/aliased-prefetch-navigations.js")).toBe(false);
  });
});
