/**
 * Spec: "persistBuiltPackage() should accept only complete packages
 * that passed strict QA. It should never persist failed packages.
 * It should never persist incomplete packages."
 *
 * These tests pin those invariants by handing persistBuiltPackage
 * packages with the wrong validation decision / missing public-gate
 * flags / missing provenance and asserting the function refuses to
 * persist.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { persistBuiltPackage } from "@/lib/content-factory";

beforeEach(() => {
  resetPrismaMock();
});

function buildPrayerPackage(over: Record<string, unknown> = {}) {
  return {
    contentType: "Prayer" as const,
    slug: "test-prayer",
    title: "Test Prayer",
    sourceUrl: "https://vatican.va/prayers/test",
    sourceHost: "vatican.va",
    payload: {
      prayerType: "Traditional",
      prayerName: "Test Prayer",
      prayerText: "Hail Mary, full of grace.",
      category: "Marian",
      language: "en",
      formattingStructure: "plain",
    },
    provenance: {
      prayerName: { method: "title", sourceUrl: "https://vatican.va/prayers/test" },
      prayerText: { method: "body", sourceUrl: "https://vatican.va/prayers/test" },
    },
    ...over,
  };
}

describe("persistBuiltPackage refuses to persist failed / incomplete packages", () => {
  it("refuses to persist when validation.decision is 'reject'", async () => {
    const result = await persistBuiltPackage({
      pkg: buildPrayerPackage() as never,
      validation: {
        decision: "reject",
        publicRenderReady: false,
        isThresholdEligible: false,
        failedFields: ["body"],
        contractName: "PrayerPackage",
        contractVersion: "1.0.0",
        reason: "body too short",
        contentType: "Prayer",
      } as never,
    });
    expect(result.outcome).toBe("rejected");
    // No Prisma create should have happened.
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
    expect(prismaMock.prayer.update).not.toHaveBeenCalled();
  });

  it("refuses to persist when validation.decision is 'delete'", async () => {
    const result = await persistBuiltPackage({
      pkg: buildPrayerPackage() as never,
      validation: {
        decision: "delete",
        publicRenderReady: false,
        isThresholdEligible: false,
        failedFields: ["body"],
        contractName: "PrayerPackage",
        contractVersion: "1.0.0",
        reason: "wrong content",
        contentType: "Prayer",
      } as never,
    });
    expect(result.outcome).toBe("rejected");
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
  });

  it("refuses to persist when validation.decision is 'archive'", async () => {
    const result = await persistBuiltPackage({
      pkg: buildPrayerPackage() as never,
      validation: {
        decision: "archive",
        publicRenderReady: false,
        isThresholdEligible: false,
        failedFields: [],
        contractName: "PrayerPackage",
        contractVersion: "1.0.0",
        reason: "archive",
        contentType: "Prayer",
      } as never,
    });
    expect(result.outcome).toBe("rejected");
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
  });

  it("refuses to persist when validation.decision is 'publish' but publicRenderReady is false (defensive)", async () => {
    const result = await persistBuiltPackage({
      pkg: buildPrayerPackage() as never,
      validation: {
        decision: "publish",
        publicRenderReady: false, // defensive: contract said publish, but flag is wrong
        isThresholdEligible: true,
        failedFields: [],
        contractName: "PrayerPackage",
        contractVersion: "1.0.0",
        reason: "ok",
        contentType: "Prayer",
      } as never,
    });
    expect(result.outcome).toBe("rejected");
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
  });

  it("refuses to persist when validation.decision is 'publish' but isThresholdEligible is false", async () => {
    const result = await persistBuiltPackage({
      pkg: buildPrayerPackage() as never,
      validation: {
        decision: "publish",
        publicRenderReady: true,
        isThresholdEligible: false,
        failedFields: [],
        contractName: "PrayerPackage",
        contractVersion: "1.0.0",
        reason: "ok",
        contentType: "Prayer",
      } as never,
    });
    expect(result.outcome).toBe("rejected");
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
  });

  it("refuses to persist when required fields have no provenance", async () => {
    // Strip all provenance.
    const pkg = buildPrayerPackage({ provenance: {} });
    const result = await persistBuiltPackage({
      pkg: pkg as never,
      validation: {
        decision: "publish",
        publicRenderReady: true,
        isThresholdEligible: true,
        failedFields: [],
        contractName: "PrayerPackage",
        contractVersion: "1.0.0",
        reason: "ok",
        contentType: "Prayer",
      } as never,
    });
    expect(result.outcome).toBe("rejected");
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
  });
});
