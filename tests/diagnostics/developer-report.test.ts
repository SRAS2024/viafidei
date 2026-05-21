import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import type { SystemHealthReport } from "@/lib/diagnostics/system-health";
import type { DiagnosticSnapshotRecord } from "@/lib/diagnostics/diagnostic-snapshot";
import type { LogSection } from "@/lib/diagnostics/system-log-sources";
import type { AdminActionLogRecord } from "@/lib/audit/admin-action-log";

const writeSnapshotsMock = vi.fn();
const readSnapshotsMock = vi.fn();
const earliestSnapshotMock = vi.fn();
const loadSystemHealthMock = vi.fn();
const collectSystemLogsMock = vi.fn();
const readAdminActionsMock = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

vi.mock("@/lib/diagnostics/system-health", async (orig) => {
  const actual = await orig<typeof import("@/lib/diagnostics/system-health")>();
  return { ...actual, loadSystemHealth: (...a: unknown[]) => loadSystemHealthMock(...a) };
});

vi.mock("@/lib/diagnostics/diagnostic-snapshot", async (orig) => {
  const actual = await orig<typeof import("@/lib/diagnostics/diagnostic-snapshot")>();
  return {
    ...actual,
    writeDiagnosticSnapshots: (...a: unknown[]) => writeSnapshotsMock(...a),
    readDiagnosticSnapshotsInRange: (...a: unknown[]) => readSnapshotsMock(...a),
    earliestDiagnosticSnapshotAt: (...a: unknown[]) => earliestSnapshotMock(...a),
  };
});

vi.mock("@/lib/diagnostics/system-log-sources", async (orig) => {
  const actual = await orig<typeof import("@/lib/diagnostics/system-log-sources")>();
  return { ...actual, collectSystemLogs: (...a: unknown[]) => collectSystemLogsMock(...a) };
});

vi.mock("@/lib/audit/admin-action-log", async (orig) => {
  const actual = await orig<typeof import("@/lib/audit/admin-action-log")>();
  return { ...actual, readAdminActionLogsInRange: (...a: unknown[]) => readAdminActionsMock(...a) };
});

import {
  generateDeveloperReport,
  listAvailableReportMonths,
  resolveReportPeriod,
} from "@/lib/diagnostics/developer-report";

function fakeHealth(): SystemHealthReport {
  return {
    overallSeverity: "warn",
    ranAt: new Date().toISOString(),
    cards: [
      {
        id: "queue",
        label: "Queue health",
        severity: "warn",
        lastUpdatedAt: new Date().toISOString(),
        dataSource: "IngestionJobQueue",
        summary: "pending=2 failed=1",
        details: { pending: 2, failed: 1 },
      },
    ],
  };
}

function fakeSnapshots(): DiagnosticSnapshotRecord[] {
  const createdAt = new Date();
  return [
    {
      id: "snap-overall",
      diagnosticKey: "overall",
      diagnosticName: "Overall health",
      status: "warn",
      summary: "1 diagnostics — 0 failing, 1 warning, 0 healthy.",
      dataSource: "System Health aggregate",
      detailsJson: { warnings: 1 },
      suggestedAction: "Review the failing and warning diagnostics.",
      createdAt,
    },
    {
      id: "snap-queue",
      diagnosticKey: "queue",
      diagnosticName: "Queue health",
      status: "warn",
      summary: "pending=2 failed=1",
      dataSource: "IngestionJobQueue",
      detailsJson: { pending: 2, failed: 1, errorMessage: null },
      suggestedAction: "Inspect IngestionJobQueue for failed jobs.",
      createdAt,
    },
  ];
}

function fakeLogSections(): LogSection[] {
  return [
    {
      key: "security",
      name: "Security event logs",
      entries: [
        {
          timestamp: new Date(),
          severity: "error",
          event: "admin_login_failed",
          summary: "failed sign-in",
          entityId: "evt-1",
          errorMessage: "db connect failed at postgres://app:secretpw@db/app",
          metadata: { apiKey: "PLANTEDSECRETTOKEN999", route: "/api/admin/login" },
        },
      ],
    },
    { key: "cache_health", name: "Cache health logs", entries: [] },
  ];
}

function fakeAdminActions(): AdminActionLogRecord[] {
  return [
    {
      id: "act-1",
      adminUserId: null,
      adminUsername: "admin",
      actionType: "diagnostics_run",
      route: "/admin/diagnostics",
      method: "GET",
      result: "success",
      deviceFingerprint: "fp",
      ipHash: "iph",
      userAgentHash: "uah",
      city: null,
      region: null,
      country: null,
      createdAt: new Date(),
      metadataJson: null,
    },
  ];
}

function pdfText(buffer: Buffer): string {
  return buffer.toString("latin1");
}

beforeEach(() => {
  resetPrismaMock();
  writeSnapshotsMock.mockReset().mockResolvedValue(fakeHealth());
  readSnapshotsMock.mockReset().mockResolvedValue(fakeSnapshots());
  earliestSnapshotMock.mockReset().mockResolvedValue(null);
  loadSystemHealthMock.mockReset().mockResolvedValue(fakeHealth());
  collectSystemLogsMock.mockReset().mockResolvedValue(fakeLogSections());
  readAdminActionsMock.mockReset().mockResolvedValue(fakeAdminActions());
});

