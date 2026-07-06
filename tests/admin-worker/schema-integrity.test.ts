/**
 * Schema-integrity self-check. Proves a DB that is behind the Prisma schema
 * (a missing column / table) is detected and named — instead of the funnel
 * silently swallowing the P2022 as "no rows" and stalling all publishing.
 */
import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";

import {
  checkSchemaIntegrity,
  reportQueryError,
  summarizeDrift,
} from "@/lib/admin-worker/schema-integrity";

/** All delegates the probe touches, each with its OWN findFirst returning null. */
function healthyPrisma(): PrismaClient {
  const mk = () => ({ findFirst: vi.fn(async () => null) });
  return {
    adminWorkerPackageArtifact: mk(),
    publishedContent: mk(),
    adminWorkerSourceRead: mk(),
    adminWorkerRepairPlan: mk(),
    checklistItem: mk(),
    adminWorkerStrictQAResult: mk(),
    contentQualityScore: mk(),
    adminWorkerCrossSourceVerification: mk(),
    humanReviewQueue: mk(),
    adminWorkerEscalation: mk(),
  } as unknown as PrismaClient;
}

const p2022 = Object.assign(new Error("column does not exist"), {
  code: "P2022",
  meta: { column: "AdminWorkerPackageArtifact.gateDiagnosis" },
});
const p2021 = Object.assign(new Error("table does not exist"), {
  code: "P2021",
  meta: { table: "AdminWorkerStrictQAResult" },
});

describe("checkSchemaIntegrity", () => {
  it("reports ok when every critical table matches the schema", async () => {
    const res = await checkSchemaIntegrity(healthyPrisma());
    expect(res.ok).toBe(true);
    expect(res.drifts).toHaveLength(0);
    expect(res.checked).toBeGreaterThanOrEqual(10);
  });

  it("detects a missing column (P2022) and names it", async () => {
    const prisma = healthyPrisma();
    (prisma.adminWorkerPackageArtifact.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(
      p2022,
    );
    const res = await checkSchemaIntegrity(prisma);
    expect(res.ok).toBe(false);
    expect(res.drifts).toHaveLength(1);
    expect(res.drifts[0]).toMatchObject({ model: "AdminWorkerPackageArtifact", code: "P2022" });
    expect(res.drifts[0].detail).toContain("gateDiagnosis");
  });

  it("detects a missing table (P2021)", async () => {
    const prisma = healthyPrisma();
    (prisma.adminWorkerStrictQAResult.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(
      p2021,
    );
    const res = await checkSchemaIntegrity(prisma);
    expect(res.ok).toBe(false);
    expect(res.drifts[0].code).toBe("P2021");
  });

  it("does NOT treat a non-schema (connection) error as drift", async () => {
    const prisma = healthyPrisma();
    (prisma.publishedContent.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("connection refused"), // no Prisma code
    );
    const res = await checkSchemaIntegrity(prisma);
    expect(res.ok).toBe(true); // inconclusive ≠ drift (left to the db-health rating)
    expect(res.drifts).toHaveLength(0);
  });
});

describe("reportQueryError", () => {
  it("logs loudly for a Prisma error code", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportQueryError("STRICT_QA candidate fetch", p2022);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toContain("P2022");
    spy.mockRestore();
  });

  it("stays quiet for an ordinary (non-Prisma) error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportQueryError("x", new Error("plain"));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("summarizeDrift", () => {
  it("names the migrate-deploy remedy when drifted", () => {
    const s = summarizeDrift({
      ok: false,
      checked: 10,
      drifts: [{ model: "AdminWorkerPackageArtifact", code: "P2022", detail: "missing column: x" }],
    });
    expect(s).toMatch(/migrate deploy/i);
    expect(s).toContain("AdminWorkerPackageArtifact");
  });
});
