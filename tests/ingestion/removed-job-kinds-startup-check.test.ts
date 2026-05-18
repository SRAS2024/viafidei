/**
 * Startup safety check for removed job kinds.
 *
 * Within the migration window, removed-kind rows are translated by
 * the worker (see removed-job-kind-translation.test.ts). After the
 * migration window, the startup check raises a loud diagnostic so
 * the operator can drain or delete them.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { scanQueueForRemovedJobKinds } from "@/lib/startup/removed-job-kinds-check";

beforeEach(() => {
  resetPrismaMock();
});

describe("scanQueueForRemovedJobKinds", () => {
  it("returns ok=true when no removed-kind rows are present", async () => {
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([]);
    const result = await scanQueueForRemovedJobKinds();
    expect(result.ok).toBe(true);
    expect(result.rows).toBe(0);
  });

  it("returns ok=true when removed-kind rows are present but within the migration window", async () => {
    const now = Date.now();
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([
      { id: "q1", jobKind: "source_ingest", createdAt: new Date(now - 1000), status: "pending" },
    ]);
    const result = await scanQueueForRemovedJobKinds({
      migrationWindowMs: 60_000,
    });
    expect(result.ok).toBe(true);
    expect(result.rows).toBe(1);
    if (!result.ok || "windowExceeded" in result) {
      // discriminated union — refine
    }
  });

  it("returns ok=false when removed-kind rows persist past the migration window", async () => {
    const now = Date.now();
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([
      {
        id: "q1",
        jobKind: "source_ingest",
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
        status: "pending",
      },
    ]);
    const result = await scanQueueForRemovedJobKinds({
      migrationWindowMs: 7 * 24 * 60 * 60 * 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rows).toBe(1);
      expect(result.windowExceeded).toBe(true);
    }
  });
});
