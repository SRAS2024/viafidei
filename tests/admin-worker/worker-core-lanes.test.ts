/**
 * Lane rules touched by the liveness audit (LIVE-4/DG-4, LIVE-6):
 *   - campaign DRAIN pauses only WEB discovery; OSM/structured discovery keep
 *     running (they publish straight to PublishedContent and have nothing to do
 *     with the web funnel being drained);
 *   - a watchdog-expired lane's cooldown is at least its watchdog, so a run
 *     that may still be executing in the background can't overlap the next.
 */
import { describe, expect, it } from "vitest";

import { runWorkerLanes, type LaneDef } from "@/lib/admin-worker/lanes";
import { CONTENT_LANES } from "@/lib/admin-worker/worker-lanes";

function fakePrisma(states: Array<Record<string, unknown>> = []) {
  const laneStates = new Map(states.map((s) => [s.lane as string, { ...s }]));
  return {
    laneStates,
    adminWorkerLog: { create: async () => ({}) },
    adminWorkerLaneState: {
      findMany: async () => [...laneStates.values()],
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { lane: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => {
        const cur = laneStates.get(where.lane);
        laneStates.set(where.lane, cur ? { ...cur, ...update } : { ...create });
        return {};
      },
    },
  };
}

describe("campaign DRAIN skips only web discovery", () => {
  it("runs a non-web discovery lane during DRAIN and skips the web one", async () => {
    const prisma = fakePrisma();
    let osm = 0;
    let web = 0;
    const lanes: LaneDef[] = [
      { name: "discover-parish-osm", capacity: 1, discovery: true, run: async () => void osm++ },
      {
        name: "discover-web",
        capacity: 1,
        discovery: true,
        web: true,
        run: async () => void web++,
      },
    ];
    const r = await runWorkerLanes(prisma as never, lanes, {
      active: true,
      campaignPhase: "DRAIN",
    });
    expect(r.ran).toContain("discover-parish-osm");
    expect(r.skipped).toContain("discover-web");
    expect(osm).toBe(1);
    expect(web).toBe(0);
  });

  it("only discover-web carries the web flag among the real content lanes", () => {
    const webLanes = CONTENT_LANES.filter((l) => l.web).map((l) => l.name);
    expect(webLanes).toEqual(["discover-web"]);
    // The OSM parish + structured lanes stay discovery (so other rules apply)
    // but NOT web.
    for (const name of ["discover-parish-osm", "discover-structured"]) {
      const lane = CONTENT_LANES.find((l) => l.name === name);
      expect(lane?.discovery).toBe(true);
      expect(lane?.web).toBeUndefined();
    }
  });
});

describe("watchdog-aware error cooldown", () => {
  it("a lane that tripped its watchdog stays in cooldown for at least the watchdog window", async () => {
    // Errored 6 min ago on a watchdog — past the default 5 min cooldown, but
    // the lane's own watchdog is 10 min, so it must still be skipped.
    const prisma = fakePrisma([
      {
        lane: "drain",
        status: "error",
        lastError: "lane watchdog: 'drain' exceeded 600000ms",
        lastFinishedAt: new Date(Date.now() - 6 * 60 * 1000),
        capacity: 1,
        concurrentTasks: 0,
      },
      {
        lane: "plain",
        status: "error",
        lastError: "boom",
        lastFinishedAt: new Date(Date.now() - 6 * 60 * 1000),
        capacity: 1,
        concurrentTasks: 0,
      },
    ]);
    let drained = 0;
    let plain = 0;
    const lanes: LaneDef[] = [
      { name: "drain", capacity: 1, watchdogMs: 10 * 60 * 1000, run: async () => void drained++ },
      { name: "plain", capacity: 1, watchdogMs: 10 * 60 * 1000, run: async () => void plain++ },
    ];
    const r = await runWorkerLanes(prisma as never, lanes, { active: true });
    expect(r.skipped).toContain("drain");
    expect(drained).toBe(0);
    // An ordinary error keeps the ordinary 5 min cooldown.
    expect(r.ran).toContain("plain");
    expect(plain).toBe(1);
  });
});
