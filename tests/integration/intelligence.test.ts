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
  runCodeAwareness,
  runSchemaAwareness,
  runUiAwareness,
} from "@/lib/admin-worker/awareness";
import { resetCustodyThrottle, runCustodyPass } from "@/lib/admin-worker/custody";

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

  it("runs code awareness and requests refactors of oversized modules", async () => {
    if (!brainOnline) return;
    resetAwarenessThrottle();
    const res = await runCodeAwareness(prisma);
    expect(res.ran).toBe(true);
    const call = await prisma.adminWorkerBrainCall.findFirst({ where: { op: "analyze_code" } });
    expect(call).not.toBeNull();
    // The worker should flag its own oversized modules (dispatcher/brain).
    const req = await prisma.adminWorkerDeveloperRequest.findFirst({
      where: { source: "code_awareness", kind: "code" },
    });
    expect(req).not.toBeNull();
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
