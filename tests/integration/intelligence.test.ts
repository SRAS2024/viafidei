// Integration: prove the full intelligence loop — TypeScript service ->
// Python brain (subprocess) -> Postgres persistence — works end to end.
//
// Excluded from `npm test`; runs only under VITEST_INTEGRATION=1 against an
// isolated test DB (see tests/setup.integration.ts).

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { probeBrain, resetBrainStatus } from "@/lib/admin-worker/intelligence";
import {
  analyzeGraph,
  loadSubgraph,
  upsertGraphEdge,
  upsertGraphNode,
} from "@/lib/admin-worker/intelligence";
import {
  applyLearningFromOutcome,
  checkDuplicate,
  computeIqMetrics,
  detectMissingFor,
  embedAndStore,
  findRelated,
  inspectAndRecordRequests,
  recordAdminFeedback,
  screenCommunionRisk,
  scoreRecordQuality,
} from "@/lib/admin-worker/intelligence/service";
import {
  resetAwarenessThrottle,
  runSchemaAwareness,
  runUiAwareness,
} from "@/lib/admin-worker/awareness";
import { resetSelfModelThrottle, runSelfModelPass } from "@/lib/admin-worker/self-model";
import { resetCustodyThrottle, runCustodyPass } from "@/lib/admin-worker/custody";
import { runMissionControlPass, runStucknessPass } from "@/lib/admin-worker/mission-control";
import { replayLastPass, replayRecentPasses } from "@/lib/admin-worker/replay-runner";

let brainOnline = false;

beforeAll(async () => {
  process.env.INTELLIGENCE_BRAIN_ENABLED = "1";
  resetBrainStatus();
  const probe = await probeBrain();
  brainOnline = probe != null && probe.protocolVersion === 1;
});

afterAll(async () => {
  // The intelligence tables are exclusive to these tests in the test DB.
  await prisma.adminWorkerBrainCall.deleteMany({});
  await prisma.adminWorkerEmbedding.deleteMany({});
  await prisma.adminWorkerGraphEdge.deleteMany({});
  await prisma.adminWorkerGraphNode.deleteMany({});
  await prisma.adminWorkerDeveloperRequest.deleteMany({});
  await prisma.dailyReading.deleteMany({});
  await prisma.humanReviewQueue.deleteMany({ where: { contentType: "READING" } });
  await prisma.adminWorkerMemory.deleteMany({});
  await prisma.publishedContent.deleteMany({ where: { slug: { startsWith: "custody-test-" } } });
  // Mission-control / stuckness fixtures (decisions before passes — SetNull FK).
  await prisma.adminWorkerDecision.deleteMany({ where: { decisionType: "brain_pass" } });
  await prisma.adminWorkerLog.deleteMany({
    where: {
      eventName: {
        in: [
          "mission_control",
          "worker_stuck",
          "self_model_built",
          "extract_failed",
          "intelligence_pass",
          "replay_simulation",
        ],
      },
    },
  });
  await prisma.adminWorkerRepairPlan.deleteMany({});
  await prisma.adminWorkerPass.deleteMany({});
  await prisma.contentGoal.deleteMany({});
  // Dedicated unified-intelligence tables.
  await prisma.adminWorkerSelfModelSnapshot.deleteMany({}).catch(() => undefined);
  await prisma.adminWorkerMissionState.deleteMany({}).catch(() => undefined);
  await prisma.adminWorkerCapabilityScore.deleteMany({}).catch(() => undefined);
  await prisma.adminWorkerCalibrationHistory.deleteMany({}).catch(() => undefined);
  await prisma.adminWorkerTestGapRecord.deleteMany({}).catch(() => undefined);
  await prisma.adminWorkerStucknessRecord.deleteMany({}).catch(() => undefined);
  await prisma.adminWorkerSourceBlock.deleteMany({}).catch(() => undefined);
  await prisma.adminWorkerSourceRead.deleteMany({}).catch(() => undefined);
  // Tear down the persistent brain process so vitest can exit cleanly.
  resetBrainStatus();
});

