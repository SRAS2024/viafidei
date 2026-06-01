/**
 * admin-worker:proof:reports
 *
 * Proves the reporting subsystem (spec §445-486):
 *   1. Developer Audit generates
 *   2. Developer Audit includes the required sections (incl. the new
 *      Rejected Alternatives + Reasoning Graph sections)
 *   3. secrets are redacted
 *   4. command center diagnostics are populated
 *   5. "why no content growth" appears when growth is blocked
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/diagnostics", () => ({
  runAdminWorkerDiagnostics: vi.fn(async () => [
    { name: "brain", score: 0.9, status: "pass", summary: "ok" },
    { name: "dispatcher", score: 0.88, status: "pass", summary: "ok" },
  ]),
  summarizeRatings: vi.fn(() => ({ pass: 2, warn: 0, fail: 0 })),
}));

vi.mock("@/lib/admin-worker/passes", () => ({
  listRecentPasses: vi.fn(async () => []),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  listAdminWorkerLogs: vi.fn(async () => []),
}));

import {
  collectDeveloperAuditData,
  redactSecrets,
  DEVELOPER_AUDIT_SECTIONS,
} from "@/lib/admin-worker/report-generator";
import { diagnoseWhyNoGrowth } from "@/lib/admin-worker/why-no-growth";
import { loadCommandCenterMetrics } from "@/lib/admin-worker/metrics";

/** Proxy prisma returning safe defaults for any model/method. */
function proxyPrisma(overrides: Record<string, Record<string, unknown>> = {}) {
  const defaultModel = () => ({
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => null),
    findUnique: vi.fn(async () => null),
    count: vi.fn(async () => 0),
    groupBy: vi.fn(async () => []),
    aggregate: vi.fn(async () => ({})),
    create: vi.fn(async () => ({ id: "x" })),
    update: vi.fn(async () => ({ id: "x" })),
    upsert: vi.fn(async () => ({ id: "x" })),
  });
  return new Proxy(
    {},
    {
      get(_t, prop: string) {
        // Merge any override onto the full default model so a partial
        // override never drops a method the caller relies on.
        if (prop in overrides) return { ...defaultModel(), ...overrides[prop] };
        return defaultModel();
      },
    },
  ) as never;
}

describe("admin-worker:proof:reports", () => {
  it("1. Developer Audit generates", async () => {
    const data = await collectDeveloperAuditData(proxyPrisma(), "LAST_7_DAYS");
    expect(data.generatedAt).toBeInstanceOf(Date);
    expect(data.period).toBe("LAST_7_DAYS");
    expect(Array.isArray(data.diagnosticsResults)).toBe(true);
  });

  it("2. Developer Audit includes the required sections", () => {
    const required = [
      "Table of Contents",
      "Executive Summary",
      "Admin Worker Brain Decisions",
      "Rejected Alternatives",
      "Reasoning Graph",
      "Pipeline Stage History",
      "Content Goal Progress",
      "Source Coverage",
      "Strict QA Logs",
      "Quality Score Logs",
      "Publishing Logs",
      "Post-Publish Verification Logs",
      "Repair Logs",
      "Security Logs",
      "Source Reputation Changes",
      "Memory Changes",
      "Why No Content Growth",
      "Current Blockers",
    ] as const;
    for (const section of required) {
      expect(DEVELOPER_AUDIT_SECTIONS).toContain(section);
    }
  });

  it("2b. audit data carries the reasoning graph + rejected alternatives", async () => {
    const data = await collectDeveloperAuditData(proxyPrisma(), "LAST_7_DAYS");
    expect(Array.isArray(data.reasoningGraph)).toBe(true);
    expect(Array.isArray(data.rejectedAlternatives)).toBe(true);
    expect(data).toHaveProperty("whyNoGrowth");
  });

  it("3. secrets are redacted, useful debugging fields kept", () => {
    const redacted = redactSecrets({
      DATABASE_URL: "postgresql://user:pw@host/db",
      session_secret: "supersecret",
      apiKey: "abc123",
      contentType: "PRAYER",
      slug: "the-memorare",
      finalScore: 0.92,
    }) as Record<string, unknown>;
    expect(redacted.DATABASE_URL).toBe("[REDACTED]");
    expect(redacted.session_secret).toBe("[REDACTED]");
    expect(redacted.apiKey).toBe("[REDACTED]");
    // Useful, non-secret debugging fields stay visible (spec §486).
    expect(redacted.contentType).toBe("PRAYER");
    expect(redacted.slug).toBe("the-memorare");
    expect(redacted.finalScore).toBe(0.92);
  });

  it("4. command center diagnostics are populated", async () => {
    const metrics = await loadCommandCenterMetrics(proxyPrisma());
    expect(metrics).toHaveProperty("publishRate30d");
    expect(metrics).toHaveProperty("qaPassRate30d");
    expect(metrics).toHaveProperty("reviewQueueCount");
    expect(typeof metrics.publishRate30d).toBe("number");
  });

  it("5. why-no-content-growth surfaces a blocker when growth is blocked", async () => {
    // A world with content goals but zero candidates is blocked at
    // discovery — the diagnostic must name a non-NONE blocker.
    const prisma = proxyPrisma({
      contentGoal: {
        findMany: vi.fn(async () => [
          {
            contentType: "PRAYER",
            minimumTarget: 50,
            currentValidCount: 0,
            gapCount: 50,
            status: "IN_PROGRESS",
          },
        ]),
        count: vi.fn(async () => 1),
      },
      candidateSourceUrl: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    });
    const report = await diagnoseWhyNoGrowth(prisma);
    expect(report.blocker).not.toBe("NONE");
    expect(report.blockerExplanation.length).toBeGreaterThan(0);
    expect(Array.isArray(report.checks)).toBe(true);
  });
});
