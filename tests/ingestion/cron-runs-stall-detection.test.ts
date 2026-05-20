/**
 * Cron wires the growth-stall taxonomy (spec §16).
 *
 * Spec §16: "Add growth stall detection for every content type."
 * The 13-reason taxonomy in growth-stall-taxonomy.ts is only useful
 * if something *runs* detectStalls() on a cadence. This test pins
 * that the cron ingest route imports and invokes detectStalls() so
 * the taxonomy can never silently become dead code again (as
 * planDiscoveryExpansion did before it was wired).
 *
 * It is a source-level structural test — the full cron route is too
 * heavy to execute in a unit test, but the import + call site is
 * exactly what a regression would remove.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CRON_ROUTE = join(process.cwd(), "src", "app", "api", "cron", "ingest", "route.ts");

describe("Cron runs growth-stall detection (spec §16)", () => {
  const body = readFileSync(CRON_ROUTE, "utf8");

  it("imports detectStalls from the growth-stall taxonomy", () => {
    expect(body).toMatch(/detectStalls/);
    expect(body).toMatch(/growth-stall-taxonomy/);
  });

  it("invokes detectStalls() during the cron tick", () => {
    expect(body).toMatch(/await\s+detectStalls\(\)/);
  });

  it("surfaces the detected stalls in the cron completion log", () => {
    expect(body).toMatch(/growthStallsDetected/);
  });

  it("also wires automatic discovery expansion (spec §4)", () => {
    // source_config_repair runs runDiscoveryExpansion — the cron
    // enqueues source_config_repair, closing the §4 loop.
    expect(body).toMatch(/source_config_repair/);
  });
});
