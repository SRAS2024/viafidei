/**
 * The execution boundary: the Admin Worker runs on the operator's MacBook, and
 * the production web service must never execute worker computation.
 *
 * Pins:
 *   - the Next.js server runtime is refused outright,
 *   - the retained Railway worker refuses unless deliberately overridden,
 *   - the local runtime is allowed,
 *   - the master switch and the single execution lease behave as designed
 *     (OFF means off everywhere; one executor at a time; no cloud failover).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __resetWorkerExecutionOrigin,
  allowRemoteExecutionOverride,
  assertWorkerExecutionAllowed,
  markWorkerExecutionOrigin,
  workerExecutionAllowed,
  workerExecutionOrigin,
  WorkerExecutionForbiddenError,
} from "@/lib/admin-worker/execution-context";
import {
  acquireExecutionLease,
  holdsExecutionLease,
  readExecutionStatus,
  readMasterSwitch,
  releaseExecutionLease,
  renewExecutionLease,
  setMasterSwitch,
  LEASE_TTL_MS,
} from "@/lib/admin-worker/execution-host";

const HOST = {
  label: "Mac · M3 · 12 cores",
  platform: "darwin",
  arch: "arm64",
  cpuCount: 12,
  launchedBy: "swift-app",
};

/** Minimal in-memory stand-in for the AdminWorkerMemory table. */
function fakePrisma() {
  const rows = new Map<string, { memoryValue: unknown; updatedAt: Date }>();
  let clock = 0;
  return {
    rows,
    adminWorkerMemory: {
      findUnique: async ({
        where,
      }: {
        where: { memoryType_memoryKey: { memoryType: string; memoryKey: string } };
      }) => rows.get(where.memoryType_memoryKey.memoryKey) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { memoryType_memoryKey: { memoryType: string; memoryKey: string } };
        create: { memoryValue: unknown };
        update: { memoryValue?: unknown };
      }) => {
        const key = where.memoryType_memoryKey.memoryKey;
        const existing = rows.get(key);
        clock += 1;
        const value = existing ? (update.memoryValue ?? existing.memoryValue) : create.memoryValue;
        rows.set(key, { memoryValue: value, updatedAt: new Date(clock) });
        return { memoryValue: value };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { memoryKey: string; updatedAt: Date };
        data: { memoryValue: unknown };
      }) => {
        const existing = rows.get(where.memoryKey);
        if (!existing || existing.updatedAt.getTime() !== where.updatedAt.getTime()) {
          return { count: 0 };
        }
        clock += 1;
        rows.set(where.memoryKey, { memoryValue: data.memoryValue, updatedAt: new Date(clock) });
        return { count: 1 };
      },
      delete: async ({
        where,
      }: {
        where: { memoryType_memoryKey: { memoryType: string; memoryKey: string } };
      }) => {
        rows.delete(where.memoryType_memoryKey.memoryKey);
        return {};
      },
    },
  } as never;
}

