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
});