describe("resolveReportPeriod", () => {
  const now = new Date("2026-05-21T12:00:00.000Z");

  it("resolves Last 24 Hours", () => {
    const period = resolveReportPeriod({ period: "last-24-hours" }, now);
    expect(period.label).toBe("Last 24 Hours");
    expect(period.fileSlug).toBe("last-24-hours");
    expect(period.endAt.getTime() - period.startAt.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("resolves Last 7 Days", () => {
    const period = resolveReportPeriod({ period: "last-7-days" }, now);
    expect(period.label).toBe("Last 7 Days");
    expect(period.fileSlug).toBe("last-7-days");
    expect(period.endAt.getTime() - period.startAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("resolves a selected month", () => {
    const period = resolveReportPeriod({ period: "month", month: "2026-03" }, now);
    expect(period.label).toBe("March 2026");
    expect(period.fileSlug).toBe("2026-03");
    expect(period.startAt.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(period.endAt.toISOString()).toBe("2026-03-31T23:59:59.999Z");
  });

  it("rejects a malformed month", () => {
    expect(() => resolveReportPeriod({ period: "month", month: "nope" }, now)).toThrow();
  });
});

describe("generateDeveloperReport", () => {
  it("generates a Developer Audit PDF with the expected file name", async () => {
    const result = await generateDeveloperReport({
      period: "last-24-hours",
      adminUsername: "admin",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fileName).toBe("developer-audit-last-24-hours.pdf");
    expect(result.fileSize).toBeGreaterThan(0);
    expect(pdfText(result.pdf).startsWith("%PDF-1.")).toBe(true);
  });

  it("uses the month file name for a month report", async () => {
    const result = await generateDeveloperReport({
      period: "month",
      month: "2026-05",
      adminUsername: "admin",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fileName).toBe("developer-audit-2026-05.pdf");
  });

  it("titles the PDF 'Developer Audit' and includes a table of contents", async () => {
    const result = await generateDeveloperReport({ period: "last-7-days", adminUsername: "admin" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const text = pdfText(result.pdf);
    expect(text).toContain("Developer Audit");
    expect(text).toContain("Table of Contents");
  });

  it("includes the Diagnostics Results and System Logs sections", async () => {
    const result = await generateDeveloperReport({
      period: "last-24-hours",
      adminUsername: "admin",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const text = pdfText(result.pdf);
    expect(text).toContain("Summary");
    expect(text).toContain("Diagnostics Results");
    expect(text).toContain("System Logs");
    expect(text).toContain("Admin Navigation and Actions");
    expect(text).toContain("Queue health");
  });

  it("includes empty log subsections marked as having no logs", async () => {
    const result = await generateDeveloperReport({
      period: "last-24-hours",
      adminUsername: "admin",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const text = pdfText(result.pdf);
    expect(text).toContain("Cache health logs");
    expect(text).toContain("No logs found for this period");
  });

  it("redacts secrets before the PDF is generated", async () => {
    const result = await generateDeveloperReport({
      period: "last-24-hours",
      adminUsername: "admin",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const text = pdfText(result.pdf);
    expect(text).not.toContain("PLANTEDSECRETTOKEN999");
    expect(text).not.toContain("secretpw");
    expect(text).toContain("redacted");
  });

  it("scopes log collection to the selected time period", async () => {
    await generateDeveloperReport({ period: "last-24-hours", adminUsername: "admin" });
    expect(collectSystemLogsMock).toHaveBeenCalledTimes(1);
    const [startAt, endAt] = collectSystemLogsMock.mock.calls[0] as [Date, Date];
    expect(endAt.getTime() - startAt.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("includes only the logs the period-scoped collector returns", async () => {
    // The collector contract is "given start/end, return in-range rows".
    // Honour it in the mock and confirm the report reflects it.
    collectSystemLogsMock.mockImplementation(async (startAt: Date, endAt: Date) => {
      const inRange = new Date((startAt.getTime() + endAt.getTime()) / 2);
      const outOfRange = new Date(startAt.getTime() - 60 * 60 * 1000);
      const all = [
        { ts: inRange, event: "INRANGE_EVENT" },
        { ts: outOfRange, event: "OUTOFRANGE_EVENT" },
      ];
      return [
        {
          key: "security",
          name: "Security event logs",
          entries: all
            .filter((e) => e.ts >= startAt && e.ts <= endAt)
            .map((e) => ({
              timestamp: e.ts,
              severity: "info",
              event: e.event,
              summary: "entry",
            })),
        },
      ] satisfies LogSection[];
    });
    const result = await generateDeveloperReport({
      period: "last-24-hours",
      adminUsername: "admin",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const text = pdfText(result.pdf);
    expect(text).toContain("INRANGE_EVENT");
    expect(text).not.toContain("OUTOFRANGE_EVENT");
  });

  it("returns an error naming the failed source when generation fails", async () => {
    writeSnapshotsMock.mockResolvedValue(null);
    loadSystemHealthMock.mockRejectedValue(new Error("diagnostics offline"));
    const result = await generateDeveloperReport({
      period: "last-24-hours",
      adminUsername: "admin",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failedSource).toBe("Diagnostics Results");
  });
});

describe("listAvailableReportMonths", () => {
  it("returns months back to the earliest recorded data", async () => {
    const now = new Date("2026-05-15T00:00:00.000Z");
    earliestSnapshotMock.mockResolvedValue(new Date("2026-03-02T00:00:00.000Z"));
    prismaMock.adminActionLog.findFirst.mockResolvedValue(null);
    prismaMock.securityEvent.findFirst.mockResolvedValue(null);
    prismaMock.queueAuditLog.findFirst.mockResolvedValue(null);
    const months = await listAvailableReportMonths(now);
    expect(months.map((m) => m.value)).toEqual(["2026-05", "2026-04", "2026-03"]);
    expect(months[0].label).toBe("May 2026");
  });
});
