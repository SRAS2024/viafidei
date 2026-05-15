import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/concurrency/lock", () => ({
  withAdvisoryLock: async <T>(_key: string, fn: () => Promise<T>) => fn(),
}));

import { runAdapter } from "@/lib/ingestion/runner";
import { persistItems } from "@/lib/ingestion/persist";
import type { IngestedItem, SourceAdapter } from "@/lib/ingestion/types";

const validPrayer: IngestedItem = {
  kind: "prayer",
  slug: "anima-christi",
  defaultTitle: "Anima Christi",
  category: "Eucharistic",
  body: "Soul of Christ, sanctify me. Body of Christ, save me. Amen.",
  externalSourceKey: "https://www.vatican.va/prayers/anima-christi",
};

// A "saint" item with an empty slug — the validator returns "Saint slug
// is required", which is classified as a HARD rejection. We use slug=""
// because an empty slug stays empty after normalizeSlug() and trips the
// `!nonEmpty(item.slug)` check before any soft heuristic runs.
const rejectedSaint: IngestedItem = {
  kind: "saint",
  slug: "",
  canonicalName: "St. Stub",
  patronages: [],
  biography:
    "Born in Assisi in 1181, founder of the Franciscan order, canonized by Pope Gregory IX, feast day October 4.",
  externalSourceKey: "https://www.vatican.va/saints/stub",
};

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("persistItems writes DataManagementLog rows", () => {
  it("writes ADD rows for created items", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    prismaMock.prayer.create.mockResolvedValue({});

    const result = await persistItems([validPrayer], "PUBLISHED");
    expect(result.created).toBe(1);
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]).toMatchObject({
      action: "ADD",
      contentType: "Prayer",
      contentRef: "anima-christi",
    });
    expect(prismaMock.dataManagementLog.createMany).toHaveBeenCalledTimes(1);
  });

  it("writes DEDUPE rows for skipped items with the reason", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue({
      id: "existing",
      slug: "anima-christi",
      defaultTitle: "Anima Christi",
      status: "PUBLISHED",
      contentChecksum: "ABC",
    });

    const result = await persistItems([validPrayer], "PUBLISHED");
    expect(result.skipped).toBe(1);
    expect(result.logs[0].action).toBe("DEDUPE");
    expect(result.logs[0].reason).toMatch(/already in catalog|duplicate/);
  });

  it("respects skipDataManagementLog=true (runner handles writes itself)", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    prismaMock.prayer.create.mockResolvedValue({});

    const result = await persistItems([validPrayer], "PUBLISHED", {
      skipDataManagementLog: true,
    });
    expect(result.logs).toHaveLength(1);
    expect(prismaMock.dataManagementLog.createMany).not.toHaveBeenCalled();
  });
});

describe("runAdapter writes per-run DataManagementLog rows", () => {
  function makeAdapter(items: IngestedItem[]): SourceAdapter {
    return {
      key: "test.adapter",
      description: "test",
      entityKinds: ["prayer", "saint"],
      fetch: vi.fn(async () => ({ items })),
    };
  }

  it("logs ADD for accepted items, DEDUPE for skipped, REJECT for hard-rejected", async () => {
    prismaMock.ingestionJobRun.create.mockResolvedValue({ id: "run-x" });
    prismaMock.ingestionJobRun.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobRun.update.mockResolvedValue({});
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    prismaMock.prayer.create.mockResolvedValue({});

    const adapter = makeAdapter([validPrayer, rejectedSaint]);
    const summary = await runAdapter(adapter, "job-x", "vatican.va", {
      skipLock: true,
      initialStatus: "PUBLISHED",
    });

    expect(summary.recordsCreated).toBe(1);
    expect(summary.recordsSkipped).toBeGreaterThanOrEqual(1); // rejected counts as skipped
    // The runner must call createMany exactly once with both an ADD and a REJECT row.
    expect(prismaMock.dataManagementLog.createMany).toHaveBeenCalledTimes(1);
    const payload = prismaMock.dataManagementLog.createMany.mock.calls[0][0].data as Array<{
      action: string;
      contentType: string;
    }>;
    const actions = payload.map((p) => p.action);
    expect(actions).toEqual(expect.arrayContaining(["ADD", "REJECT"]));
  });
});
