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

  it("does NOT resolve open escalations via the empty-warning path when offline", async () => {
    // Offline assessment → empty warnings for a NON-cleared reason. Resolving on
    // it would wrongly close still-open issues and cause a duplicate email on
    // recovery. The cleared-path must be gated. (The signal-based
    // superseded-by-upgrade path is separate and here leaves the row alone
    // because it is stamped with the CURRENT build sha.)
    h.buildSelfAssessment.mockResolvedValue({
      ...defaultAssessment(),
      workerLive: false,
      warnings: [],
    });
    const prisma = makePrisma(null);
    // A stuck LOOPING escalation on the current build — the cleared-path WOULD
    // resolve it (LOOPING not in the empty warning set) if the offline gate were
    // broken; the superseded-path won't (same sha).
    prisma.adminWorkerEscalation.findMany = vi.fn(async () => [
      { id: "e1", kind: "LOOPING", versionSha: "abc123" },
    ]);
    const r = await runEscalationCheckIfDue(prisma as never, { force: true });
    expect(r.resolved).toBe(0);
    expect(prisma.adminWorkerEscalation.update).not.toHaveBeenCalled();
  });

  it("does NOT resolve open escalations via the empty-warning path when paused", async () => {
    h.buildSelfAssessment.mockResolvedValue({
      ...defaultAssessment(),
      paused: true,
      warnings: [],
    });
    const prisma = makePrisma(null);
    prisma.adminWorkerEscalation.findMany = vi.fn(async () => [
      { id: "e1", kind: "LOOPING", versionSha: "abc123" },
    ]);
    const r = await runEscalationCheckIfDue(prisma as never, { force: true });
    expect(r.resolved).toBe(0);
    expect(prisma.adminWorkerEscalation.update).not.toHaveBeenCalled();
  });

  it("clears a stale emailSentAt when a reopened escalation's re-send is skipped (retries next time)", async () => {
    // A previously-emailed issue was resolved (resolvedAt set, stale emailSentAt).
    // It recurs; the re-send is skipped (no ADMIN_EMAIL). The reopened row MUST
    // NOT keep the stale emailSentAt, or it would be treated as already-notified
    // and never retried.
    h.sendEmail.mockResolvedValue({ ok: true, delivery: "skipped" });
    let upsertArg: { update?: { emailSentAt?: unknown; resolvedAt?: unknown } } = {};
    const prisma = makePrisma({
      resolvedAt: new Date(0),
      emailSentAt: new Date(0),
      occurrences: 1,
    });
    prisma.adminWorkerEscalation.upsert = vi.fn(async (arg: unknown) => {
      upsertArg = arg as typeof upsertArg;
      return {};
    });
    const r = await runEscalationCheckIfDue(prisma as never, { force: true });
    expect(r.escalated).toBe(true);
    expect(r.deduped).toBe(false); // resolved row → not deduped, re-attempts send
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
    expect(r.emailed).toBe(false); // skipped, not sent
    expect(upsertArg.update?.resolvedAt).toBeNull();
    expect(upsertArg.update?.emailSentAt).toBeNull(); // stale timestamp cleared
  });
});

/**
 * Code-update awareness: the escalation system must recognise when a fix has
 * shipped. (1) A newer build resolves prior-build escalations (they may be
 * fixed; if not, they re-escalate under the new sha via the fingerprint). (2) A
 * would-be escalation is HELD for a grace window right after an upgrade, because
 * the windowed signal still contains pre-upgrade activity and can't yet tell a
 * shipped fix from a still-broken issue.
 */
describe("runEscalationCheckIfDue — code-update awareness", () => {
  it("resolves prior-build open escalations once a newer build ships", async () => {
    h.getVersionContext.mockResolvedValue({
      current: {
        label: "admin-worker/new",
        sha: "newsha",
        capturedAt: new Date(0),
        changedSummary: "Upgrade: commit old → new.",
      },
      previous: { label: "admin-worker/old", sha: "oldsha", capturedAt: new Date(0) },
      upgradedRecently: false,
      recentUpgradeSummary: null,
    });
    // Paused → the empty-warning cleared-path is gated off, isolating the
    // signal-based superseded-by-upgrade path under test.
    h.buildSelfAssessment.mockResolvedValue({ ...defaultAssessment(), paused: true, warnings: [] });
    const prisma = makePrisma(null);
    const updates: Array<{ where: { id: string }; data: { resolvedReason?: string } }> = [];
    prisma.adminWorkerEscalation.findMany = vi.fn(async () => [
      { id: "old1", kind: "EXTRACTING_WITHOUT_PUBLISHING", versionSha: "oldsha" }, // prior build → resolve
      { id: "cur1", kind: "LOOPING", versionSha: "newsha" }, // current build → keep
      { id: "nul1", kind: "NO_VALUE", versionSha: null }, // unknown build → keep
    ]);
    prisma.adminWorkerEscalation.update = vi.fn(async (arg: unknown) => {
      updates.push(arg as (typeof updates)[number]);
      return {};
    });
    const r = await runEscalationCheckIfDue(prisma as never, { force: true });
    expect(r.resolved).toBe(1);
    expect(updates.map((u) => u.where.id)).toEqual(["old1"]);
    expect(updates[0].data.resolvedReason).toBe("superseded_by_upgrade");
  });

  it("defers a would-be escalation while a fresh upgrade proves out (in-window)", async () => {
    h.getVersionContext.mockResolvedValue({
      current: {
        label: "admin-worker/new",
        sha: "newsha",
        capturedAt: new Date(), // just now → inside the 6h assessment window
        changedSummary: "Upgrade: fix shipped.",
      },
      previous: { label: "admin-worker/old", sha: "oldsha", capturedAt: new Date(0) },
      upgradedRecently: true,
      recentUpgradeSummary: "Upgrade: fix shipped.",
    });
    const prisma = makePrisma(null); // default assessment: EXTRACTING_WITHOUT_PUBLISHING (ERROR)
    const r = await runEscalationCheckIfDue(prisma as never, { force: true });
    expect(r.escalated).toBe(true); // governance still says escalate…
    expect(r.deferredForUpgrade).toBe(true); // …but paging is held for the fix
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(prisma.adminWorkerEscalation.upsert).not.toHaveBeenCalled();
  });

  it("escalates for real once the window fully post-dates the upgrade", async () => {
    h.getVersionContext.mockResolvedValue({
      current: {
        label: "admin-worker/new",
        sha: "newsha",
        capturedAt: new Date(Date.now() - 7 * 60 * 60 * 1000), // 7h ago > 6h window
        changedSummary: "Upgrade: commit old → new.",
      },
      previous: {
        label: "admin-worker/old",
        sha: "oldsha",
        capturedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
      upgradedRecently: false,
      recentUpgradeSummary: null,
    });
    const prisma = makePrisma(null);
    const r = await runEscalationCheckIfDue(prisma as never, { force: true });
    expect(r.deferredForUpgrade).toBe(false);
    expect(r.escalated).toBe(true);
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
  });
});