describe("intelligence service (TS -> Python -> Postgres)", () => {
  it("screens communion risk and writes an audit row", async () => {
    if (!brainOnline) return;
    const before = await prisma.adminWorkerBrainCall.count();
    const screen = await screenCommunionRisk(prisma, {
      name: "Old Catholic Church, independent of Rome",
      url: "http://example.org",
    });
    expect(screen.available).toBe(true);
    expect(screen.block).toBe(true);
    expect(screen.risk).toBeGreaterThanOrEqual(0.6);
    const after = await prisma.adminWorkerBrainCall.count();
    expect(after).toBe(before + 1);
    const last = await prisma.adminWorkerBrainCall.findFirst({
      where: { op: "detect_communion_risk" },
      orderBy: { createdAt: "desc" },
    });
    expect(last?.riskLevel === "high" || last?.riskLevel === "critical").toBe(true);
  });

  it("does not block the Holy See", async () => {
    if (!brainOnline) return;
    const screen = await screenCommunionRisk(prisma, {
      name: "The Holy See",
      url: "https://www.vatican.va",
    });
    expect(screen.block).toBe(false);
    expect(screen.risk).toBeLessThanOrEqual(0.1);
  });

  it("embeds records and finds the related one via vector memory", async () => {
    if (!brainOnline) return;
    const stored = await embedAndStore(prisma, "TEST_PRAYER", [
      {
        id: "p1",
        text: "Hail Mary full of grace the Lord is with thee blessed art thou",
        title: "Hail Mary",
      },
      {
        id: "p2",
        text: "Saint Joseph the carpenter foster father of Jesus pray for us",
        title: "St Joseph",
      },
    ]);
    expect(stored.stored).toBe(2);
    const rows = await prisma.adminWorkerEmbedding.count({ where: { entityType: "TEST_PRAYER" } });
    expect(rows).toBe(2);

    const related = await findRelated(
      prisma,
      "TEST_PRAYER",
      "a prayer to our lady the blessed virgin mary",
      { k: 5 },
    );
    expect(related.available).toBe(true);
    expect(related.matches[0]?.id).toBe("p1");
  });

  it("detects duplicates and scores quality", async () => {
    if (!brainOnline) return;
    const dup = await checkDuplicate(
      prisma,
      { title: "Hail Mary", slug: "hail-mary", text: "full of grace" },
      [{ id: "x", title: "The Hail Mary", slug: "hail-mary", text: "full of grace the lord" }],
    );
    expect(dup.isDuplicate).toBe(true);

    const q = await scoreRecordQuality(prisma, {
      contentType: "PRAYER",
      title: "Untitled",
      body: "x".repeat(700),
      // no sources/citations -> publish gate must fail
    });
    expect(q.publishGatesFailed).toContain("no-source");
  });

  it("self-inspects and persists developer requests", async () => {
    if (!brainOnline) return;
    const res = await inspectAndRecordRequests(prisma, {
      failures: [{ category: "source_problem" }, { category: "source_problem" }],
      blocked: [
        { reason: "page needs dynamic rendering fetcher" },
        { reason: "pdf extraction failed" },
      ],
      jobs: [{ status: "DONE" }, { status: "FAILED" }],
    });
    expect(res.available).toBe(true);
    expect(res.persisted.created).toBeGreaterThan(0);
    const reqs = await prisma.adminWorkerDeveloperRequest.count();
    expect(reqs).toBeGreaterThan(0);

    // Re-running bumps occurrences rather than duplicating.
    const before = await prisma.adminWorkerDeveloperRequest.count();
    await inspectAndRecordRequests(prisma, {
      blocked: [{ reason: "page needs dynamic rendering fetcher" }],
    });
    const after = await prisma.adminWorkerDeveloperRequest.count();
    expect(after).toBe(before);
  });

  it("computes IQ metrics", async () => {
    if (!brainOnline) return;
    const res = await computeIqMetrics(prisma, {
      duplicatesPrevented: 8,
      duplicateCandidates: 10,
      repairsSucceeded: 3,
      repairsAttempted: 4,
      avgSourceAuthority: 0.82,
    });
    expect(res.available).toBe(true);
    expect(res.metrics?.duplicate_prevention_rate).toBeCloseTo(0.8, 5);
    expect(res.metrics?.iq_index).toBeGreaterThanOrEqual(0);
  });

  it("persists a knowledge graph and analyzes it", async () => {
    if (!brainOnline) return;
    const mary = await upsertGraphNode(prisma, {
      nodeType: "ENTITY",
      entityType: "TEST_SAINT",
      entityId: "mary",
      label: "Virgin Mary",
    });
    const memorare = await upsertGraphNode(prisma, {
      nodeType: "ENTITY",
      entityType: "TEST_PRAYER",
      entityId: "memorare",
      label: "Memorare",
    });
    // Upsert is idempotent.
    const maryAgain = await upsertGraphNode(prisma, {
      nodeType: "ENTITY",
      entityType: "TEST_SAINT",
      entityId: "mary",
      label: "Virgin Mary",
    });
    expect(maryAgain).toBe(mary);

    await upsertGraphEdge(prisma, {
      fromNodeId: mary,
      toNodeId: memorare,
      edgeType: "ASSOCIATED_WITH",
      confidence: 0.8,
      status: "APPROVED",
    });

    const sub = await loadSubgraph(prisma);
    expect(sub.nodes.length).toBeGreaterThanOrEqual(2);
    expect(sub.edges.length).toBeGreaterThanOrEqual(1);

    const analysis = await analyzeGraph(sub.nodes, sub.edges);
    expect(analysis?.ok).toBe(true);
    expect(analysis?.result?.node_count).toBeGreaterThanOrEqual(2);
  });
});

