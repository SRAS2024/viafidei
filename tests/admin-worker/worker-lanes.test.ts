/**
 * The concrete fine-grained lane set. Pins the invariants the concurrency
 * design rests on so a future edit can't silently break them:
 *   - lane names are unique (lane-state is keyed by name),
 *   - ALL_LANE_NAMES is exactly the union of both groups,
 *   - only the web-funnel discovery lanes are activeOnly (the deterministic
 *     ingests and enrichments keep running while the brain is degraded),
 *   - the ops lanes that must NOT gate on active mode still run every pass,
 *   - all Python-brain-calling work stays in the single `intelligence` lane,
 *   - the coarse pre-split lanes are gone (fine-grained decomposition landed).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CONTENT_LANES, OPS_LANES, ALL_LANE_NAMES } from "@/lib/admin-worker/worker-lanes";

describe("worker lane set", () => {
  const all = [...CONTENT_LANES, ...OPS_LANES];

  it("has unique lane names across both groups", () => {
    const names = all.map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("ALL_LANE_NAMES is the union of content + ops lane names", () => {
    expect([...ALL_LANE_NAMES].sort()).toEqual(all.map((l) => l.name).sort());
  });

  it("is genuinely fine-grained (many more lanes than the old 3+7 grouping)", () => {
    expect(CONTENT_LANES.length).toBeGreaterThanOrEqual(9);
    expect(OPS_LANES.length).toBeGreaterThanOrEqual(10);
  });

  it("gates only the web-funnel discovery lanes on the Python brain", () => {
    // Brain gating is per lane, by what the lane needs. The curated, structured
    // and liturgical ingests publish with skipBrainScreens (identical gates in
    // both modes), the enrichments are deterministic maintenance, and OSM
    // parishes never had a brain step — so a Python outage must not stop them
    // (it used to halt 14 of the 15 content types). Only the lanes that feed the
    // WEB funnel wait for the brain: nothing consumes their candidates until the
    // brain is back to choose the fetch/extract stages and screen the publish.
    const gated = CONTENT_LANES.filter((l) => l.activeOnly).map((l) => l.name);
    expect(gated.sort()).toEqual(["discover-structured", "discover-web"]);
    for (const name of [
      "ingest-curated",
      "ingest-structured",
      "ingest-liturgical",
      "enrich-translations",
      "enrich-reviews",
      "enrich-pope-cleanup",
      "discover-parish-osm",
    ]) {
      expect(CONTENT_LANES.find((l) => l.name === name)?.activeOnly, name).toBeFalsy();
    }
  });

  it("splits the old coarse ingestion/enrichment/discovery/maintenance lanes", () => {
    const names = new Set(all.map((l) => l.name));
    // The coarse grouped lanes must no longer exist…
    for (const gone of ["ingestion", "enrichment", "discovery", "maintenance"]) {
      expect(names.has(gone)).toBe(false);
    }
    // …replaced by their per-workstream fine lanes.
    for (const fine of [
      "ingest-curated",
      "ingest-structured",
      "ingest-liturgical",
      "enrich-translations",
      "enrich-reviews",
      "enrich-pope-cleanup",
      "discover-structured",
      "discover-parish-osm",
      "discover-web",
      "maint-schema",
      "maint-ui",
      "maint-self-model",
      "maint-custody",
    ]) {
      expect(names.has(fine)).toBe(true);
    }
  });

  it("keeps all brain-calling work in a single lane (never concurrent brain calls)", () => {
    // The intelligence lane is the ONE lane that calls the resident Python
    // brain; it must exist and remain a single lane.
    expect(OPS_LANES.filter((l) => l.name === "intelligence").length).toBe(1);
  });

  it("every lane has a positive informational capacity and a run fn", () => {
    for (const lane of all) {
      expect(typeof lane.run).toBe("function");
      expect(lane.capacity).toBeGreaterThan(0);
    }
  });

  it("has the self-maintenance lane, and it is an OPS lane by design", () => {
    // The resource guarantee the owner asked for: ops lanes run only inside a
    // pass, passes run only inside the loop, and the loop runs only while the
    // master switch is ON (loop.ts checkLoopAuthority). Making this a CONTENT
    // lane would also gate it on the Python brain — the worker must be able to
    // repair itself precisely when the brain is down.
    const lane = OPS_LANES.find((l) => l.name === "maint-self-heal");
    expect(lane).toBeDefined();
    expect(CONTENT_LANES.some((l) => l.name === "maint-self-heal")).toBe(false);
    expect(lane!.capacity).toBe(1);
    expect(lane!.activeOnly).toBeFalsy();
    expect(lane!.watchdogMs).toBe(6 * 60 * 1000);
  });

  it("has the deterministic custodial lanes that keep published content honest", () => {
    // Both are deterministic (no brain judgement) and UNPUBLISH rather than
    // delete, so the catalog stays honest even while the brain is degraded.
    for (const name of ["repair-structured-saints", "verify-parish-websites"]) {
      const lane = OPS_LANES.find((l) => l.name === name);
      expect(lane, name).toBeDefined();
      expect(lane!.activeOnly).toBeFalsy();
      expect(lane!.capacity).toBe(1);
    }
  });

  it("gives every network-walking lane a watchdog above the 120s default", () => {
    // A run that fetches per candidate (15s x 3 attempts each) blew through the
    // default watchdog mid-batch, went into error-backoff, and the goal stalled
    // (audit SI-10). These lanes are budgeted like the other network-heavy ones.
    for (const name of [
      "ingest-structured",
      "repair-structured-saints",
      "verify-parish-websites",
    ]) {
      const lane = all.find((l) => l.name === name);
      expect(lane!.watchdogMs, name).toBeGreaterThanOrEqual(6 * 60 * 1000);
    }
  });

  it("documents the brain bridge honestly: it does NOT queue", () => {
    // The header used to claim the bridge "multiplexes" calls so they "queue
    // behind each other". It does not: the resident brain answers one request
    // at a time and every caller's timeout starts the moment it writes, so a
    // second concurrent caller burns its timeout waiting. The lanes that call
    // the brain outside `intelligence` serialise through withBrainMutex.
    const src = readFileSync(join(process.cwd(), "src/lib/admin-worker/worker-lanes.ts"), "utf8");
    const header = src.slice(0, src.indexOf("import "));
    expect(header).not.toMatch(/multiplexes/);
    expect(header).toContain("does NOT queue");
    expect(header).toContain("withBrainMutex");
  });
});

describe("brain-mutex is part of the public admin-worker surface", () => {
  // Importing the package index pulls the whole ~150-module worker tree (395
  // exports). That costs ~0.5 s on an idle machine, but the transform runs
  // inside whichever worker picks this file up, and with the full suite
  // saturating every core it can exceed the 5 s default. The import cost is a
  // test-environment artifact, not a runtime one — the web server deliberately
  // avoids this barrel (see the comment in src/app/admin/diagnostics/page.tsx).
  it("is re-exported from the package index", { timeout: 30_000 }, async () => {
    const index = await import("@/lib/admin-worker");
    expect(typeof index.withBrainMutex).toBe("function");
    expect(typeof index.brainMutexState).toBe("function");
    expect(index.brainMutexState()).toEqual({ held: false, waiting: 0 });
  });
});
