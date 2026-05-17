/**
 * ContentVersion snapshot tests.
 *
 * Spec line: "It should create content version history for meaningful
 * updates." Every update path inside persistBuiltPackage() snapshots
 * the previous row into ContentVersion via snapshotPreviousVersion()
 * before overwriting the row, so an admin can see exactly what
 * changed.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { persistBuiltPackage } from "@/lib/content-factory";

beforeEach(() => {
  resetPrismaMock();
});

function provEntry() {
  return {
    sourceUrl: "https://vatican.va/p",
    sourceHost: "vatican.va",
    sourceDocumentId: null,
    sourceHeading: null,
    sourceSection: null,
    snippetHash: "h",
    extractionMethod: "test",
    extractorVersion: "1.0.0",
    confidence: 0.9,
    timestamp: new Date().toISOString(),
  };
}

describe("persistBuiltPackage snapshots ContentVersion on meaningful updates", () => {
  it("writes a ContentVersion row when checksum differs on update", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue({
      id: "p1",
      slug: "ave-maria",
      contentChecksum: "old-checksum",
      defaultTitle: "Ave Maria (old)",
      body: "Old body",
      status: "PUBLISHED",
      updatedAt: new Date("2024-01-01"),
    });
    prismaMock.prayer.update.mockResolvedValue({ id: "p1", slug: "ave-maria" });

    const result = await persistBuiltPackage({
      pkg: {
        contentType: "Prayer",
        slug: "ave-maria",
        title: "Ave Maria",
        sourceUrl: "https://vatican.va/p",
        sourceHost: "vatican.va",
        contentChecksum: "new-checksum",
        payload: {
          prayerName: "Ave Maria",
          prayerText: "Hail Mary…",
          prayerType: "Marian prayer",
          category: "Marian prayer",
        },
        provenance: {
          prayerName: provEntry(),
          prayerText: provEntry(),
          prayerType: provEntry(),
          category: provEntry(),
          slug: provEntry(),
        },
      },
      validation: {
        decision: "publish",
        contractName: "PrayerPackage",
        contentType: "Prayer",
        failedFields: [],
        reason: "ok",
        publicRenderReady: true,
        isThresholdEligible: true,
        contractVersion: "1.0.0",
      },
    });
    expect(result.outcome).toBe("updated");
    expect(prismaMock.contentVersion.create).toHaveBeenCalled();
    const versionCall = prismaMock.contentVersion.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(versionCall.data.entityType).toBe("Prayer");
    expect(versionCall.data.entityId).toBe("p1");
    expect(versionCall.data.previousChecksum).toBe("old-checksum");
  });
});
