/**
 * Factory-source setup — proves the backfill task:
 *   1. Marks sources with discoveryFeedUrl as factory_native /
 *      discoveryMethod=sitemap.
 *   2. Marks sources without a feed URL as not_configured with a
 *      precise reason.
 *   3. Skips sources whose discoveryMethod is already set
 *      (idempotency).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runFactorySourceSetup } from "@/lib/startup/factory-source-setup";

beforeEach(() => {
  resetPrismaMock();
});

const baseSource = {
  id: "src-1",
  discoveryFeedUrl: null as string | null,
  canIngestPrayers: false,
  canIngestSaints: false,
  canIngestApparitions: false,
  canIngestParishes: false,
  canIngestDevotions: false,
  canIngestNovenas: false,
  canIngestSacraments: false,
  canIngestRosaryGuides: false,
  canIngestConsecrations: false,
  canIngestSpiritualGuides: false,
  canIngestLiturgy: false,
  canIngestHistory: false,
};

describe("runFactorySourceSetup", () => {
  it("marks sources with discoveryFeedUrl as factory_native", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      { ...baseSource, id: "src-fn", discoveryFeedUrl: "https://x/sitemap.xml" },
    ]);
    let updated: { data: Record<string, unknown> } | null = null;
    prismaMock.ingestionSource.update.mockImplementation(async (args: unknown) => {
      updated = args as { data: Record<string, unknown> };
      return {};
    });

    const report = await runFactorySourceSetup();

    expect(report.marked_factory_native).toBe(1);
    expect(report.marked_not_configured).toBe(0);
    expect(updated!.data.discoveryMethod).toBe("sitemap");
    expect(updated!.data.configurationStatus).toBe("factory_native");
  });

  it("marks sources without a feed URL as not_configured with a reason", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      { ...baseSource, id: "src-nc", discoveryFeedUrl: null, canIngestPrayers: true },
    ]);
    let updated: { data: Record<string, unknown> } | null = null;
    prismaMock.ingestionSource.update.mockImplementation(async (args: unknown) => {
      updated = args as { data: Record<string, unknown> };
      return {};
    });

    const report = await runFactorySourceSetup();

    expect(report.marked_not_configured).toBe(1);
    expect(updated!.data.discoveryMethod).toBe("not_configured");
    expect(updated!.data.configurationStatusReason).toMatch(/sitemap/i);
  });

  it("marks sources with no purpose flags as not_configured with a different reason", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([{ ...baseSource, id: "src-empty" }]);
    let updated: { data: Record<string, unknown> } | null = null;
    prismaMock.ingestionSource.update.mockImplementation(async (args: unknown) => {
      updated = args as { data: Record<string, unknown> };
      return {};
    });

    const report = await runFactorySourceSetup();

    expect(report.marked_not_configured).toBe(1);
    expect(updated!.data.configurationStatusReason).toMatch(/purpose/i);
  });

  it("is idempotent — runs only against rows with discoveryMethod=null", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);

    const report = await runFactorySourceSetup();

    expect(report.inspected).toBe(0);
  });
});
