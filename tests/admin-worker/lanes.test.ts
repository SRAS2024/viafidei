/**
 * Internal worker lanes + concurrency controls (adaptive-worker Phase B).
 *
 * Pins the safety guarantees the concurrency design rests on:
 *   - a failing lane is isolated + never kills the others (self-repair),
 *   - activeOnly lanes are skipped while the brain is degraded,
 *   - a lane in error-backoff is skipped until its cooldown elapses,
 *   - published/advanced totals aggregate across lanes,
 *   - the global concurrency cap bounds how many lanes run at once,
 *   - claimArtifact is an atomic single-winner lease, and expired leases
 *     get reaped so a crashed lane's items become claimable again.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  claimArtifact,
  reapArtifactLeases,
  releaseArtifact,
  runWorkerLanes,
  type LaneDef,
} from "@/lib/admin-worker/lanes";

// ── A minimal in-memory fake Prisma covering exactly what lanes.ts touches ────

interface LaneStateRow {
  lane: string;
  status: string;
  lastError: string | null;
  lastFinishedAt: Date | null;
  capacity: number;
  concurrentTasks: number;
  [k: string]: unknown;
}

interface ArtifactRow {
  id: string;
  leasedBy: string | null;
  leaseExpiresAt: Date | null;
}

function fakePrisma(opts: { laneStates?: LaneStateRow[]; artifacts?: ArtifactRow[] } = {}) {
  const laneStates = new Map<string, LaneStateRow>(
    (opts.laneStates ?? []).map((s) => [s.lane, { ...s }]),
  );
  const artifacts = new Map<string, ArtifactRow>(
    (opts.artifacts ?? []).map((a) => [a.id, { ...a }]),
  );
  const logs: unknown[] = [];

  return {
    logs,
    laneStates,
    artifacts,
    adminWorkerLog: {
      create: async () => {
        logs.push(1);
        return {};
      },
    },
    adminWorkerLaneState: {
      findMany: async () => Array.from(laneStates.values()),
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { lane: string };
        update: Partial<LaneStateRow>;
        create: LaneStateRow;
      }) => {
        const existing = laneStates.get(where.lane);
        if (existing) Object.assign(existing, update);
        else laneStates.set(where.lane, { ...create });
        return laneStates.get(where.lane);
      },
    },
    adminWorkerPackageArtifact: {
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id?: string;
          leasedBy?: unknown;
          leaseExpiresAt?: { lt: Date };
          OR?: Array<{ leasedBy?: null; leaseExpiresAt?: { lt: Date } }>;
        };
        data: Partial<ArtifactRow>;
      }) => {
        let count = 0;
        for (const a of artifacts.values()) {
          if (where.id && a.id !== where.id) continue;
          // Reap query: leasedBy not null AND leaseExpiresAt < now.
          if (where.leasedBy && typeof where.leasedBy === "object") {
            if (a.leasedBy === null) continue;
          }
          if (where.leaseExpiresAt?.lt) {
            if (!a.leaseExpiresAt || a.leaseExpiresAt >= where.leaseExpiresAt.lt) continue;
          }
          // Claim query: OR[{leasedBy:null},{leaseExpiresAt<now}].
          if (where.OR) {
            const now = where.OR.find((c) => c.leaseExpiresAt)?.leaseExpiresAt?.lt;
            const free = a.leasedBy === null;
            const expired = Boolean(a.leaseExpiresAt && now && a.leaseExpiresAt < now);
            if (!free && !expired) continue;
          }
          Object.assign(a, data);
          count += 1;
        }
        return { count };
      },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FakePrisma = any;

const active = { active: true } as const;

afterEach(() => {
  delete process.env.ADMIN_WORKER_LANE_CONCURRENCY;
});

describe("runWorkerLanes", () => {
  it("isolates a failing lane — the others still run + record state", async () => {
    const prisma = fakePrisma();
    const ran: string[] = [];
    const lanes: LaneDef[] = [
      {
        name: "ok-a",
        capacity: 1,
        run: async () => {
          ran.push("ok-a");
          return { published: 2 };
        },
      },
      {
        name: "boom",
        capacity: 1,
        run: async () => {
          throw new Error("lane exploded");
        },
      },
      {
        name: "ok-b",
        capacity: 1,
        run: async () => {
          ran.push("ok-b");
          return { advanced: 3 };
        },
      },
    ];

    const res = await runWorkerLanes(prisma as FakePrisma, lanes, active);

    expect(ran.sort()).toEqual(["ok-a", "ok-b"]);
    expect(res.ran.sort()).toEqual(["ok-a", "ok-b"]);
    expect(res.errored).toEqual(["boom"]);
    expect(res.published).toBe(2);
    expect(res.advanced).toBe(3);
    // The failing lane recorded an error state (fuels the backoff + diagnostics).
    expect(prisma.laneStates.get("boom")?.status).toBe("error");
    expect(prisma.laneStates.get("boom")?.lastError).toMatch(/exploded/);
    expect(prisma.laneStates.get("ok-a")?.status).toBe("idle");
  });

  it("skips activeOnly lanes when the brain is degraded (not active)", async () => {
    const prisma = fakePrisma();
    let publishRan = false;
    const lanes: LaneDef[] = [
      {
        name: "publisher",
        capacity: 1,
        activeOnly: true,
        run: async () => {
          publishRan = true;
          return { published: 5 };
        },
      },
      { name: "ops", capacity: 1, run: async () => ({ advanced: 1 }) },
    ];

    const res = await runWorkerLanes(prisma as FakePrisma, lanes, { active: false });

    expect(publishRan).toBe(false);
    expect(res.skipped).toContain("publisher");
    expect(res.ran).toEqual(["ops"]);
    expect(res.published).toBe(0);
  });

  it("skips a lane still in error-backoff cooldown, runs it once cooled down", async () => {
    // Lane errored 1 minute ago; cooldown is 5 minutes → skipped.
    const recentlyErrored: LaneStateRow = {
      lane: "flaky",
      status: "error",
      lastError: "prior failure",
      lastFinishedAt: new Date(Date.now() - 60_000),
      capacity: 1,
      concurrentTasks: 0,
    };
    const prisma = fakePrisma({ laneStates: [recentlyErrored] });
    let ran = 0;
    const lanes: LaneDef[] = [
      { name: "flaky", capacity: 1, cooldownMs: 5 * 60_000, run: async () => void ran++ },
    ];

    const res1 = await runWorkerLanes(prisma as FakePrisma, lanes, active);
    expect(res1.skipped).toContain("flaky");
    expect(ran).toBe(0);

    // Age the error past the cooldown → the lane runs again.
    prisma.laneStates.get("flaky")!.lastFinishedAt = new Date(Date.now() - 6 * 60_000);
    const res2 = await runWorkerLanes(prisma as FakePrisma, lanes, active);
    expect(res2.ran).toContain("flaky");
    expect(ran).toBe(1);
  });

  it("bounds concurrency to ADMIN_WORKER_LANE_CONCURRENCY", async () => {
    process.env.ADMIN_WORKER_LANE_CONCURRENCY = "2";
    const prisma = fakePrisma();
    let inFlight = 0;
    let peak = 0;
    const makeLane = (name: string): LaneDef => ({
      name,
      capacity: 1,
      run: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 10));
        inFlight -= 1;
      },
    });
    const lanes = ["a", "b", "c", "d", "e"].map(makeLane);

    const res = await runWorkerLanes(prisma as FakePrisma, lanes, active);

    expect(res.ran.length).toBe(5);
    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(1); // genuinely concurrent, not accidentally serial
  });

  it("never throws even if lane-state persistence fails", async () => {
    const prisma = fakePrisma();
    prisma.adminWorkerLaneState.upsert = async () => {
      throw new Error("db down");
    };
    const lanes: LaneDef[] = [{ name: "x", capacity: 1, run: async () => ({ published: 1 }) }];
    // recordLaneState swallows its own errors, so the lane still runs + counts.
    const res = await runWorkerLanes(prisma as FakePrisma, lanes, active);
    expect(res.published).toBe(1);
    expect(res.ran).toEqual(["x"]);
  });
});

describe("claimArtifact (atomic lease / task ownership)", () => {
  it("exactly one caller wins an unleased artifact", async () => {
    const prisma = fakePrisma({
      artifacts: [{ id: "art1", leasedBy: null, leaseExpiresAt: null }],
    });
    const [a, b] = await Promise.all([
      claimArtifact(prisma as FakePrisma, "art1", "lane-a"),
      claimArtifact(prisma as FakePrisma, "art1", "lane-b"),
    ]);
    // JS is single-threaded across awaits: the first updateMany flips leasedBy,
    // so the second sees it leased and its conditional WHERE matches 0 rows.
    expect([a, b].filter(Boolean).length).toBe(1);
    expect(prisma.artifacts.get("art1")?.leasedBy).toMatch(/lane-[ab]/);
  });

  it("a second claim on a still-leased artifact fails", async () => {
    const prisma = fakePrisma({
      artifacts: [
        { id: "art1", leasedBy: "lane-a", leaseExpiresAt: new Date(Date.now() + 60_000) },
      ],
    });
    const won = await claimArtifact(prisma as FakePrisma, "art1", "lane-b");
    expect(won).toBe(false);
    expect(prisma.artifacts.get("art1")?.leasedBy).toBe("lane-a");
  });

  it("an expired lease is claimable by another lane", async () => {
    const prisma = fakePrisma({
      artifacts: [{ id: "art1", leasedBy: "dead-lane", leaseExpiresAt: new Date(Date.now() - 1) }],
    });
    const won = await claimArtifact(prisma as FakePrisma, "art1", "lane-b");
    expect(won).toBe(true);
    expect(prisma.artifacts.get("art1")?.leasedBy).toBe("lane-b");
  });

  it("releaseArtifact clears the lease", async () => {
    const prisma = fakePrisma({
      artifacts: [
        { id: "art1", leasedBy: "lane-a", leaseExpiresAt: new Date(Date.now() + 60_000) },
      ],
    });
    await releaseArtifact(prisma as FakePrisma, "art1");
    expect(prisma.artifacts.get("art1")?.leasedBy).toBeNull();
  });
});

describe("reapArtifactLeases", () => {
  it("clears only expired leases so crashed-lane items become claimable", async () => {
    const prisma = fakePrisma({
      artifacts: [
        { id: "expired", leasedBy: "dead", leaseExpiresAt: new Date(Date.now() - 1000) },
        { id: "live", leasedBy: "alive", leaseExpiresAt: new Date(Date.now() + 60_000) },
        { id: "free", leasedBy: null, leaseExpiresAt: null },
      ],
    });
    const reaped = await reapArtifactLeases(prisma as FakePrisma);
    expect(reaped).toBe(1);
    expect(prisma.artifacts.get("expired")?.leasedBy).toBeNull();
    expect(prisma.artifacts.get("live")?.leasedBy).toBe("alive");
  });
});
