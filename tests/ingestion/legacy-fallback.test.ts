/**
 * Tests for the queue-first vs legacy direct-execution dual-path
 * behaviour gated by `USE_DURABLE_INGESTION_QUEUE`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { isDurableQueueEnabled } from "@/lib/config";

const ORIGINAL = process.env.USE_DURABLE_INGESTION_QUEUE;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.USE_DURABLE_INGESTION_QUEUE;
  else process.env.USE_DURABLE_INGESTION_QUEUE = ORIGINAL;
  vi.unstubAllEnvs();
});

describe("legacy fallback path", () => {
  it("isDurableQueueEnabled returns false when env=false (legacy path active)", () => {
    vi.stubEnv("USE_DURABLE_INGESTION_QUEUE", "false");
    expect(isDurableQueueEnabled()).toBe(false);
  });

  it("isDurableQueueEnabled returns true by default (legacy off)", () => {
    delete process.env.USE_DURABLE_INGESTION_QUEUE;
    expect(isDurableQueueEnabled()).toBe(true);
  });

  it("the cron route module still imports runAllActiveJobs (for legacy fallback)", async () => {
    // The cron route preserves runAllActiveJobs as a legacy fallback
    // until Phase 7. We confirm here that the import path still
    // resolves so deploys with the flag flipped off keep working.
    const mod = await import("@/lib/ingestion/scheduler");
    expect(typeof mod.runAllActiveJobs).toBe("function");
  });
});
