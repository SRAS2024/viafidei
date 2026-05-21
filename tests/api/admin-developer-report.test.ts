import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const requireAdminMock = vi.fn();
const writeAuditMock = vi.fn().mockResolvedValue(undefined);
const writeAdminActionLogMock = vi.fn().mockResolvedValue("act-1");
const generateDeveloperReportMock = vi.fn();
const reportSuspiciousActivityMock = vi.fn();
const reportSecurityBreachMock = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: (...a: unknown[]) => requireAdminMock(...a),
}));
vi.mock("@/lib/audit", () => ({ writeAudit: (...a: unknown[]) => writeAuditMock(...a) }));
vi.mock("@/lib/audit/admin-action-log", () => ({
  writeAdminActionLog: (...a: unknown[]) => writeAdminActionLogMock(...a),
  ADMIN_ACTION: { developerReport: "developer_audit_report" },
}));
vi.mock("@/lib/security/security-event-store", () => ({
  isDeviceBanned: vi.fn().mockResolvedValue(false),
  recordBannedDeviceHit: vi.fn(),
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSuspiciousActivity: (...a: unknown[]) => reportSuspiciousActivityMock(...a),
  reportSecurityBreach: (...a: unknown[]) => reportSecurityBreachMock(...a),
}));
vi.mock("@/lib/diagnostics/developer-report", () => ({
  generateDeveloperReport: (...a: unknown[]) => generateDeveloperReportMock(...a),
}));

import { POST } from "@/app/api/admin/diagnostics/developer-report/route";

function makeReq(body: unknown): NextRequest {
  const url = "http://localhost/api/admin/diagnostics/developer-report";
  const base = new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      "x-forwarded-host": "localhost",
      "x-forwarded-proto": "http",
    },
    body: JSON.stringify(body),
  });
  return Object.assign(base, {
    cookies: { get: () => ({ value: "device-cred-xyz" }) },
    nextUrl: new URL(url),
  }) as unknown as NextRequest;
}

function okReport() {
  const startAt = new Date("2026-05-20T12:00:00.000Z");
  const endAt = new Date("2026-05-21T12:00:00.000Z");
  return {
    ok: true as const,
    pdf: Buffer.from("%PDF-1.4\nfake developer audit\n%%EOF"),
    fileName: "developer-audit-last-24-hours.pdf",
    fileSize: 33,
    period: {
      type: "last-24-hours" as const,
      label: "Last 24 Hours",
      startAt,
      endAt,
      fileSlug: "last-24-hours",
    },
    generatedAt: endAt,
    stats: {
      overallStatus: "warn",
      failingDiagnostics: 0,
      warningDiagnostics: 1,
      successfulDiagnostics: 13,
      totalLogs: 4,
      highestSeverity: "warn",
      highestSeverityCount: 1,
      mostCommonErrorCategory: "None",
      mostRecentFailure: "None in period",
      mostRecentRecovery: "None in period",
      topRecommendedAction: "No action required.",
    },
  };
}

beforeEach(() => {
  resetPrismaMock();
  requireAdminMock.mockReset();
  writeAdminActionLogMock.mockClear();
  writeAuditMock.mockClear();
  generateDeveloperReportMock.mockReset();
  reportSuspiciousActivityMock.mockClear();
  reportSecurityBreachMock.mockClear();
  requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
  generateDeveloperReportMock.mockResolvedValue(okReport());
});

describe("POST /api/admin/diagnostics/developer-report", () => {
  it("rejects an unauthenticated request and never generates the PDF", async () => {
    requireAdminMock.mockResolvedValue(null);
    const res = await POST(makeReq({ period: "last-24-hours" }));
    expect(res.status).toBe(401);
    expect(generateDeveloperReportMock).not.toHaveBeenCalled();
  });

  it("returns the generated PDF as a downloadable attachment", async () => {
    const res = await POST(makeReq({ period: "last-24-hours" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(
      'attachment; filename="developer-audit-last-24-hours.pdf"',
    );
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.toString("latin1").startsWith("%PDF-1.")).toBe(true);
  });

  it("rejects an invalid period with a 400", async () => {
    const res = await POST(makeReq({ period: "all-time" }));
    expect(res.status).toBe(400);
    expect(generateDeveloperReportMock).not.toHaveBeenCalled();
  });

  it("records an AdminActionLog entry when the report is generated", async () => {
    await POST(makeReq({ period: "last-24-hours" }));
    expect(writeAdminActionLogMock).toHaveBeenCalledTimes(1);
    const arg = writeAdminActionLogMock.mock.calls[0][0] as {
      actionType: string;
      result: string;
    };
    expect(arg.actionType).toBe("developer_audit_report");
    expect(arg.result).toBe("success");
  });

  it("does not raise a suspicious-activity alert for a valid admin", async () => {
    await POST(makeReq({ period: "last-7-days" }));
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();
    expect(reportSecurityBreachMock).not.toHaveBeenCalled();
  });

  it("returns a redacted error naming the failed report source", async () => {
    generateDeveloperReportMock.mockResolvedValue({
      ok: false,
      failedSource: "System Logs",
      message: "query failed for postgres://user:secretpw@db/app",
    });
    const res = await POST(makeReq({ period: "last-24-hours" }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("System Logs");
    expect(body.message).not.toContain("secretpw");
  });
});
