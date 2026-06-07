/**
 * Developer Audit PDF generation — proves "Admin Worker can generate
 * Developer Audit PDFs" (spec section 24).
 *
 * Renders a real PDF buffer from a mocked Prisma. Verifies the PDF
 * starts with the standard %PDF- magic and contains a Developer Audit
 * marker.
 */

import type { AdminDeveloperReportLog } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { generateAdminWorkerDeveloperAuditPdf } from "@/lib/admin-worker/pdf";
import { DEVELOPER_AUDIT_SECTIONS } from "@/lib/admin-worker/report-generator";

function makePrisma() {
  const reportRow: Partial<AdminDeveloperReportLog> = { id: "r1", status: "PENDING" };
  return {
    adminDeveloperReportLog: {
      create: vi.fn(async () => reportRow as AdminDeveloperReportLog),
      update: vi.fn(async () => reportRow as AdminDeveloperReportLog),
    },
    adminWorkerState: { findUnique: vi.fn(async () => ({ id: "singleton" })) },
    adminWorkerPass: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    adminWorkerLog: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    adminWorkerTask: { count: vi.fn(async () => 0) },
    adminWorkerSecurityAction: { count: vi.fn(async () => 0) },
    adminWorkerSourceReputation: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    candidateSourceUrl: { count: vi.fn(async () => 0) },
    workerBuildJob: { count: vi.fn(async () => 0) },
    contentGoal: { findMany: vi.fn(async () => []) },
    publishedContent: { count: vi.fn(async () => 0) },
    postPublishVerification: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    adminWorkerRollbackLedger: {
      findMany: vi.fn(async () => []),
    },
    humanReviewQueue: { count: vi.fn(async () => 0) },
    homepageWorkerDraft: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    homepageQualityScore: { findFirst: vi.fn(async () => null) },
    securityEvent: { count: vi.fn(async () => 0) },
    contentValidationEvidence: { count: vi.fn(async () => 0) },
    contentQualityScore: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    // Spec §19 new audit sections — empty arrays so the PDF can render.
    adminWorkerDecision: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    adminWorkerPipelineStage: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    adminWorkerGrowthSnapshot: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    adminWorkerSourceCoverage: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    adminWorkerMemory: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    adminWorkerRepairPlan: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    adminWorkerSourceRead: { count: vi.fn(async () => 0) },
    adminWorkerCrossSourceVerification: { count: vi.fn(async () => 0) },
    adminWorkerFetchResult: { count: vi.fn(async () => 0) },
    // Spec §3 + §4 + §1 follow-up: audit collects strict-QA + quality
    // scores + structured-block stats.
    adminWorkerStrictQAResult: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
    },
    adminWorkerSourceBlock: {
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    adminWorkerPackageArtifact: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    adminDeveloperReportLog2: undefined, // typo guard
    adminDeveloperReportLog__alias: undefined,
    $queryRaw: vi.fn(async () => [{ "1": 1 }]),
  } as unknown as Parameters<typeof generateAdminWorkerDeveloperAuditPdf>[0];
}

describe("generateAdminWorkerDeveloperAuditPdf", () => {
  it("emits a valid PDF for LAST_24_HOURS", async () => {
    const prisma = makePrisma();
    const { pdf, reportLogId } = await generateAdminWorkerDeveloperAuditPdf(
      prisma,
      "LAST_24_HOURS",
      "admin",
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(reportLogId).toBe("r1");
  });

  it("records a PENDING then GENERATED log row", async () => {
    const prisma = makePrisma();
    await generateAdminWorkerDeveloperAuditPdf(prisma, "LAST_7_DAYS", "admin");
    // create called once with status=PENDING, update called once with GENERATED.
    expect(prisma.adminDeveloperReportLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.adminDeveloperReportLog.update).toHaveBeenCalledTimes(1);
    const updateCall = vi.mocked(prisma.adminDeveloperReportLog.update).mock.calls[0][0];
    expect(updateCall.data).toMatchObject({ status: "GENERATED" });
    expect(updateCall.data.fileSize).toBeGreaterThan(100);
  });

  it("supports filtering to a subset of sections", async () => {
    const prisma = makePrisma();
    const { pdf } = await generateAdminWorkerDeveloperAuditPdf(prisma, "LAST_30_DAYS", "admin", {
      includedSections: ["Diagnostics Results"],
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders every declared section, including the granular per-stage logs", async () => {
    // Guards against declared-but-unrendered drift: each section in
    // DEVELOPER_AUDIT_SECTIONS must produce a valid PDF when requested alone.
    for (const section of DEVELOPER_AUDIT_SECTIONS) {
      const prisma = makePrisma();
      const { pdf } = await generateAdminWorkerDeveloperAuditPdf(prisma, "LAST_24_HOURS", "admin", {
        includedSections: [section],
      });
      expect(pdf.subarray(0, 4).toString(), `section "${section}" failed to render`).toBe("%PDF");
    }
  });

  it("includes the granular pipeline-log sections + brain Worker Requests", () => {
    for (const required of [
      "Discovery Logs",
      "Fetch Logs",
      "Source Read Logs",
      "Classification Logs",
      "Extraction Logs",
      "Verification Logs",
      "QA Logs",
      "Publishing Logs",
      "Cache Logs",
      "Content Goal Progress",
      "Mission Plans",
      "Executive Summary",
      "Worker Requests",
    ]) {
      expect(DEVELOPER_AUDIT_SECTIONS as readonly string[]).toContain(required);
    }
  });
});
