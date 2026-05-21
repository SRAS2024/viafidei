/**
 * Worker startup self-test. Proves the worker proves it can do its
 * job — database reachable, queue + heartbeat tables usable — before
 * it enters the polling loop, and reports a structured result that
 * never leaks secret values.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runWorkerStartupCheck } from "@/lib/ingestion/queue/worker-startup-check";

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("worker startup check", () => {
  it("passes when the database is reachable and the tables are usable", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    prismaMock.workerHeartbeat.count.mockResolvedValue(0);
    prismaMock.ingestionJobQueue.count.mockResolvedValue(3);
    prismaMock.workerHeartbeat.upsert.mockResolvedValue({});
    prismaMock.workerHeartbeat.deleteMany.mockResolvedValue({ count: 1 });

    const result = await runWorkerStartupCheck({ processType: "worker" });

    expect(result.ok).toBe(true);
    expect(result.databaseUrlConfigured).toBe(true);
    expect(result.databaseReachable).toBe(true);
    expect(result.heartbeatTableReadable).toBe(true);
    expect(result.queueTableReadable).toBe(true);
    expect(result.heartbeatWritable).toBe(true);
    expect(result.pendingJobs).toBe(3);
    expect(result.errorMessage).toBeUndefined();
  });

  it("fails when the database is unreachable", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:5432"));

    const result = await runWorkerStartupCheck({ processType: "worker" });

    expect(result.ok).toBe(false);
    expect(result.databaseReachable).toBe(false);
    expect(result.errorMessage).toContain("ECONNREFUSED");
  });

  it("fails when the process type is not worker", async () => {
    const result = await runWorkerStartupCheck({ processType: "web" });

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("process type");
  });

  it("fails when DATABASE_URL is not configured", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const result = await runWorkerStartupCheck({ processType: "worker" });

    expect(result.ok).toBe(false);
    expect(result.databaseUrlConfigured).toBe(false);
    expect(result.errorMessage).toContain("DATABASE_URL");
  });
});
