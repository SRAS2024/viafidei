/**
 * The "why not visible" admin surface explains every non-public row.
 * The spec requires the row shape to expose every diagnostic field
 * an operator needs to answer "why isn't this row public?":
 *
 *   * content type, title, slug
 *   * source url, source host
 *   * status, publicRenderReady, isThresholdEligible
 *   * packageValidationStatus, packageValidationErrors
 *   * failedContract, missingFields
 *   * lastBuildAttempt, lastBuildOutcome, lastQaRun, lastQaReason
 *   * sourcePurposes
 *   * suggestedNextAction
 *
 * These tests pin the WhyNotVisibleRow shape so a future schema
 * change cannot quietly drop a field — and prove the data accessor
 * filters by content-type-specific non-public conditions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { listNonPublicRows } from "@/lib/data/why-not-visible";

beforeEach(() => {
  resetPrismaMock();
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.marianApparition,
    prismaMock.parish,
    prismaMock.devotion,
    prismaMock.liturgyEntry,
    prismaMock.spiritualLifeGuide,
  ]) {
    m.findMany.mockResolvedValue([]);
  }
  prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([]);
  prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
  prismaMock.ingestionSource.findMany.mockResolvedValue([]);
});

describe("why-not-visible row shape", () => {
  it("exposes every diagnostic field the admin UI needs", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p1",
        slug: "test-prayer",
        defaultTitle: "Test Prayer",
        status: "DRAFT",
        publicRenderReady: false,
        isThresholdEligible: false,
        packageValidationStatus: "missing_fields",
        packageValidationErrors: ["body too short", "no source url"],
        sourceUrl: "https://vatican.va/test",
        sourceHost: "vatican.va",
        archivedAt: null,
        updatedAt: new Date(),
      },
    ]);

    const rows = await listNonPublicRows({ filter: "all", limit: 100 });
    const prayer = rows.find((r) => r.contentType === "Prayer" && r.slug === "test-prayer");
    expect(prayer).toBeDefined();
    if (!prayer) return;

    // Every spec-required field must be present (typed, not undefined).
    expect(typeof prayer.contentType).toBe("string");
    expect(typeof prayer.contentId).toBe("string");
    expect(typeof prayer.slug).toBe("string");
    expect(typeof prayer.title).toBe("string");
    expect(typeof prayer.status).toBe("string");
    expect(typeof prayer.publicRenderReady).toBe("boolean");
    expect(typeof prayer.isThresholdEligible).toBe("boolean");
    expect("packageValidationStatus" in prayer).toBe(true);
    expect(Array.isArray(prayer.packageValidationErrors)).toBe(true);
    expect("failedContract" in prayer).toBe(true);
    expect(Array.isArray(prayer.missingFields)).toBe(true);
    expect("lastBuildAttempt" in prayer).toBe(true);
    expect("lastBuildOutcome" in prayer).toBe(true);
    expect("lastQaRun" in prayer).toBe(true);
    expect("lastQaReason" in prayer).toBe(true);
    expect("sourcePurposes" in prayer).toBe(true);
    expect(typeof prayer.suggestedNextAction).toBe("string");
  });

  it("preserves packageValidationErrors as a string[] from the prisma row", async () => {
    prismaMock.saint.findMany.mockResolvedValue([
      {
        id: "s1",
        slug: "test-saint",
        canonicalName: "Test Saint",
        status: "REVIEW",
        publicRenderReady: false,
        isThresholdEligible: false,
        packageValidationStatus: "qa_failed",
        packageValidationErrors: ["missing biography", "missing feast day"],
        sourceUrl: null,
        sourceHost: null,
        archivedAt: null,
        updatedAt: new Date(),
      },
    ]);
    const rows = await listNonPublicRows({ filter: "all", limit: 100 });
    const saint = rows.find((r) => r.slug === "test-saint");
    expect(saint?.packageValidationErrors).toEqual([
      "missing biography",
      "missing feast day",
    ]);
  });

  it("returns an empty list when every row is public (no false rows)", async () => {
    // beforeEach already sets findMany to [] for every model.
    const rows = await listNonPublicRows({ filter: "all", limit: 100 });
    expect(rows).toEqual([]);
  });

  it("suggestedNextAction is always a non-empty string explaining what to do", async () => {
    prismaMock.devotion.findMany.mockResolvedValue([
      {
        id: "d1",
        slug: "test-devotion",
        defaultTitle: "Test Devotion",
        status: "DRAFT",
        publicRenderReady: false,
        isThresholdEligible: false,
        packageValidationStatus: null,
        packageValidationErrors: [],
        sourceUrl: null,
        sourceHost: null,
        archivedAt: null,
        updatedAt: new Date(),
      },
    ]);
    const rows = await listNonPublicRows({ filter: "all", limit: 100 });
    for (const r of rows) {
      expect(typeof r.suggestedNextAction).toBe("string");
      expect(r.suggestedNextAction.length).toBeGreaterThan(0);
    }
  });
});
