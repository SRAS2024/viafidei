/**
 * The concrete fine-grained lane set. Pins the invariants the concurrency
 * design rests on so a future edit can't silently break them:
 *   - lane names are unique (lane-state is keyed by name),
 *   - ALL_LANE_NAMES is exactly the union of both groups,
 *   - every CONTENT lane is activeOnly (they publish/grow public content),
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

  it("every content lane is activeOnly EXCEPT the deterministic parish lane", () => {
    // Content lanes gate on the Python brain (safe-degraded contract) — with one
    // deliberate exception: `discover-parish-osm` grows parishes deterministically
    // (OSM roman_catholic tag + communion verifier + strict schema + publish
    // orchestrator, no brain judgement), so it keeps publishing even when the
    // brain is degraded. That is required so a Python outage never stalls the
    // parish directory (the EXTRACTING_WITHOUT_PUBLISHING failure mode).
    for (const lane of CONTENT_LANES) {
      if (lane.name === "discover-parish-osm") {
        expect(lane.activeOnly).toBeFalsy();
      } else {
        expect(lane.activeOnly).toBe(true);
      }
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
  it("is re-exported from the package index", async () => {
    const index = await import("@/lib/admin-worker");
    expect(typeof index.withBrainMutex).toBe("function");
    expect(typeof index.brainMutexState).toBe("function");
    expect(index.brainMutexState()).toEqual({ held: false, waiting: 0 });
  });
});
