/**
 * Admin data-source card. Verifies each surface is probed and a
 * failed probe is surfaced rather than masked as zero.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getAdminDataSourceCard } from "@/lib/diagnostics";

beforeEach(() => {
  resetPrismaMock();
  for (const m of [
    prismaMock.ingestionJobQueue,
    prismaMock.ingestionBatch,
    prismaMock.ingestionCursor,
    prismaMock.workerHeartbeat,
    prismaMock.queueAuditLog,
    prismaMock.discoveredSourceItem,
    prismaMock.dailyIngestionCounter,
    prismaMock.rejectedContentLog,
    prismaMock.dataManagementLog,
    prismaMock.ingestionJobRun,
  ]) {
    m.count.mockResolvedValue(0);
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getAdminDataSourceCard", () => {
  it("returns allReachable=true when every probe succeeds", async () => {
    const card = await getAdminDataSourceCard();
    expect(card.allReachable).toBe(true);
    for (const s of card.surfaces) {
      expect(s.present).toBe(true);
    }
  });

  it("returns allReachable=false when one surface is unreachable", async () => {
    prismaMock.ingestionJobQueue.count.mockRejectedValue(new Error("table missing"));
    const card = await getAdminDataSourceCard();
    expect(card.allReachable).toBe(false);
    const queue = card.surfaces.find((s) => s.key === "durable_queue");
    expect(queue?.present).toBe(false);
    expect(queue?.errorMessage).toMatch(/table missing/);
  });

  it("returns rowCount > 0 when a surface has rows", async () => {
    prismaMock.workerHeartbeat.count.mockResolvedValue(3);
    const card = await getAdminDataSourceCard();
    const worker = card.surfaces.find((s) => s.key === "worker_heartbeat");
    expect(worker?.rowCount).toBe(3);
  });

  it("includes every required surface", async () => {
    const card = await getAdminDataSourceCard();
    const keys = card.surfaces.map((s) => s.key);
    expect(keys).toContain("durable_queue");
    expect(keys).toContain("ingestion_batch");
    expect(keys).toContain("ingestion_cursor");
    expect(keys).toContain("worker_heartbeat");
    expect(keys).toContain("queue_audit");
    expect(keys).toContain("discovered_source_items");
    expect(keys).toContain("daily_counter");
    expect(keys).toContain("strict_qa_rejected");
    expect(keys).toContain("data_management_log");
    expect(keys).toContain("legacy_run_log");
  });
});
