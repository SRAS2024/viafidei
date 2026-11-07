import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const recordRenderPhasePing: (source: string) => string = require("../../scripts/webpack/react-lost-ping-loader.js");
const nextConfig = require("../../next.config.js");

const COMPILED = path.dirname(require.resolve("next/dist/compiled/react-dom/package.json"));

function navigate(...args: string[]): string {
  const fixture = path.join(__dirname, "react-lost-ping.fixture.cjs");
  return execFileSync(process.execPath, [fixture, ...args], { encoding: "utf8" }).trim();
}

describe("the backport of React's fix for a lost navigation", () => {
  it("is still needed: Next's React as shipped loses the navigation", () => {
    // If this fails, Next has taken React's fix. Delete the loader, its rule in
    // next.config.js and these tests.
    expect(navigate()).toBe("STUCK");
  });

  it("lets the same navigation commit", () => {
    expect(navigate("--through-loader")).toBe("COMMITTED");
  });

  it("changes every build of React that a site build can use, in the one place", () => {
    const builds = [
      "cjs/react-dom-client.production.js",
      "cjs/react-dom-client.development.js",
      "cjs/react-dom-profiling.profiling.js",
      "cjs/react-dom-profiling.development.js",
    ];
    for (const build of builds) {
      const source = readFileSync(path.join(COMPILED, build), "utf8");
      const fixed = recordRenderPhasePing(source);
      expect(fixed, build).not.toBe(source);
      // One ternary becomes two, and nothing else moves.
      expect(fixed.split("workInProgressRootPingedLanes |= pingedLanes").length, build).toBe(
        source.split("workInProgressRootPingedLanes |= pingedLanes").length + 1,
      );
      expect(recordRenderPhasePing(fixed), build).toBe(fixed);
    }
  });

  it("fails the build on a React it does not recognise", () => {
    expect(() => recordRenderPhasePing("function pingSuspendedRoot() {}")).toThrow(
      /react-lost-ping-loader/,
    );
  });

  it("is applied to the file the client build really uses", () => {
    const config = { module: { rules: [] as { test: RegExp; use: string }[] } };
    nextConfig.webpack(config);
    const rule = config.module.rules.find((r) =>
      r.test.test(path.join(COMPILED, "cjs/react-dom-client.production.js")),
    );
    expect(rule?.use).toBe(path.resolve(__dirname, "../../scripts/webpack/react-lost-ping-loader.js"));
    expect(rule?.test.test(path.join(COMPILED, "cjs/react-dom-server.browser.production.js"))).toBe(false);
  });
});
