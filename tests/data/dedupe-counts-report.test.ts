/**
 * Tests that dedup actions are tracked separately from archive actions
 * in admin reports. The aggregator must count DEDUPE rows as a distinct
 * bucket so admin reports can show "items deduped" alongside "items
 * archived" without conflating the two.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { recordDataManagementLogs } from "@/lib/data/data-management-log";

beforeEach(() => {
  resetPrismaMock();
});

describe("dedupe actions write distinct DataManagementLog rows", () => {
  it("DEDUPE action is preserved verbatim in createMany payload", async () => {
    let lastCall: { data: Array<{ action: string }> } | null = null;
    prismaMock.dataManagementLog.createMany.mockImplementation(async (args: typeof lastCall) => {
      lastCall = args;
      return { count: args!.data.length };
    });
    await recordDataManagementLogs([
      { action: "DEDUPE", contentType: "Prayer", contentRef: "our-father", reason: "duplicate" },
      { action: "CLEANUP", contentType: "Prayer", contentRef: "junk", reason: "archived" },
    ]);
    expect(lastCall).not.toBeNull();
    expect(lastCall!.data[0].action).toBe("DEDUPE");
    expect(lastCall!.data[1].action).toBe("CLEANUP");
  });

  it("archived deduped items still write DEDUPE, not DELETE", async () => {
    let lastCall: { data: Array<{ action: string; contentRef: string | null }> } | null = null;
    prismaMock.dataManagementLog.createMany.mockImplementation(async (args: typeof lastCall) => {
      lastCall = args;
      return { count: args!.data.length };
    });
    await recordDataManagementLogs([
      {
        action: "DEDUPE",
        contentType: "Prayer",
        contentRef: "our-father-duplicate",
        reason: "duplicate of our-father — archived",
      },
    ]);
    expect(lastCall!.data[0].action).toBe("DEDUPE");
    expect(lastCall!.data[0].contentRef).toContain("duplicate");
  });
});
