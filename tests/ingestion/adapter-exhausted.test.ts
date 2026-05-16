/**
 * Verifies the adapter-driven exhausted signal: an adapter that
 * returns `exhausted: true` should cause the runner to mark the
 * underlying IngestionSource as exhausted (timestamp + healthState).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import type { SourceAdapter } from "@/lib/ingestion/types";
import { runAdapter } from "@/lib/ingestion/runner";

beforeEach(() => {
  resetPrismaMock();
});

describe("adapter-driven exhaustion", () => {
  it("marks the source exhausted when adapter signals exhausted=true", async () => {
    prismaMock.ingestionJobRun.create.mockResolvedValue({ id: "run-x" });
    prismaMock.ingestionJobRun.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobRun.update.mockResolvedValue({});
    prismaMock.ingestionJob.findUnique.mockResolvedValue({ sourceId: "src-x" });
    prismaMock.ingestionSource.update.mockResolvedValue({});

    const adapter: SourceAdapter = {
      key: "test-exhausted",
      description: "test",
      entityKinds: ["prayer"],
      fetch: vi.fn(async () => ({ items: [], exhausted: true })),
    };
    await runAdapter(adapter, "job-x", "test.example.com", { skipLock: true });
    expect(prismaMock.ingestionSource.update).toHaveBeenCalled();
    const call = prismaMock.ingestionSource.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "src-x" });
    expect(call.data.exhaustedAt).toBeInstanceOf(Date);
    expect(call.data.healthState).toBe("exhausted");
  });

  it("does NOT mark exhausted when adapter omits the signal", async () => {
    prismaMock.ingestionJobRun.create.mockResolvedValue({ id: "run-y" });
    prismaMock.ingestionJobRun.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobRun.update.mockResolvedValue({});
    prismaMock.ingestionSource.update.mockResolvedValue({});

    const adapter: SourceAdapter = {
      key: "test-running",
      description: "test",
      entityKinds: ["prayer"],
      fetch: vi.fn(async () => ({ items: [] })),
    };
    await runAdapter(adapter, "job-y", "test.example.com", { skipLock: true });
    // Should never have written an exhausted update (other updates
    // are possible — we check specifically that exhaustedAt is not
    // among any of them).
    for (const c of prismaMock.ingestionSource.update.mock.calls) {
      const args = c[0] as { data: Record<string, unknown> };
      expect(args.data.exhaustedAt).toBeUndefined();
    }
  });
});
