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

import { readExecutionStatus, readMasterSwitch } from "@/lib/admin-worker/execution-host";

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