describe("daily readings (worker refresh)", () => {
  it("routes to review and never fabricates text when no parser is configured", async () => {
    const { refreshDailyReadings, getStoredReading } =
      await import("@/lib/admin-worker/daily-readings");
    const date = new Date(Date.UTC(2026, 5, 7)); // a Sunday

    const res = await refreshDailyReadings(prisma, { date });
    expect(res.status).toBe("review");
    expect(res.reviewQueued).toBe(true);

    const row = await getStoredReading(prisma, date);
    expect(row?.status).toBe("REVIEW");
    const sections = (row?.sections as Array<{ kind: string; body: string | null }>) ?? [];
    expect(sections.length).toBeGreaterThanOrEqual(5); // Sunday includes a 2nd reading
    expect(sections.every((s) => s.body === null)).toBe(true); // never fabricated

    // A human-review task and a developer request were filed.
    const task = await prisma.humanReviewQueue.findFirst({ where: { contentType: "READING" } });
    expect(task).not.toBeNull();
    const dr = await prisma.adminWorkerDeveloperRequest.findFirst({
      where: { source: "daily_readings" },
    });
    expect(dr).not.toBeNull();

    // Re-running does not duplicate the review task.
    await refreshDailyReadings(prisma, { date });
    const taskCount = await prisma.humanReviewQueue.count({ where: { contentType: "READING" } });
    expect(taskCount).toBe(1);
  });
});

describe("learning, gaps, and admin feedback (new ops)", () => {
  it("applies a learning signal to source-reputation memory", async () => {
    if (!brainOnline) return;
    const res = await applyLearningFromOutcome(prisma, {
      type: "source_failure",
      sourceHost: "bad.example.test",
      contentType: "PRAYER",
    });
    expect(res.available).toBe(true);
    expect(res.applied).toBeGreaterThanOrEqual(1);
    // The host-ranking memory the planner consults now reflects the failure.
    const mem = await prisma.adminWorkerMemory.findUnique({
      where: {
        memoryType_memoryKey: { memoryType: "SOURCE_PRIORITY", memoryKey: "bad.example.test" },
      },
    });
    expect(mem).not.toBeNull();
    expect(mem!.confidence).toBeLessThan(0.5); // a failure lowers confidence
  });

  it("treats admin rejection as a training signal", async () => {
    if (!brainOnline) return;
    const before = await prisma.adminWorkerBrainCall.count({ where: { op: "learn_from_outcome" } });
    const res = await recordAdminFeedback(prisma, {
      action: "rejected",
      contentType: "APPARITION",
    });
    expect(res.available).toBe(true);
    expect((res.lesson ?? "").toLowerCase()).toContain("admin");
    const after = await prisma.adminWorkerBrainCall.count({ where: { op: "learn_from_outcome" } });
    expect(after).toBe(before + 1);
  });

  it("detects missing fields on a thin record", async () => {
    if (!brainOnline) return;
    const res = await detectMissingFor(prisma, {
      contentType: "PRAYER",
      title: "Untitled",
      body: "short",
    });
    expect(res.available).toBe(true);
    const fields = res.missing.map((m) => m.field);
    expect(fields).toContain("sources");
    expect(fields).toContain("citations");
    expect(res.completeness).toBeLessThan(0.6);
  });
});

