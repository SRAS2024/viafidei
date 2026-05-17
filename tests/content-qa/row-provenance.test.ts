/**
 * Row provenance lookup — answers the 10/10 spec's audit questions:
 *   - Why does this row exist?
 *   - Which contract did it pass?
 *   - Why was it deleted (if it was)?
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getRowProvenance } from "@/lib/content-qa/row-provenance";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.prayer.findFirst.mockResolvedValue(null);
  prismaMock.saint.findFirst.mockResolvedValue(null);
  prismaMock.rejectedContentLog.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getRowProvenance", () => {
  it("returns the live catalog row when it exists", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue({
      status: "PUBLISHED",
      publicRenderReady: true,
      isThresholdEligible: true,
      packageValidationStatus: "valid",
      packageValidationErrors: [],
      contentPackageVersion: "1.1.0",
      lastPackageValidatedAt: new Date("2026-05-01"),
      sourceUrl: "https://www.vatican.va/hail-mary",
      sourceHost: "vatican.va",
      externalSourceKey: "vatican-hail-mary",
      contentChecksum: "abc123",
      archivedAt: null,
      createdAt: new Date("2026-04-01"),
      updatedAt: new Date("2026-05-01"),
    });
    const out = await getRowProvenance({ contentType: "Prayer", slug: "hail-mary" });
    expect(out.exists).toBe(true);
    expect(out.fields.publicRenderReady).toBe(true);
    expect(out.fields.contentPackageVersion).toBe("1.1.0");
    expect(out.fields.sourceHost).toBe("vatican.va");
    expect(out.rejected).toBeUndefined();
  });

  it("returns the rejection record when the row was deleted", async () => {
    prismaMock.rejectedContentLog.findFirst.mockResolvedValue({
      deletedAt: new Date("2026-05-10"),
      rejectionReason: "Prayer missing actual prayer text",
      failedContractName: "PrayerPackage",
      failedFields: ["prayerText"],
      decision: "delete",
      packageVersion: "1.1.0",
      validationDecision: "reject",
      failureCategory: "missing_required_field",
      cleanupMode: "all_catalog_rows",
      sweepReason: "scheduled",
      originalStatus: "PUBLISHED",
      workerJobId: "wj-1",
      ingestionBatchId: "ib-1",
    });
    const out = await getRowProvenance({ contentType: "Prayer", slug: "deleted-prayer" });
    expect(out.exists).toBe(false);
    expect(out.rejected).toBeDefined();
    expect(out.rejected?.failedContractName).toBe("PrayerPackage");
    expect(out.rejected?.failureCategory).toBe("missing_required_field");
    expect(out.rejected?.originalStatus).toBe("PUBLISHED");
  });

  it("returns both when a slug exists in catalog AND has a historical rejection", async () => {
    prismaMock.saint.findFirst.mockResolvedValue({
      status: "PUBLISHED",
      publicRenderReady: true,
      isThresholdEligible: true,
      packageValidationStatus: "valid",
      packageValidationErrors: [],
      contentPackageVersion: "1.1.0",
      lastPackageValidatedAt: new Date(),
      sourceUrl: "https://www.vatican.va/anthony",
      sourceHost: "vatican.va",
      externalSourceKey: "anthony",
      contentChecksum: "abc",
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.rejectedContentLog.findFirst.mockResolvedValue({
      deletedAt: new Date("2026-01-01"),
      rejectionReason: "previous attempt missed biography",
      failedContractName: "SaintPackage",
      failedFields: ["biography"],
      decision: "reject",
      packageVersion: "1.0.0",
      validationDecision: "reject",
      failureCategory: "missing_required_field",
      cleanupMode: "public_only",
      sweepReason: "scheduled",
      originalStatus: "PUBLISHED",
      workerJobId: null,
      ingestionBatchId: null,
    });
    const out = await getRowProvenance({
      contentType: "Saint",
      slug: "saint-anthony",
    });
    expect(out.exists).toBe(true);
    expect(out.fields.contentPackageVersion).toBe("1.1.0");
    expect(out.rejected).toBeDefined();
    expect(out.rejected?.packageVersion).toBe("1.0.0");
  });

  it("returns exists=false when nothing matches", async () => {
    const out = await getRowProvenance({ contentType: "Prayer", slug: "nonexistent" });
    expect(out.exists).toBe(false);
    expect(out.fields).toEqual({});
    expect(out.rejected).toBeUndefined();
  });

  it("never throws when a backing query fails", async () => {
    prismaMock.prayer.findFirst.mockRejectedValue(new Error("db down"));
    prismaMock.rejectedContentLog.findFirst.mockRejectedValue(new Error("db down"));
    await expect(getRowProvenance({ contentType: "Prayer", slug: "x" })).resolves.toBeDefined();
  });
});
