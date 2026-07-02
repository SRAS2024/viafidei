/**
 * Escalation engine — the deduplicated email+PDF path. Pins the fingerprint,
 * that an already-open+emailed issue is NOT re-emailed (only its occurrence
 * count bumps), and that a genuinely new issue generates the PDF + sends the
 * email. Heavy deps (PDF, mailer, self-assessment) are mocked.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  buildSelfAssessment: vi.fn(),
  generatePdf: vi.fn(async () => ({ pdf: Buffer.from("PDF"), reportLogId: "r1" })),
  sendEmail: vi.fn(async () => ({ ok: true, delivery: "sent" as const })),
  getVersionContext: vi.fn(async () => ({
    current: {
      label: "admin-worker/abc",
      sha: "abc123",
      capturedAt: new Date(0),
      changedSummary: null,
    },
    previous: null,
    upgradedRecently: false,
    recentUpgradeSummary: null,
  })),
}));

vi.mock("@/lib/admin-worker/self-model", () => ({
  buildSelfModelCorpus: () => ({
    files: [],
    routes: [],
    models: [],
    scripts: [],
    stages: [],
    brain_ops: [],
  }),
}));
vi.mock("@/lib/admin-worker/self-assessment", () => ({
  buildSelfAssessment: h.buildSelfAssessment,
}));
vi.mock("@/lib/admin-worker/pdf", () => ({ generateAdminWorkerEscalationPdf: h.generatePdf }));
vi.mock("@/lib/email/admin-send", () => ({ sendAdminWorkerEscalation: h.sendEmail }));
vi.mock("@/lib/admin-worker/code-version", () => ({ getVersionContext: h.getVersionContext }));

import {
  computeEscalationFingerprint,
  runEscalationCheckIfDue,
} from "@/lib/admin-worker/escalation";

function defaultAssessment() {
  return {
    generatedAt: new Date(0),
    currentTask: null,
    currentMode: "CONSTANT_FILL",
    currentBlocker: null,
    contentType: "PRAYER",
    windowHours: 6,
    idleMs: 0,
    heartbeatAgeMs: 1000,
    workerLive: true,
    paused: false,
    publishedDelta: 0,
    extractionsInWindow: 30,
    publishesInWindow: 0,
    duplicateWork: 0,
    unpublishedBacklog: 40,
    qualityFailRate: 0,
    retryPatterns: [],
    productive: false,
    warnings: [
      {
        kind: "EXTRACTING_WITHOUT_PUBLISHING" as const,
        severity: "ERROR" as const,
        detail: "30 built, 0 published",
        signals: ["extractions=30"],
        contentType: "PRAYER",
      },
    ],
  };
}

function makePrisma(existing: unknown) {
  return {
    adminWorkerMemory: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
    },
    adminWorkerEscalation: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => existing),
      update: vi.fn(async () => ({})),
      upsert: vi.fn(async () => ({})),
    },
    adminWorkerLog: { create: vi.fn(async () => ({ id: "l1" })) },
  };
}

beforeEach(() => {
  h.buildSelfAssessment.mockReset().mockResolvedValue(defaultAssessment());
  h.generatePdf.mockClear();
  h.sendEmail.mockReset().mockResolvedValue({ ok: true, delivery: "sent" });
});

describe("computeEscalationFingerprint", () => {
  it("is stable for the same inputs and differs by kind/type/sha", () => {
    const base = { kind: "NO_VALUE", contentType: "PRAYER", versionSha: "abc" };
    expect(computeEscalationFingerprint(base)).toBe(computeEscalationFingerprint(base));
    expect(computeEscalationFingerprint(base)).not.toBe(
      computeEscalationFingerprint({ ...base, kind: "LOOPING" }),
    );
    expect(computeEscalationFingerprint(base)).not.toBe(
      computeEscalationFingerprint({ ...base, versionSha: "def" }),
    );
  });
});

describe("runEscalationCheckIfDue", () => {
  it("sends the PDF + email for a genuinely new escalation", async () => {
    const prisma = makePrisma(null);
    const r = await runEscalationCheckIfDue(prisma as never, { force: true });
    expect(r.escalated).toBe(true);
    expect(h.generatePdf).toHaveBeenCalledTimes(1);
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
    expect(prisma.adminWorkerEscalation.upsert).toHaveBeenCalledTimes(1);
    expect(r.emailed).toBe(true);
    expect(r.deduped).toBe(false);
  });

  it("does NOT re-email an already-open, already-sent escalation (dedup)", async () => {
    const prisma = makePrisma({
      resolvedAt: null,
      emailSentAt: new Date(0),
      occurrences: 2,
    });
    const r = await runEscalationCheckIfDue(prisma as never, { force: true });
    expect(r.escalated).toBe(true);
    expect(r.deduped).toBe(true);
    expect(h.generatePdf).not.toHaveBeenCalled();
    expect(h.sendEmail).not.toHaveBeenCalled();
    // occurrence count bumped instead.
    expect(prisma.adminWorkerEscalation.update).toHaveBeenCalledTimes(1);
  });

  it("does not escalate when the worker is paused", async () => {
    h.buildSelfAssessment.mockResolvedValue({ ...defaultAssessment(), paused: true });
    const prisma = makePrisma(null);
    const r = await runEscalationCheckIfDue(prisma as never, { force: true });
    expect(r.escalated).toBe(false);
    expect(h.sendEmail).not.toHaveBeenCalled();
  });
});
