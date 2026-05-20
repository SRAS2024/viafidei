/**
 * getValidationEvidenceSummary() tests.
 *
 * The summary backs the admin "Validation evidence" page. It must:
 *   - tolerate a missing ContentValidationEvidence Prisma model
 *     gracefully (returns zeros, never throws)
 *   - filter by contentType when one is provided
 *   - group by content type for the per-tab table
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getValidationEvidenceSummary } from "@/lib/data/validation-evidence";

beforeEach(() => {
  resetPrismaMock();
});

describe("getValidationEvidenceSummary()", () => {
  it("returns zero rows when the Prisma model is not present", async () => {
    const summary = await getValidationEvidenceSummary({});
    expect(summary.totalRows).toBe(0);
    expect(summary.totalPass).toBe(0);
    expect(summary.totalFail).toBe(0);
    expect(summary.totalInsufficient).toBe(0);
    expect(summary.byContentType).toEqual([]);
    expect(summary.recent).toEqual([]);
  });

  it("aggregates pass / fail / insufficient counts and per-content-type rows when present", async () => {
    const mockModel = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "ev1",
          packageId: null,
          candidateSlug: "our-father",
          contentType: "Prayer",
          fieldName: "prayerText",
          sourceUrl: "https://validator.org/our-father",
          sourceHost: "validator.org",
          evidenceType: "exact_text_match",
          matchedValue: "Our Father, who art in heaven...",
          matchConfidence: 0.98,
          validationDecision: "pass",
          reason: null,
          createdAt: new Date("2026-01-15T00:00:00.000Z"),
        },
      ]),
      count: vi.fn().mockImplementation(async (args?: unknown) => {
        const a = args as { where?: { validationDecision?: string } } | undefined;
        if (!a?.where?.validationDecision) return 5;
        if (a.where.validationDecision === "pass") return 3;
        if (a.where.validationDecision === "fail") return 1;
        if (a.where.validationDecision === "insufficient_evidence") return 1;
        return 0;
      }),
      groupBy: vi.fn().mockResolvedValue([
        { contentType: "Prayer", validationDecision: "pass", _count: { _all: 3 } },
        { contentType: "Prayer", validationDecision: "fail", _count: { _all: 1 } },
        { contentType: "Saint", validationDecision: "pass", _count: { _all: 1 } },
      ]),
    };
    (prismaMock as unknown as Record<string, unknown>).contentValidationEvidence = mockModel;
    try {
      const summary = await getValidationEvidenceSummary({});
      expect(summary.totalRows).toBe(5);
      expect(summary.totalPass).toBe(3);
      expect(summary.totalFail).toBe(1);
      expect(summary.totalInsufficient).toBe(1);
      expect(summary.byContentType).toEqual([
        { contentType: "Prayer", pass: 3, fail: 1, insufficient: 0 },
        { contentType: "Saint", pass: 1, fail: 0, insufficient: 0 },
      ]);
      expect(summary.recent).toHaveLength(1);
      expect(summary.recent[0].fieldName).toBe("prayerText");
    } finally {
      delete (prismaMock as unknown as Record<string, unknown>).contentValidationEvidence;
    }
  });

  it("scopes filters by contentType when provided", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const groupBy = vi.fn().mockResolvedValue([]);
    (prismaMock as unknown as Record<string, unknown>).contentValidationEvidence = {
      findMany,
      count,
      groupBy,
    };
    try {
      await getValidationEvidenceSummary({ contentType: "Prayer" });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contentType: "Prayer" } }),
      );
      expect(count).toHaveBeenCalledWith({ where: { contentType: "Prayer" } });
    } finally {
      delete (prismaMock as unknown as Record<string, unknown>).contentValidationEvidence;
    }
  });

  it("breaks evidence down by source host, field and source role", async () => {
    const groupByImpl = async (args: unknown) => {
      const by = (args as { by: string[] }).by;
      if (by.includes("sourceHost")) {
        return [
          { sourceHost: "validator.org", validationDecision: "pass", _count: { _all: 4 } },
          { sourceHost: "validator.org", validationDecision: "fail", _count: { _all: 1 } },
          {
            sourceHost: "weak.example",
            validationDecision: "insufficient_evidence",
            _count: { _all: 3 },
          },
        ];
      }
      if (by.includes("fieldName")) {
        return [{ fieldName: "feastDay", validationDecision: "pass", _count: { _all: 5 } }];
      }
      if (by.includes("contentType")) {
        return [{ contentType: "Saint", validationDecision: "pass", _count: { _all: 5 } }];
      }
      if (by.includes("reason")) {
        return [{ reason: "no matching feast day found", _count: { _all: 3 } }];
      }
      return [];
    };
    (prismaMock as unknown as Record<string, unknown>).contentValidationEvidence = {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockImplementation(groupByImpl),
    };
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      { host: "validator.org", role: "validation_source" },
      { host: "weak.example", role: "discovery_only_source" },
    ]);
    try {
      const summary = await getValidationEvidenceSummary({});
      expect(summary.bySourceHost.find((h) => h.host === "validator.org")).toEqual({
        host: "validator.org",
        pass: 4,
        fail: 1,
        insufficient: 0,
      });
      expect(summary.byField[0]).toEqual({
        field: "feastDay",
        pass: 5,
        fail: 0,
        insufficient: 0,
      });
      expect(summary.bySourceRole.find((r) => r.role === "validation_source")).toEqual({
        role: "validation_source",
        pass: 4,
        fail: 1,
        insufficient: 0,
      });
      expect(summary.topInsufficientReasons[0]).toEqual({
        reason: "no matching feast day found",
        count: 3,
      });
    } finally {
      delete (prismaMock as unknown as Record<string, unknown>).contentValidationEvidence;
    }
  });
});
