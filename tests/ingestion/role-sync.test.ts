/**
 * runRoleSync() unit tests.
 *
 * The job aggregates SourceQualityScore counters per source, runs
 * decideRoleTransition() on each, and writes the role transition
 * back to IngestionSource. We mock Prisma and assert:
 *
 *   - sources with poor stats are demoted / rejected
 *   - sources with strong stats are promoted
 *   - sources with no scores are left unchanged
 *   - rejected sources are not auto-promoted
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runRoleSync } from "@/lib/ingestion/sources/role-sync";

beforeEach(() => {
  resetPrismaMock();
});

describe("runRoleSync()", () => {
  it("does nothing when there are no active sources", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);
    const report = await runRoleSync();
    expect(report.inspected).toBe(0);
    expect(report.promoted).toBe(0);
    expect(report.demoted).toBe(0);
    expect(report.rejected).toBe(0);
    expect(prismaMock.ingestionSource.update).not.toHaveBeenCalled();
  });

  it("leaves a source unchanged when it has no quality scores", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      { id: "src1", host: "vatican.va", role: "discovery_only_source" },
    ]);
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([]);
    const report = await runRoleSync();
    expect(report.inspected).toBe(1);
    expect(report.unchanged).toBe(1);
    expect(prismaMock.ingestionSource.update).not.toHaveBeenCalled();
  });

  it("promotes a discovery_only_source with strong stats", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      { id: "src1", host: "vatican.va", role: "discovery_only_source" },
    ]);
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([
      {
        sourceId: "src1",
        buildSuccessCount: 18,
        buildFailureCount: 2,
        qaPassCount: 15,
        qaFailCount: 5,
        wrongContentCount: 0,
        duplicateCount: 0,
      },
    ]);
    prismaMock.ingestionSource.update.mockResolvedValue({ id: "src1" });
    const report = await runRoleSync();
    expect(report.promoted).toBe(1);
    expect(prismaMock.ingestionSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "src1" },
        data: expect.objectContaining({ role: "validation_source" }),
      }),
    );
  });

  it("rejects a source with very high wrong-content rate", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      { id: "src1", host: "junk.example", role: "validation_source" },
    ]);
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([
      {
        sourceId: "src1",
        buildSuccessCount: 2,
        buildFailureCount: 18,
        qaPassCount: 1,
        qaFailCount: 19,
        wrongContentCount: 12,
        duplicateCount: 0,
      },
    ]);
    prismaMock.ingestionSource.update.mockResolvedValue({ id: "src1" });
    const report = await runRoleSync();
    expect(report.rejected).toBe(1);
    expect(prismaMock.ingestionSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "src1" },
        data: expect.objectContaining({ role: "rejected_source" }),
      }),
    );
  });

  it("does not auto-promote a rejected source", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      { id: "src1", host: "rehab.example", role: "rejected_source" },
    ]);
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([
      {
        sourceId: "src1",
        buildSuccessCount: 100,
        buildFailureCount: 0,
        qaPassCount: 100,
        qaFailCount: 0,
        wrongContentCount: 0,
        duplicateCount: 0,
      },
    ]);
    const report = await runRoleSync();
    expect(report.unchanged).toBe(1);
    expect(prismaMock.ingestionSource.update).not.toHaveBeenCalled();
  });
});