describe("schema/UI awareness + content custody", () => {
  it("runs schema awareness and records a brain call", async () => {
    if (!brainOnline) return;
    resetAwarenessThrottle();
    const res = await runSchemaAwareness(prisma);
    expect(res.ran).toBe(true);
    const call = await prisma.adminWorkerBrainCall.findFirst({ where: { op: "analyze_schema" } });
    expect(call).not.toBeNull();
  });

  it("runs UI awareness and records a brain call", async () => {
    if (!brainOnline) return;
    resetAwarenessThrottle();
    const res = await runUiAwareness(prisma);
    expect(res.ran).toBe(true);
    const call = await prisma.adminWorkerBrainCall.findFirst({ where: { op: "analyze_ui" } });
    expect(call).not.toBeNull();
  });

  it("runs the unified self-model pass and requests its own upgrades", async () => {
    if (!brainOnline) return;
    resetSelfModelThrottle();
    const res = await runSelfModelPass(prisma);
    expect(res.ran).toBe(true);
    // The brain ingested the corpus, built the self-model, and built the call graph.
    const call = await prisma.adminWorkerBrainCall.findFirst({ where: { op: "build_self_model" } });
    expect(call).not.toBeNull();
    const ingest = await prisma.adminWorkerBrainCall.findFirst({
      where: { op: "ingest_codebase" },
    });
    expect(ingest).not.toBeNull();
    const callGraph = await prisma.adminWorkerBrainCall.findFirst({
      where: { op: "build_call_graph" },
    });
    expect(callGraph).not.toBeNull();
    // A durable self-model snapshot was persisted to its dedicated table.
    const snapshot = await prisma.adminWorkerSelfModelSnapshot.findFirst({
      orderBy: { createdAt: "desc" },
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.fileCount).toBeGreaterThan(0);
    expect(snapshot!.brainOpCount).toBeGreaterThan(0);
    // The worker turns ranked self-upgrades into developer requests — each a
    // complete, structured product-manager record (spec item 7).
    const req = await prisma.adminWorkerDeveloperRequest.findFirst({
      where: { source: "self_model" },
    });
    expect(req).not.toBeNull();
    const meta = (req!.metadata ?? {}) as Record<string, unknown>;
    for (const key of [
      "affected_files",
      "affected_models",
      "affected_brain_operations",
      "expected_user_value",
      "risk_if_not_fixed",
      "suggested_implementation_plan",
      "suggested_migration",
      "priority_score",
      "confidence_score",
    ]) {
      expect(meta).toHaveProperty(key);
    }
  });

  it("custody flags weak published content and files an improvement request", async () => {
    if (!brainOnline) return;
    const uid = `custody-test-${Date.now()}`;
    await prisma.publishedContent.create({
      data: {
        checklistItemId: uid,
        contentType: "PRAYER",
        slug: uid,
        title: "Weak custody record",
        payload: { body: "tiny" },
        authorityLevel: "COMMUNITY",
        isPublished: true,
      },
    });
    resetCustodyThrottle();
    const res = await runCustodyPass(prisma);
    expect(res.ran).toBe(true);
    expect(res.scanned).toBeGreaterThanOrEqual(1);
    expect(res.weak).toBeGreaterThanOrEqual(1);
    const dr = await prisma.adminWorkerDeveloperRequest.findFirst({ where: { source: "custody" } });
    expect(dr).not.toBeNull();
  });
});

describe("mission control + stuckness (wired into the loop)", () => {
  it("builds the mission tree from content goals and recommends the next action", async () => {
    if (!brainOnline) return;
    await prisma.contentGoal.createMany({
      data: [
        { contentType: "PRAYER", desiredTarget: 1000, currentValidCount: 5, priority: 90 },
        {
          contentType: "SACRAMENT",
          desiredTarget: 7,
          currentValidCount: 7,
          canonicalMax: 7,
          priority: 50,
        },
      ],
      skipDuplicates: true,
    });

    const res = await runMissionControlPass(prisma);
    expect(res.ran).toBe(true);
    // The brain built the mission tree + recommended the next mission action.
    const tree = await prisma.adminWorkerBrainCall.findFirst({
      where: { op: "build_mission_tree" },
    });
    expect(tree).not.toBeNull();
    const nextAction = await prisma.adminWorkerBrainCall.findFirst({
      where: { op: "recommend_next_mission_action" },
    });
    expect(nextAction).not.toBeNull();
    // Durable mission state was persisted to its dedicated table.
    const snap = await prisma.adminWorkerLog.findFirst({ where: { eventName: "mission_control" } });
    expect(snap).not.toBeNull();
    const prayerMission = await prisma.adminWorkerMissionState.findUnique({
      where: { contentType: "PRAYER" },
    });
    expect(prayerMission).not.toBeNull();
    expect(prayerMission!.completionPct).toBeGreaterThanOrEqual(0);
    // The least-complete open mission (PRAYER) is the next target, not the
    // already-complete SACRAMENT.
    expect(res.nextContentType).toBe("PRAYER");
  });

  it("detects an action loop with no content growth and files a developer request", async () => {
    if (!brainOnline) return;
    // Seed a stuck history: the same mission stage repeated with zero growth.
    for (let i = 0; i < 6; i++) {
      await prisma.adminWorkerDecision.create({
        data: {
          decisionType: "brain_pass",
          inputSummary: "stuck-test",
          chosenAction: "DISCOVER_SOURCE",
          missionStage: "DISCOVERY",
        },
      });
    }
    for (let i = 0; i < 4; i++) {
      await prisma.adminWorkerPass.create({
        data: { passType: "AUTONOMOUS", status: "SUCCEEDED", contentPublished: 0 },
      });
    }

    const res = await runStucknessPass(prisma);
    expect(res.ran).toBe(true);
    expect(res.stuck).toBe(true);
    // The brain call + unblock strategy were recorded.
    const stuckCall = await prisma.adminWorkerBrainCall.findFirst({
      where: { op: "detect_stuckness" },
    });
    expect(stuckCall).not.toBeNull();
    // A worker_stuck log + a developer request surface the blocker for review.
    const log = await prisma.adminWorkerLog.findFirst({ where: { eventName: "worker_stuck" } });
    expect(log).not.toBeNull();
    const dr = await prisma.adminWorkerDeveloperRequest.findFirst({
      where: { source: "stuckness" },
    });
    expect(dr).not.toBeNull();
    // Durable stuckness record persisted to its dedicated table.
    const stuckRow = await prisma.adminWorkerStucknessRecord.findFirst({
      orderBy: { createdAt: "desc" },
    });
    expect(stuckRow).not.toBeNull();
    expect(stuckRow!.signals.length).toBeGreaterThan(0);
  });
});

describe("Catholic-extraction enrichment (source reading)", () => {
  it("identifies the document type + extracts structured Catholic refs on a new read", async () => {
    if (!brainOnline) return;
    const { readSource } = await import("@/lib/admin-worker/source-reader");
    const body = (
      "<h1>Rerum Novarum</h1><p>This encyclical letter of Pope Leo XIII, given in 1891, " +
      "teaches on capital and labor. See canon 1234. As the Catechism teaches (CCC 2419), " +
      "the Church judges economic questions in the light of the Gospel.</p>"
    ).repeat(3);
    const res = await readSource(prisma, {
      sourceUrl: "https://www.vatican.va/test-rerum-novarum",
      sourceHost: "vatican.va",
      rawBody: body,
    });
    expect(res.sourceReadId).toBeTruthy();
    // The brain ran Catholic extraction on the live read and recorded both calls.
    const idCall = await prisma.adminWorkerBrainCall.findFirst({
      where: { op: "identify_document_type" },
    });
    expect(idCall).not.toBeNull();
    const structCall = await prisma.adminWorkerBrainCall.findFirst({
      where: { op: "extract_structured_catholic_document" },
    });
    expect(structCall).not.toBeNull();
  });
});

describe("post-pass reflection (self-explanation + test gaps)", () => {
  it("explains the final decision and turns recurring failures into test-gap requests", async () => {
    if (!brainOnline) return;
    await prisma.adminWorkerDecision.create({
      data: {
        decisionType: "brain_pass",
        inputSummary: "reflection-test",
        chosenAction: "FETCH_SOURCE",
        missionStage: "SOURCE_FETCH",
        confidence: 0.8,
        reason: "trusted source, highest expected value",
      },
    });
    for (let i = 0; i < 3; i++) {
      await prisma.adminWorkerLog.create({
        data: {
          category: "ERROR",
          severity: "ERROR",
          eventName: "extract_failed",
          message: "pdf extraction failed for council document",
        },
      });
    }

    const { runPostPassIntelligence } = await import("@/lib/admin-worker/intelligence-pass");
    const pass = await prisma.adminWorkerPass.create({
      data: { passType: "AUTONOMOUS", status: "SUCCEEDED" },
    });
    await runPostPassIntelligence(prisma, { passId: pass.id, workerId: "reflection-test" });

    // The brain explained its real decision (dashboard self-explanations).
    const expl = await prisma.adminWorkerBrainCall.findFirst({ where: { op: "explain_decision" } });
    expect(expl).not.toBeNull();
    // Recurring failures became a test-gap → a regression-test developer request.
    const gap = await prisma.adminWorkerBrainCall.findFirst({ where: { op: "detect_test_gap" } });
    expect(gap).not.toBeNull();
    const dr = await prisma.adminWorkerDeveloperRequest.findFirst({
      where: { source: "test_gaps" },
    });
    expect(dr).not.toBeNull();
    // Durable test-gap record + capability scores + calibration history persisted.
    const gapRow = await prisma.adminWorkerTestGapRecord.findFirst();
    expect(gapRow).not.toBeNull();
    const capRow = await prisma.adminWorkerCapabilityScore.findFirst();
    expect(capRow).not.toBeNull();
    const calRow = await prisma.adminWorkerCalibrationHistory.findFirst();
    expect(calRow).not.toBeNull();

    // Replay & resilience reasoning ran over the event-sourced record.
    const cmp = await prisma.adminWorkerBrainCall.findFirst({ where: { op: "compare_decisions" } });
    expect(cmp).not.toBeNull();
    const integrity = await prisma.adminWorkerBrainCall.findFirst({
      where: { op: "check_replay_integrity" },
    });
    expect(integrity).not.toBeNull();
  });
});

describe("replay orchestration (last pass + 50-pass simulation)", () => {
  it("replays the last decision from its stored candidates and reproduces it", async () => {
    if (!brainOnline) return;
    await prisma.adminWorkerDecision.create({
      data: {
        decisionType: "brain_pass",
        inputSummary: "replay-test",
        chosenAction: "CONTENT_GROWTH:CONTENT",
        missionStage: "DISCOVERY",
        confidence: 0.7,
        rankedAlternatives: [
          { missionStage: "DISCOVERY", finalScore: 0.8, safe: true },
          { missionStage: "REPORTING", finalScore: 0.4, safe: true },
        ],
      },
    });

    const res = await replayLastPass(prisma);
    expect(res.ran).toBe(true);
    expect(res.reproduced).toBe(true); // top-scored safe candidate matches the chosen stage
    const call = await prisma.adminWorkerBrainCall.findFirst({ where: { op: "replay_decision" } });
    expect(call).not.toBeNull();

    // Replay the recent window in simulation → reproduction rate + snapshot.
    const sim = await replayRecentPasses(prisma, 50);
    expect(sim.ran).toBe(true);
    expect(sim.replayed).toBeGreaterThanOrEqual(1);
    expect(sim.reproductionRate).toBeGreaterThan(0);
    const snap = await prisma.adminWorkerLog.findFirst({
      where: { eventName: "replay_simulation" },
    });
    expect(snap).not.toBeNull();
  });
});
