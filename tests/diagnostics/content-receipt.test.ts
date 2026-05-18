/**
 * Content receipt panel — proves the helper returns the 8 spec-listed
 * answers ("why it exists", "which builder", "which contract", etc.)
 * by joining new factory tables.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getContentReceipt } from "@/lib/diagnostics/content-receipt";

beforeEach(() => {
  resetPrismaMock();
});

describe("getContentReceipt", () => {
  it("returns publicRow + build log + source document + derived fields", async () => {
    const now = new Date();
    prismaMock.prayer.findUnique.mockResolvedValue({
      id: "p1",
      slug: "our-father",
      defaultTitle: "Our Father",
      status: "PUBLISHED",
      publicRenderReady: true,
      isThresholdEligible: true,
      sourceUrl: "https://example.com/our-father",
      sourceHost: "example.com",
      contentChecksum: "ck",
      packageValidationStatus: "valid",
      contentPackageVersion: "1.1.0",
      createdAt: now,
      updatedAt: now,
    });
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([
      {
        id: "b1",
        builderName: "PrayerBuilder",
        builderVersion: "1.0.0",
        buildStatus: "built_complete_package",
        failureReason: null,
        missingFieldsJson: [],
        createdAt: now,
        provenanceJson: { prayerText: { extractionMethod: "regex" } },
      },
    ]);
    prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
    prismaMock.sourceDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      sourceUrl: "https://example.com/our-father",
      sourceHost: "example.com",
      fetchedAt: now,
    });

    const receipt = await getContentReceipt({ contentType: "Prayer", slug: "our-father" });

    expect(receipt.publicRow?.title).toBe("Our Father");
    expect(receipt.publicRow?.contentPackageVersion).toBe("1.1.0");
    expect(receipt.sourceDocument?.id).toBe("doc-1");
    expect(receipt.buildLog).toHaveLength(1);
    expect(receipt.derived.builderName).toBe("PrayerBuilder");
    expect(receipt.derived.builderVersion).toBe("1.0.0");
    expect(receipt.derived.countsTowardThreshold).toBe(true);
    expect(receipt.derived.everFailedQA).toBe(false);
    expect(receipt.publicRow?.provenanceJson).toEqual({
      prayerText: { extractionMethod: "regex" },
    });
  });

  it("returns publicRow=null with errors captured when the row is missing", async () => {
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([]);
    prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);

    const receipt = await getContentReceipt({ contentType: "Prayer", slug: "missing" });

    expect(receipt.publicRow).toBeNull();
    expect(receipt.sourceDocument).toBeNull();
    expect(receipt.derived.builderName).toBeNull();
  });
});