describe("process-level execution boundary", () => {
  const originalRuntime = process.env.NEXT_RUNTIME;

  beforeEach(() => __resetWorkerExecutionOrigin());
  afterEach(() => {
    __resetWorkerExecutionOrigin();
    if (originalRuntime === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = originalRuntime;
  });

  it("refuses worker computation inside the Next.js server runtime", () => {
    process.env.NEXT_RUNTIME = "nodejs";
    expect(workerExecutionOrigin()).toBe("SERVER_WEB");
    expect(workerExecutionAllowed()).toBe(false);
    expect(() => assertWorkerExecutionAllowed("run a pass")).toThrow(WorkerExecutionForbiddenError);
  });

  it("allows the local MacBook runtime", () => {
    markWorkerExecutionOrigin("LOCAL_MACBOOK");
    expect(workerExecutionAllowed()).toBe(true);
    expect(() => assertWorkerExecutionAllowed("run a pass")).not.toThrow();
  });

  it("refuses the retained Railway worker unless deliberately overridden", () => {
    markWorkerExecutionOrigin("RAILWAY_WORKER");
    expect(workerExecutionAllowed()).toBe(false);
    allowRemoteExecutionOverride("operator restored cloud execution");
    expect(workerExecutionAllowed()).toBe(true);
  });

  it("treats plain CLI/test processes as standalone and allowed", () => {
    delete process.env.NEXT_RUNTIME;
    expect(workerExecutionOrigin()).toBe("STANDALONE");
    expect(workerExecutionAllowed()).toBe(true);
  });
});

describe("master switch + execution lease", () => {
  it("defaults to OFF and reports intentional inactivity", async () => {
    const prisma = fakePrisma();
    expect((await readMasterSwitch(prisma)).on).toBe(false);
    const status = await readExecutionStatus(prisma);
    expect(status.state).toBe("OFF");
    expect(status.executingLocally).toBe(false);
    expect(status.label).toMatch(/intentionally inactive/i);
  });

  it("reports local execution once the switch is on and a lease is held", async () => {
    const prisma = fakePrisma();
    await setMasterSwitch(prisma, { on: true, actor: "operator", from: "swift-app" });
    const claim = await acquireExecutionLease(prisma, {
      runtimeId: "local-1",
      origin: "LOCAL_MACBOOK",
      host: HOST,
    });
    expect(claim.acquired).toBe(true);

    const status = await readExecutionStatus(prisma);
    expect(status.state).toBe("LOCAL_ACTIVE");
    expect(status.executingLocally).toBe(true);
    expect(status.lease?.host.label).toBe(HOST.label);
    expect(await holdsExecutionLease(prisma, "local-1")).toBe(true);
  });

  it("refuses a second executor while a live lease is held", async () => {
    const prisma = fakePrisma();
    await setMasterSwitch(prisma, { on: true });
    await acquireExecutionLease(prisma, {
      runtimeId: "local-1",
      origin: "LOCAL_MACBOOK",
      host: HOST,
    });
    const second = await acquireExecutionLease(prisma, {
      runtimeId: "railway-1",
      origin: "RAILWAY_WORKER",
      host: { ...HOST, label: "railway", launchedBy: "remote" },
    });
    expect(second.acquired).toBe(false);
    expect(second.refusedBecause).toMatch(/holds the execution lease/i);
    expect(await holdsExecutionLease(prisma, "railway-1")).toBe(false);
  });

  it("lets a stale lease be taken over, but never fails over automatically", async () => {
    const prisma = fakePrisma();
    await setMasterSwitch(prisma, { on: true });
    await acquireExecutionLease(prisma, {
      runtimeId: "local-1",
      origin: "LOCAL_MACBOOK",
      host: HOST,
    });

    // Age the lease past its TTL, as a crashed / sleeping Mac would.
    const key = "worker.execution.lease";
    const row = prisma.adminWorkerMemory as unknown as {
      findUnique: (a: unknown) => Promise<{ memoryValue: Record<string, unknown> } | null>;
    };
    const current = await row.findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
    });
    (current!.memoryValue as Record<string, unknown>).renewedAt = new Date(
      Date.now() - LEASE_TTL_MS - 5_000,
    ).toISOString();

    // Nothing takes over on its own: status reports a disconnected local worker.
    const status = await readExecutionStatus(prisma);
    expect(status.state).toBe("LOCAL_DISCONNECTED");
    expect(status.label).toMatch(/no cloud failover/i);

    // A relaunched local runtime may claim it.
    const retake = await acquireExecutionLease(prisma, {
      runtimeId: "local-2",
      origin: "LOCAL_MACBOOK",
      host: HOST,
    });
    expect(retake.acquired).toBe(true);
  });

  it("renews only for the holder and releases cleanly", async () => {
    const prisma = fakePrisma();
    await setMasterSwitch(prisma, { on: true });
    await acquireExecutionLease(prisma, {
      runtimeId: "local-1",
      origin: "LOCAL_MACBOOK",
      host: HOST,
    });
    expect(await renewExecutionLease(prisma, "local-1")).toBe("renewed");
    expect(await renewExecutionLease(prisma, "someone-else")).toBe("lost");

    await releaseExecutionLease(prisma, "local-1");
    expect(await holdsExecutionLease(prisma, "local-1")).toBe(false);
    expect((await readExecutionStatus(prisma)).state).toBe("LOCAL_DISCONNECTED");
  });

  it("OFF means off everywhere, even while a lease row lingers", async () => {
    const prisma = fakePrisma();
    await setMasterSwitch(prisma, { on: true });
    await acquireExecutionLease(prisma, {
      runtimeId: "local-1",
      origin: "LOCAL_MACBOOK",
      host: HOST,
    });
    await setMasterSwitch(prisma, { on: false, actor: "operator" });
    const status = await readExecutionStatus(prisma);
    expect(status.state).toBe("OFF");
    expect(status.executingLocally).toBe(false);
  });
});

describe("execution host — an unreachable database is never mistaken for OFF", () => {
  const broken = {
    adminWorkerMemory: {
      findUnique: async () => {
        throw new Error("P1001: Can't reach database server at `db.example`:5432");
      },
      upsert: async () => {
        throw new Error("P1001");
      },
      updateMany: async () => {
        throw new Error("P1001");
      },
      delete: async () => {
        throw new Error("P1001");
      },
    },
  } as unknown as Parameters<typeof readMasterSwitch>[0];

  it("readMasterSwitch reports known:false with the error instead of OFF", async () => {
    const m = await readMasterSwitch(broken);
    expect(m.known).toBe(false);
    expect(m.on).toBe(false);
    expect(m.error).toMatch(/P1001/);
  });

  it("renewExecutionLease answers 'unknown', not 'lost'", async () => {
    expect(await renewExecutionLease(broken, "local-1")).toBe("unknown");
  });

  it("readExecutionStatus is marked unknown and says why", async () => {
    const s = await readExecutionStatus(broken);
    expect(s.known).toBe(false);
    expect(s.label).toMatch(/could not be read/);
  });

  it("acquireExecutionLease refuses with a database reason rather than claiming", async () => {
    const claim = await acquireExecutionLease(broken, {
      runtimeId: "local-1",
      origin: "LOCAL_MACBOOK",
      host: HOST,
    });
    expect(claim.acquired).toBe(false);
    expect(claim.refusedBecause).toMatch(/could not be reached/);
  });
});
