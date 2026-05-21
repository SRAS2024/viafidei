/**
 * Raw row audit.
 *
 * Pins section 16: every catalog row is classified into exactly one
 * bucket — already valid public, blocked by public gate, missing
 * source evidence, convertible through factory, or invalid and
 * deletable.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  classifyRawRow,
  auditRawRows,
  type CatalogRowFields,
} from "@/lib/content-qa/raw-row-audit";

const AUDIT_MODELS = [
  "prayer",
  "saint",
  "marianApparition",
  "parish",
  "devotion",
  "spiritualLifeGuide",
  "liturgyEntry",
] as const;

function row(overrides: Partial<CatalogRowFields> = {}): CatalogRowFields {
  return {
    status: "DRAFT",
    publicRenderReady: false,
    isThresholdEligible: false,
    archivedAt: null,
    sourceUrl: "https://example.org/p",
    sourceHost: "example.org",
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  for (const model of AUDIT_MODELS) {
    (prismaMock as Record<string, { findMany: ReturnType<typeof vi.fn> }>)[
      model
    ].findMany.mockResolvedValue([]);
  }
});

describe("classifyRawRow", () => {
  it("recognises an already valid public row", () => {
    expect(
      classifyRawRow(
        row({ status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true }),
      ),
    ).toBe("already_valid_public");
  });

  it("recognises an archived row as invalid and deletable", () => {
    expect(classifyRawRow(row({ archivedAt: new Date() }))).toBe("invalid_and_deletable");
  });

  it("recognises a row with no source evidence", () => {
    expect(classifyRawRow(row({ sourceUrl: null }))).toBe("missing_source_evidence");
    expect(classifyRawRow(row({ sourceHost: null }))).toBe("missing_source_evidence");
  });

  it("recognises a published row blocked by the public gate", () => {
    expect(
      classifyRawRow(
        row({ status: "PUBLISHED", publicRenderReady: false, isThresholdEligible: true }),
      ),
    ).toBe("blocked_by_public_gate");
  });

  it("recognises a convertible draft row with source evidence", () => {
    expect(classifyRawRow(row({ status: "DRAFT" }))).toBe("convertible_through_factory");
  });
});

describe("auditRawRows", () => {
  it("classifies catalog rows and reports the raw-row warning", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      row({ status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true }),
      row({ status: "PUBLISHED", publicRenderReady: false, isThresholdEligible: true }),
      row({ sourceUrl: null }),
      row({ status: "DRAFT" }),
      row({ archivedAt: new Date() }),
    ]);

    const report = await auditRawRows();
    const prayer = report.rows.find((r) => r.contentType === "Prayer");

    expect(prayer).toBeDefined();
    expect(prayer!.alreadyValidPublic).toBe(1);
    expect(prayer!.blockedByPublicGate).toBe(1);
    expect(prayer!.missingSourceEvidence).toBe(1);
    expect(prayer!.convertibleThroughFactory).toBe(1);
    expect(prayer!.invalidAndDeletable).toBe(1);
    // 5 rows, 1 already valid public → 4 raw rows.
    expect(report.totalRawRows).toBe(4);
    expect(report.totalConvertible).toBe(1);
    expect(report.warning).toBe("Existing raw rows require factory conversion or strict deletion.");
  });

  it("emits no warning when every row is already valid public", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      row({ status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true }),
    ]);

    const report = await auditRawRows();

    expect(report.totalRawRows).toBe(0);
    expect(report.warning).toBe("");
  });
});
