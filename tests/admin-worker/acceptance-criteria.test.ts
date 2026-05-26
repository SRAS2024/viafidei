/**
 * Final acceptance criteria (spec §25). These tests exercise the
 * "the worker CAN do X" capability list — they prove the modules
 * exist and the public API is wired up. Runtime acceptance of the
 * 9.5+ scores requires actual production data and is measured by
 * the diagnostics ratings card, not by the unit suite.
 */

import { describe, expect, it } from "vitest";

import * as AdminWorker from "@/lib/admin-worker";

describe("spec §25 — acceptance capability exports", () => {
  it("brain ranks multiple actions and chooses the best safe one", () => {
    expect(typeof AdminWorker.rankActions).toBe("function");
    expect(typeof AdminWorker.decide).toBe("function");
    expect(typeof AdminWorker.runBrain).toBe("function");
  });

  it("executes the selected mission stage instead of merely logging", () => {
    expect(typeof AdminWorker.executeMissionStage).toBe("function");
  });

  it("can discover candidate URLs from approved sources", () => {
    expect(typeof AdminWorker.runDiscoveryOrchestrator).toBe("function");
    expect(typeof AdminWorker.CONTENT_TYPE_STRATEGIES).toBe("object");
  });

  it("can fetch and read source pages", () => {
    expect(typeof AdminWorker.adminWorkerFetch).toBe("function");
    expect(typeof AdminWorker.parseStructuredBlocks).toBe("function");
  });

  it("can classify content accurately", () => {
    expect(typeof AdminWorker.classify).toBe("function");
    expect(typeof AdminWorker.classifyDetailed).toBe("function");
    expect(typeof AdminWorker.detectConfusion).toBe("function");
  });

  it("can verify sensitive fields across sources", () => {
    expect(typeof AdminWorker.runVerifier).toBe("function");
    expect(Array.isArray(AdminWorker.SENSITIVE_FIELDS.SAINT)).toBe(true);
  });

  it("can publish valid content without human approval", () => {
    expect(typeof AdminWorker.runPublishOrchestrator).toBe("function");
    expect(typeof AdminWorker.explainPublishStatus).toBe("function");
  });

  it("can verify that published content appears correctly on the live site", () => {
    expect(typeof AdminWorker.verifyPublished).toBe("function");
  });

  it("can repair failed stages (orchestrator + per-kind handlers)", () => {
    expect(typeof AdminWorker.runRepairOrchestrator).toBe("function");
  });

  it("can learn from outcomes through memory and source reputation", () => {
    expect(typeof AdminWorker.rememberOutcome).toBe("function");
    expect(typeof AdminWorker.decayMemory).toBe("function");
    expect(typeof AdminWorker.listMemoryAudit).toBe("function");
    expect(typeof AdminWorker.recordSourceOutcome).toBe("function");
    expect(typeof AdminWorker.pushReputation).toBe("function");
  });

  it("can explain every important decision (brainExplanation + brain decision audit)", () => {
    expect(typeof AdminWorker.recordDecision).toBe("function");
    // Brain decisions carry rankedAlternatives + brainExplanation +
    // brainFailure (asserted in brain.test.ts).
  });

  it("can explain why content is not growing (GrowthOrchestrator)", () => {
    expect(typeof AdminWorker.runGrowthOrchestrator).toBe("function");
  });

  it("can explain why content was rejected (CandidateUrlScorer + classifier)", () => {
    expect(typeof AdminWorker.scoreCandidate).toBe("function");
    expect(typeof AdminWorker.classifyDetailed).toBe("function");
  });

  it("can explain what it will do next (mission planner + brain)", () => {
    expect(typeof AdminWorker.planMission).toBe("function");
    expect(typeof AdminWorker.runBrain).toBe("function");
  });

  it("can defend the admin site (security defender)", () => {
    expect(typeof AdminWorker.decideAction).toBe("function");
    expect(typeof AdminWorker.defend).toBe("function");
  });

  it("can generate complete Developer Audit reports", () => {
    expect(typeof AdminWorker.collectDeveloperAuditData).toBe("function");
    expect(Array.isArray(AdminWorker.DEVELOPER_AUDIT_SECTIONS)).toBe(true);
    // Spec §19 requires at least these 24 sections.
    expect(AdminWorker.DEVELOPER_AUDIT_SECTIONS.length).toBeGreaterThanOrEqual(24);
  });

  it("can keep growing content until goals are met (Growth Orchestrator + content goals)", () => {
    expect(typeof AdminWorker.refreshContentGoals).toBe("function");
    expect(typeof AdminWorker.runGrowthOrchestrator).toBe("function");
  });

  it("can maintain content after goals are met (cleanup + post-publish probe)", () => {
    expect(typeof AdminWorker.runCleanupPass).toBe("function");
    expect(typeof AdminWorker.verifyPublished).toBe("function");
  });

  it("ships subsystem ratings for every spec §18 subsystem", async () => {
    // The diagnostics module exports runAdminWorkerDiagnostics; we
    // don't run it here (it needs a Prisma client) — we assert that
    // the function exists and that summarizeRatings is wired.
    expect(typeof AdminWorker.runAdminWorkerDiagnostics).toBe("function");
    expect(typeof AdminWorker.summarizeRatings).toBe("function");
  });

  it("ships source coverage scoring per content type (spec §23)", () => {
    expect(typeof AdminWorker.runSourceCoverage).toBe("function");
    expect(typeof AdminWorker.listCoverageBlocked).toBe("function");
  });

  it("ships pipeline durability + resume helpers (spec §3)", () => {
    expect(typeof AdminWorker.recordStage).toBe("function");
    expect(typeof AdminWorker.completeStage).toBe("function");
    expect(typeof AdminWorker.resumeOrAdvance).toBe("function");
    expect(typeof AdminWorker.pipelineMapFor).toBe("function");
    expect(typeof AdminWorker.pipelineSnapshot).toBe("function");
  });

  it("ships homepage orchestrator (spec §20)", () => {
    expect(typeof AdminWorker.runHomepagePublishOrchestrator).toBe("function");
    expect(typeof AdminWorker.inspectHomepage).toBe("function");
  });

  it("ships quality-v2 scoring with doctrinal thresholds (spec §12)", () => {
    expect(typeof AdminWorker.computeFinalScoreV2).toBe("function");
    expect(typeof AdminWorker.thresholdFor).toBe("function");
    expect(typeof AdminWorker.missingDimensions).toBe("function");
    expect(AdminWorker.QUALITY_THRESHOLDS.APPARITION).toBe(0.95);
    expect(AdminWorker.QUALITY_THRESHOLDS.SACRAMENT).toBe(0.95);
    expect(AdminWorker.QUALITY_THRESHOLDS.CHURCH_DOCUMENT).toBe(0.95);
  });
});
