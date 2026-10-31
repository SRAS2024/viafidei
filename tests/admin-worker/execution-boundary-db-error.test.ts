/**
 * When the database is unreachable the operator must be told WHY.
 *
 * Prisma's message opens with "Invalid `prisma.adminWorkerMemory.findUnique()`
 * invocation" and a source excerpt; the real cause ("Can't reach database
 * server at …") is several lines down. execution-host used to surface that
 * first line as MasterSwitch.error / ExecutionStatus.error, so a network
 * outage read as a query bug in the app and in diagnostics (audit LH-01).
 * It now reuses `summarizeDatabaseError` from local-config — the same
 * summariser the launcher shows — so both surfaces name the same cause.
 */
import { describe, expect, it, vi } from "vitest";

import {
  acquireExecutionLease,
  readExecutionStatus,
  readMasterSwitch,
} from "@/lib/admin-worker/execution-host";

const CLAIM = {
  runtimeId: "local-macbook-1-abc",
  origin: "LOCAL_MACBOOK" as const,
  host: { label: "test mac", platform: "darwin", arch: "arm64", cpuCount: 8, launchedBy: "cli" },
};

/** A Prisma P1001, shaped the way the real one arrives from a query. */
function prismaError(): Error {
  return new Error(
    [
      "Invalid `prisma.adminWorkerMemory.findUnique()` invocation:",
      "",
      "",
      "Can't reach database server at `db.internal`:`5432`",
      "",
      "Please make sure your database server is running at `db.internal`:`5432`.",
    ].join("\n"),
  );
}

function failingPrisma() {
  return {
    adminWorkerMemory: {
      findUnique: vi.fn(async () => {
        throw prismaError();
      }),
    },
  } as never;
}

describe("execution-host database errors", () => {
  it("readMasterSwitch reports the real cause, not Prisma's first line", async () => {
    const master = await readMasterSwitch(failingPrisma());
    expect(master.known).toBe(false);
    expect(master.error).toContain("Can't reach database server at `db.internal`");
    expect(master.error).not.toContain("Invalid `prisma.");
  });

  it("an unreadable switch is never reported as OFF", async () => {
    // The whole point: OFF is an operator decision, an unreadable row is not.
    const master = await readMasterSwitch(failingPrisma());
    expect(master.known).toBe(false);
  });

  it("readExecutionStatus carries the same cause into its label", async () => {
    const status = await readExecutionStatus(failingPrisma());
    expect(status.known).toBe(false);
    expect(status.error).toContain("Can't reach database server");
    expect(status.label).toContain("Can't reach database server");
    expect(status.label).not.toContain("Invalid `prisma.");
  });

  it("a failed lease read is an outage refusal, never 'held elsewhere'", async () => {
    const claim = await acquireExecutionLease(failingPrisma(), CLAIM);
    expect(claim).toMatchObject({ acquired: false, refusal: "db_unreachable" });
    expect(claim.refusedBecause).toContain("Can't reach database server");
  });

  it("a failed lease write is an outage refusal too, and never throws", async () => {
    // The read answers (stale row from an earlier runtime), the write fails.
    const stale = {
      memoryValue: {
        runtimeId: "old-runtime",
        renewedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        host: { label: "old mac" },
      },
      updatedAt: new Date(),
    };
    const updateFails = {
      adminWorkerMemory: {
        findUnique: vi.fn(async () => stale),
        updateMany: vi.fn(async () => {
          throw prismaError();
        }),
      },
    } as never;
    await expect(acquireExecutionLease(updateFails, CLAIM)).resolves.toMatchObject({
      acquired: false,
      refusal: "db_unreachable",
    });

    const createFails = {
      adminWorkerMemory: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => {
          throw prismaError();
        }),
      },
    } as never;
    await expect(acquireExecutionLease(createFails, CLAIM)).resolves.toMatchObject({
      acquired: false,
      refusal: "db_unreachable",
    });
  });

  it("a live lease on another runtime is the only 'held elsewhere'", async () => {
    const live = {
      adminWorkerMemory: {
        findUnique: vi.fn(async () => ({
          memoryValue: {
            runtimeId: "other-mac",
            renewedAt: new Date().toISOString(),
            host: { label: "other mac" },
          },
          updatedAt: new Date(),
        })),
      },
    } as never;
    await expect(acquireExecutionLease(live, CLAIM)).resolves.toMatchObject({
      acquired: false,
      refusal: "held_elsewhere",
    });
  });

  it("the summary is bounded so it cannot flood a log line or a dashboard cell", async () => {
    const prisma = {
      adminWorkerMemory: {
        findUnique: vi.fn(async () => {
          throw new Error("x".repeat(5000));
        }),
      },
    } as never;
    const master = await readMasterSwitch(prisma);
    expect(master.error?.length).toBeLessThanOrEqual(240);
  });
});
