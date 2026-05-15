import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendTransactionalMock } = vi.hoisted(() => ({
  sendTransactionalMock: vi.fn(),
}));

vi.mock("@/lib/email/resend", () => ({
  sendTransactionalEmail: sendTransactionalMock,
  isEmailConfigured: () => true,
  readResendApiKey: () => "test_key",
}));

import {
  sendBiweeklyAdminReport,
  sendCriticalFailureAlert,
  sendMonthlyArchiveCleanupReport,
  sendMonthlyErrorReport,
  sendSecurityBreachAlert,
  sendThresholdMilestoneAlert,
} from "@/lib/email/admin-send";

beforeEach(() => {
  sendTransactionalMock.mockReset();
  sendTransactionalMock.mockResolvedValue({ ok: true, delivery: "sent" });
  process.env.ADMIN_EMAIL = "ops@example.com";
});

afterEach(() => {
  delete process.env.ADMIN_EMAIL;
});

describe("sendBiweeklyAdminReport", () => {
  it("sends with the exact required subject and addresses Admin", async () => {
    const result = await sendBiweeklyAdminReport(
      {
        Prayer: { added: 7, edited: 1, deleted: 0, archived: 2 },
      },
      new Date("2026-05-01T00:00:00Z"),
      new Date("2026-05-15T00:00:00Z"),
    );
    expect(result.ok).toBe(true);
    expect(sendTransactionalMock).toHaveBeenCalledOnce();
    const call = sendTransactionalMock.mock.calls[0][0];
    expect(call.to).toBe("ops@example.com");
    expect(call.subject).toBe("Biweekly Admin Report");
    expect(call.htmlBody).toContain("Admin,");
    expect(call.htmlBody).toContain("Content Management Report");
    expect(call.htmlBody).toContain("Prayer");
    expect(call.htmlBody).toContain("+7");
    // archived = 2 → plain "2", not signed
    expect(call.htmlBody).toContain(">2<");
  });

  it("renders zero counts as plain '0' (no leading sign) for unset content types", async () => {
    await sendBiweeklyAdminReport(
      {},
      new Date("2026-05-01T00:00:00Z"),
      new Date("2026-05-15T00:00:00Z"),
    );
    const call = sendTransactionalMock.mock.calls[0][0];
    // Every content type should appear with '0' for added/deleted/etc.
    expect(call.htmlBody).toContain("Saint");
    // Locate the table portion of the text body and assert no signed
    // zero appears in any cell — substrings outside the table (date
    // ranges, CSS) are excluded.
    const tableLines = call.textBody
      .split("\n")
      .filter((line: string) => /^\w/.test(line) && /\s+\d+/.test(line));
    expect(tableLines.length).toBeGreaterThan(0);
    for (const line of tableLines) {
      expect(line).not.toMatch(/\+0\b/);
      expect(line).not.toMatch(/-0\b/);
    }
  });
});

describe("sendMonthlyArchiveCleanupReport", () => {
  it("uses the exact required subject and -N formatting for purges", async () => {
    await sendMonthlyArchiveCleanupReport(
      { Prayer: 5, Saint: 0 },
      new Date("2026-04-01T00:00:00Z"),
      new Date("2026-05-01T00:00:00Z"),
    );
    const call = sendTransactionalMock.mock.calls[0][0];
    expect(call.subject).toBe("Monthly Archive Cleaning Up");
    expect(call.htmlBody).toContain("Admin,");
    expect(call.htmlBody).toContain("Archived Deleted");
    expect(call.htmlBody).toContain("-5");
  });
});

describe("sendThresholdMilestoneAlert", () => {
  it("produces a percent-labelled subject and addresses Admin", async () => {
    await sendThresholdMilestoneAlert({
      contentLabel: "Prayers",
      threshold: 50,
      currentCount: 250,
      target: 500,
    });
    const call = sendTransactionalMock.mock.calls[0][0];
    expect(call.subject).toBe("Prayers 50% Threshold Reached");
    expect(call.htmlBody).toContain("Admin,");
  });

  it("uses 'Final' wording at 100%", async () => {
    await sendThresholdMilestoneAlert({
      contentLabel: "Prayers",
      threshold: 100,
      currentCount: 500,
      target: 500,
    });
    const call = sendTransactionalMock.mock.calls[0][0];
    expect(call.subject).toBe("Prayers Final Threshold Reached");
  });
});

describe("sendCriticalFailureAlert", () => {
  it("uses the exact 'Critical Failure' subject", async () => {
    await sendCriticalFailureAlert({
      kind: "uncaught_exception",
      message: "Database is down",
    });
    const call = sendTransactionalMock.mock.calls[0][0];
    expect(call.subject).toBe("Critical Failure");
    expect(call.htmlBody).toContain("Admin,");
    expect(call.htmlBody).toContain("Database is down");
  });
});

describe("sendSecurityBreachAlert", () => {
  it("uses the exact 'Security Breach' subject", async () => {
    await sendSecurityBreachAlert({
      kind: "client_devtools_open",
      summary: "Browser inspector opened on admin",
    });
    const call = sendTransactionalMock.mock.calls[0][0];
    expect(call.subject).toBe("Security Breach");
    expect(call.htmlBody).toContain("Admin,");
    expect(call.htmlBody).toContain("Browser inspector opened on admin");
  });
});

describe("sendMonthlyErrorReport", () => {
  it("uses 'Error Report' subject and ships a PDF attachment", async () => {
    await sendMonthlyErrorReport({
      monthStart: new Date("2026-04-01T00:00:00Z"),
      monthEnd: new Date("2026-05-01T00:00:00Z"),
      totalErrors: 42,
      pdfBase64: Buffer.from("hello").toString("base64"),
    });
    const call = sendTransactionalMock.mock.calls[0][0];
    expect(call.subject).toBe("Error Report");
    expect(call.htmlBody).toContain("Admin,");
    expect(call.attachments).toHaveLength(1);
    expect(call.attachments[0].filename).toBe("error-report-2026-04.pdf");
    expect(call.attachments[0].contentType).toBe("application/pdf");
  });
});

describe("admin email skip behaviour", () => {
  it("skips silently when ADMIN_EMAIL is unset", async () => {
    delete process.env.ADMIN_EMAIL;
    const result = await sendCriticalFailureAlert({
      kind: "k",
      message: "m",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery).toBe("skipped");
    expect(sendTransactionalMock).not.toHaveBeenCalled();
  });
});
