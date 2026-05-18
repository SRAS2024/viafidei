import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  sendBiweeklyMock,
  sendMonthlyArchiveMock,
  sendMonthlyErrorReportMock,
  sendThresholdMock,
  sendCriticalFailureMock,
  sendSecurityBreachMock,
  requireAdminMock,
  isEmailConfiguredMock,
  writeAuditMock,
} = vi.hoisted(() => ({
  sendBiweeklyMock: vi.fn(),
  sendMonthlyArchiveMock: vi.fn(),
  sendMonthlyErrorReportMock: vi.fn(),
  sendThresholdMock: vi.fn(),
  sendCriticalFailureMock: vi.fn(),
  sendSecurityBreachMock: vi.fn(),
  requireAdminMock: vi.fn(),
  isEmailConfiguredMock: vi.fn(),
  writeAuditMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: requireAdminMock,
}));

// Banned-device + security-events are exercised in their own test
// suites; here we stub them so the unified gate is a no-op for the
// admin checks and the email-admin-test route's behavior under test
// is unaffected by gate side effects.
vi.mock("@/lib/security/security-event-store", () => ({
  isDeviceBanned: vi.fn().mockResolvedValue(false),
  recordBannedDeviceHit: vi.fn(),
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: vi.fn(),
  reportSuspiciousActivity: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAudit: writeAuditMock,
}));

vi.mock("@/lib/email/resend", () => ({
  isEmailConfigured: isEmailConfiguredMock,
}));

vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    ...actual,
    sendBiweeklyAdminReport: sendBiweeklyMock,
    sendMonthlyArchiveCleanupReport: sendMonthlyArchiveMock,
    sendMonthlyErrorReport: sendMonthlyErrorReportMock,
    sendThresholdMilestoneAlert: sendThresholdMock,
    sendCriticalFailureAlert: sendCriticalFailureMock,
    sendSecurityBreachAlert: sendSecurityBreachMock,
  };
});

import { GET, POST } from "@/app/api/admin/email/admin-test/route";

beforeEach(() => {
  sendBiweeklyMock.mockReset();
  sendMonthlyArchiveMock.mockReset();
  sendMonthlyErrorReportMock.mockReset();
  sendThresholdMock.mockReset();
  sendCriticalFailureMock.mockReset();
  sendSecurityBreachMock.mockReset();
  requireAdminMock.mockReset();
  isEmailConfiguredMock.mockReset();
  writeAuditMock.mockReset();
  sendBiweeklyMock.mockResolvedValue({ ok: true, delivery: "sent" });
  sendMonthlyArchiveMock.mockResolvedValue({ ok: true, delivery: "sent" });
  sendMonthlyErrorReportMock.mockResolvedValue({ ok: true, delivery: "sent" });
  sendThresholdMock.mockResolvedValue({ ok: true, delivery: "sent" });
  sendCriticalFailureMock.mockResolvedValue({ ok: true, delivery: "sent" });
  sendSecurityBreachMock.mockResolvedValue({ ok: true, delivery: "sent" });
  requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
  isEmailConfiguredMock.mockReturnValue(true);
  writeAuditMock.mockResolvedValue(undefined);
  process.env.ADMIN_EMAIL = "ops@example.com";
});

afterEach(() => {
  delete process.env.ADMIN_EMAIL;
});

function makeRequest(body: unknown): NextRequest {
  // Same-origin Origin header so the unified admin gate's CSRF check
  // passes for these unit tests; banned-device + security-event mocks
  // are added below so the gate's other steps are no-ops.
  return new NextRequest("http://localhost/api/admin/email/admin-test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost",
      "x-forwarded-host": "localhost",
      "x-forwarded-proto": "http",
    },
    body: JSON.stringify(body),
  });
}

describe("GET /api/admin/email/admin-test", () => {
  it("returns 401 when not admin", async () => {
    requireAdminMock.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("reports configuration status when admin", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.adminEmail).toBe("ops@example.com");
    expect(body.resendConfigured).toBe(true);
    expect(Array.isArray(body.flows)).toBe(true);
    expect(body.flows).toContain("biweekly_report");
    expect(body.flows).toContain("monthly_error_report");
    expect(body.flows).toContain("critical_failure");
    expect(body.flows).toContain("security_breach");
  });
});

describe("POST /api/admin/email/admin-test", () => {
  it("returns 401 when not admin", async () => {
    requireAdminMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ flow: "biweekly_report" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when the flow name is missing or unknown", async () => {
    const res = await POST(makeRequest({ flow: "not-a-real-flow" }));
    expect(res.status).toBe(400);
  });

  it("dispatches the biweekly report and writes an audit entry", async () => {
    const res = await POST(makeRequest({ flow: "biweekly_report" }));
    expect(res.status).toBe(200);
    expect(sendBiweeklyMock).toHaveBeenCalledTimes(1);
    expect(writeAuditMock).toHaveBeenCalledTimes(1);
    expect(writeAuditMock.mock.calls[0][0]).toMatchObject({
      action: "admin.email.admin_test",
      entityId: "biweekly_report",
    });
    const body = await res.json();
    expect(body.flow).toBe("biweekly_report");
    expect(body.adminEmail).toBe("ops@example.com");
  });

  it("dispatches monthly_archive_cleanup", async () => {
    await POST(makeRequest({ flow: "monthly_archive_cleanup" }));
    expect(sendMonthlyArchiveMock).toHaveBeenCalledTimes(1);
  });

  it("dispatches monthly_error_report with a PDF attachment", async () => {
    await POST(makeRequest({ flow: "monthly_error_report" }));
    expect(sendMonthlyErrorReportMock).toHaveBeenCalledTimes(1);
    const call = sendMonthlyErrorReportMock.mock.calls[0][0];
    expect(call.pdfBase64).toBeDefined();
    expect(typeof call.pdfBase64).toBe("string");
    expect(Buffer.from(call.pdfBase64, "base64").toString("binary")).toContain("%PDF-1.4");
  });

  it("dispatches each threshold milestone", async () => {
    await POST(makeRequest({ flow: "milestone_25" }));
    await POST(makeRequest({ flow: "milestone_50" }));
    await POST(makeRequest({ flow: "milestone_75" }));
    await POST(makeRequest({ flow: "milestone_final" }));
    expect(sendThresholdMock).toHaveBeenCalledTimes(4);
    const thresholds = sendThresholdMock.mock.calls.map((c) => c[0].threshold);
    expect(thresholds).toEqual([25, 50, 75, 100]);
  });

  it("dispatches critical_failure", async () => {
    await POST(makeRequest({ flow: "critical_failure" }));
    expect(sendCriticalFailureMock).toHaveBeenCalledTimes(1);
  });

  it("dispatches security_breach", async () => {
    await POST(makeRequest({ flow: "security_breach" }));
    expect(sendSecurityBreachMock).toHaveBeenCalledTimes(1);
  });

  it("returns skipped without calling Resend when ADMIN_EMAIL is unset", async () => {
    delete process.env.ADMIN_EMAIL;
    const res = await POST(makeRequest({ flow: "biweekly_report" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.delivery).toBe("skipped");
    expect(body.reason).toBe("admin_email_not_set");
    expect(sendBiweeklyMock).not.toHaveBeenCalled();
  });

  it("returns skipped when RESEND_API_KEY is unconfigured", async () => {
    isEmailConfiguredMock.mockReturnValueOnce(false);
    const res = await POST(makeRequest({ flow: "biweekly_report" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.delivery).toBe("skipped");
    expect(body.reason).toBe("email_not_configured");
    expect(sendBiweeklyMock).not.toHaveBeenCalled();
  });
});
