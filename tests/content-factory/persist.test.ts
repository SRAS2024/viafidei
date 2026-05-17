/**
 * End-to-end factory persistence tests.
 *
 * Wraps the prismaMock and exercises:
 *   - persistBuiltPackage() refuses validation-failed packages
 *   - persistBuiltPackage() refuses packages missing provenance
 *   - persistBuiltPackage() creates a new Prayer row when none exists
 *   - persistBuiltPackage() skips when checksum matches
 *
 * These tests prove the canonical persistence path and the
 * "no automatic save uncertain content" invariant from the user
 * spec.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { persistBuiltPackage } from "@/lib/content-factory";
import type { ContentPackage } from "@/lib/content-factory";

beforeEach(() => {
  resetPrismaMock();
});

function makePackage(): ContentPackage {
  return {
    contentType: "Prayer",
    slug: "ave-maria-test",
    title: "Ave Maria",
    language: "en",
    sourceUrl: "https://vatican.va/ave-maria",
    sourceHost: "vatican.va",
    sourceTier: 1,
    contentChecksum: "checksum-1",
    payload: {
      prayerName: "Ave Maria",
      prayerText: "Hail Mary, full of grace…",
      prayerType: "Marian prayer",
      category: "Marian prayer",
    },
    provenance: {
      prayerName: makeProv(),
      prayerText: makeProv(),
      prayerType: makeProv(),
      category: makeProv(),
      slug: makeProv(),
    },
  };
}

function makeProv() {
  return {
    sourceUrl: "https://vatican.va/ave-maria",
    sourceHost: "vatican.va",
    sourceDocumentId: null,
    sourceHeading: null,
    sourceSection: null,
    snippetHash: "snip-1",
    extractionMethod: "test",
    extractorVersion: "1.0.0",
    confidence: 0.9,
    timestamp: new Date().toISOString(),
  };
}

describe("persistBuiltPackage", () => {
  it("refuses when validation did not flag publicRenderReady", async () => {
    const pkg = makePackage();
    const result = await persistBuiltPackage({
      pkg,
      validation: {
        decision: "publish",
        contractName: "PrayerPackage",
        contentType: "Prayer",
        failedFields: [],
        reason: "ok",
        publicRenderReady: false,
        isThresholdEligible: true,
        contractVersion: "1.0.0",
      },
    });
    expect(result.outcome).toBe("rejected");
  });

  it("refuses when validation decision is reject", async () => {
    const pkg = makePackage();
    const result = await persistBuiltPackage({
      pkg,
      validation: {
        decision: "reject",
        contractName: "PrayerPackage",
        contentType: "Prayer",
        failedFields: ["prayerText"],
        reason: "missing prayer text",
        publicRenderReady: false,
        isThresholdEligible: false,
        contractVersion: "1.0.0",
      },
    });
    expect(result.outcome).toBe("rejected");
  });

  it("creates a new Prayer row when none exists", async () => {
    prismaMock.prayer.findFirst.mockResolvedValueOnce(null);
    prismaMock.prayer.create.mockResolvedValueOnce({ id: "p1", slug: "ave-maria-test" });
    const pkg = makePackage();
    const result = await persistBuiltPackage({
      pkg,
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
    expect(result.outcome).toBe("created");
    expect(prismaMock.prayer.create).toHaveBeenCalledTimes(1);
    const call = prismaMock.prayer.create.mock.calls[0][0];
    expect(call.data.status).toBe("PUBLISHED");
    expect(call.data.publicRenderReady).toBe(true);
    expect(call.data.isThresholdEligible).toBe(true);
    expect(call.data.packageValidationStatus).toBe("valid");
  });

  it("skips when checksum matches existing row", async () => {
    prismaMock.prayer.findFirst.mockResolvedValueOnce({
      id: "p1",
      slug: "ave-maria-test",
      contentChecksum: "checksum-1",
    });
    const pkg = makePackage();
    const result = await persistBuiltPackage({
      pkg,
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
    expect(result.outcome).toBe("skipped");
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
  });

  it("refuses when required-field provenance is missing", async () => {
    const pkg = makePackage();
    // Drop prayerText provenance.
    delete (pkg.provenance as Record<string, unknown>).prayerText;
    const result = await persistBuiltPackage({
      pkg,
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
    expect(result.outcome).toBe("rejected");
    if (result.outcome === "rejected") {
      expect(result.missing.some((m) => m.includes("prayerText"))).toBe(true);
    }
  });
});
