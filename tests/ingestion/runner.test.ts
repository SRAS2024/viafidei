import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
// Skip the advisory-lock dependency: tests pass `skipLock: true`, but the
// import path is still evaluated at module-load time.
vi.mock("@/lib/concurrency/lock", () => ({
  withAdvisoryLock: async <T>(_key: string, fn: () => Promise<T>) => fn(),
}));

import { runAdapter } from "@/lib/ingestion/runner";
import type { IngestedItem, SourceAdapter } from "@/lib/ingestion/types";

const item: IngestedItem = {
  kind: "prayer",
  slug: "anima-christi",
  defaultTitle: "Anima Christi",
  category: "ordinary",
  body: "Soul of Christ, sanctify me. Body of Christ, save me.",
  externalSourceKey: "https://www.vatican.va/prayers/anima-christi",
};

function makeAdapter(items: IngestedItem[]): SourceAdapter {
  return {
    key: "test.adapter",
    description: "test",
    entityKinds: ["prayer"],
    fetch: vi.fn(async () => ({ items })),
  };
}

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runAdapter — DB writes through to IngestionJobRun", () => {
  it("creates an IngestionJobRun and updates it on success", async () => {
    prismaMock.ingestionJobRun.create.mockResolvedValue({ id: "run-1" });
    prismaMock.ingestionJobRun.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobRun.update.mockResolvedValue({});
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    prismaMock.prayer.create.mockResolvedValue({});

    const adapter = makeAdapter([item]);
    const summary = await runAdapter(adapter, "job-1", "vatican.va", {
      skipLock: true,
      initialStatus: "REVIEW",
    });

    expect(summary.recordsSeen).toBe(1);
    expect(summary.recordsCreated).toBe(1);
    expect(summary.recordsReviewRequired).toBe(1);
    expect(prismaMock.ingestionJobRun.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.ingestionJobRun.update).toHaveBeenCalledTimes(1);
    const updateArgs = prismaMock.ingestionJobRun.update.mock.calls[0][0];
    expect(updateArgs.data.status).toBe("SUCCESS");
    expect(updateArgs.data.recordsCreated).toBe(1);
  });

  it("counts both created and updated as review-required when initialStatus=REVIEW", async () => {
    prismaMock.ingestionJobRun.create.mockResolvedValue({ id: "run-2" });
    prismaMock.ingestionJobRun.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobRun.update.mockResolvedValue({});
    // Existing row, different checksum → updates back to REVIEW.
    prismaMock.prayer.findFirst.mockResolvedValue({
      id: "x",
      status: "DRAFT",
      contentChecksum: "different",
    });
    prismaMock.prayer.update.mockResolvedValue({});

    const adapter = makeAdapter([item]);
    const summary = await runAdapter(adapter, "job-2", "vatican.va", {
      skipLock: true,
      initialStatus: "REVIEW",
    });

    expect(summary.recordsUpdated).toBe(1);
    expect(summary.recordsReviewRequired).toBe(1);
  });

  it("marks the IngestionJobRun FAILED when the adapter throws", async () => {
    prismaMock.ingestionJobRun.create.mockResolvedValue({ id: "run-3" });
    prismaMock.ingestionJobRun.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobRun.update.mockResolvedValue({});
    const adapter: SourceAdapter = {
      key: "test.fail",
      description: "fails",
      entityKinds: ["prayer"],
      fetch: vi.fn(async () => {
        throw new Error("upstream 503");
      }),
    };

    const summary = await runAdapter(adapter, "job-3", "vatican.va", {
      skipLock: true,
    });

    expect(summary.recordsFailed).toBe(1);
    expect(summary.errorMessage).toContain("upstream 503");
    const args = prismaMock.ingestionJobRun.update.mock.calls[0][0];
    expect(args.data.status).toBe("FAILED");
  });

  it("a second pass of identical content produces zero writes (skipped)", async () => {
    // First run: create.
    prismaMock.ingestionJobRun.create.mockResolvedValue({ id: "r" });
    prismaMock.ingestionJobRun.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobRun.update.mockResolvedValue({});
    prismaMock.prayer.findFirst.mockResolvedValueOnce(null);
    prismaMock.prayer.findUnique.mockResolvedValueOnce(null);
    prismaMock.prayer.create.mockResolvedValue({});

    const adapter = makeAdapter([item]);
    const first = await runAdapter(adapter, "job-r", "vatican.va", { skipLock: true });
    expect(first.recordsCreated).toBe(1);

    // Capture the checksum the runner just stored.
    const createArgs = prismaMock.prayer.create.mock.calls[0][0];
    const storedChecksum = createArgs.data.contentChecksum;

    // Second pass: existing row reports the same checksum → skipped.
    prismaMock.prayer.findFirst.mockResolvedValue({
      id: "x",
      status: "DRAFT",
      contentChecksum: storedChecksum,
    });
    prismaMock.prayer.create.mockClear();
    prismaMock.prayer.update.mockClear();

    const second = await runAdapter(adapter, "job-r", "vatican.va", { skipLock: true });
    expect(second.recordsCreated).toBe(0);
    expect(second.recordsUpdated).toBe(0);
    expect(second.recordsSkipped).toBe(1);
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
    expect(prismaMock.prayer.update).not.toHaveBeenCalled();
  });
});
