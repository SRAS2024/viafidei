import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendTransactionalMock } = vi.hoisted(() => ({
  sendTransactionalMock: vi.fn(),
}));

vi.mock("@/lib/email/resend", () => ({
  sendTransactionalEmail: sendTransactionalMock,
  isEmailConfigured: () => true,
  readResendApiKey: () => "test_key",
}));

import { sendAdminLoginAlert } from "@/lib/email/admin-send";

type SentEmail = { to: string; subject: string; htmlBody: string; textBody: string };

function lastEmail(): SentEmail {
  return sendTransactionalMock.mock.calls[0][0] as SentEmail;
}

beforeEach(() => {
  sendTransactionalMock.mockReset();
  sendTransactionalMock.mockResolvedValue({ ok: true, delivery: "sent" });
  process.env.ADMIN_EMAIL = "ops@example.com";
});

afterEach(() => {
  delete process.env.ADMIN_EMAIL;
});

describe("sendAdminLoginAlert — Admin Log In email", () => {
  it("sends with the exact subject 'Admin Log In' and addresses the recipient as Admin", async () => {
    const result = await sendAdminLoginAlert({
      username: "admin",
      deviceSeenBefore: false,
      successful: true,
    });
    expect(result.ok).toBe(true);
    expect(sendTransactionalMock).toHaveBeenCalledOnce();
    const email = lastEmail();
    expect(email.subject).toBe("Admin Log In");
    expect(email.htmlBody).toContain("Admin,");
  });

  it("includes the login timestamp", async () => {
    const loginAt = new Date("2026-05-21T08:30:00.000Z");
    await sendAdminLoginAlert({
      username: "admin",
      loginAt,
      deviceSeenBefore: true,
      successful: true,
    });
    expect(lastEmail().htmlBody).toContain("2026-05-21T08:30:00.000Z");
  });

  it("includes device details when available", async () => {
    await sendAdminLoginAlert({
      username: "admin",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/124",
      browser: "Chrome",
      operatingSystem: "Windows",
      deviceSeenBefore: true,
      successful: true,
    });
    const email = lastEmail();
    expect(email.htmlBody).toContain("Chrome");
    expect(email.htmlBody).toContain("Windows");
  });

  it("shows 'Device details unavailable' when device details are missing", async () => {
    await sendAdminLoginAlert({ username: "admin", deviceSeenBefore: false, successful: true });
    expect(lastEmail().htmlBody).toContain("Device details unavailable");
  });

  it("includes location when available", async () => {
    await sendAdminLoginAlert({
      username: "admin",
      city: "Springfield",
      region: "Illinois",
      country: "United States",
      deviceSeenBefore: true,
      successful: true,
    });
    const email = lastEmail();
    expect(email.htmlBody).toContain("Springfield");
    expect(email.htmlBody).toContain("Illinois");
    expect(email.htmlBody).toContain("United States");
  });

  it("shows 'Location unavailable' when location is missing", async () => {
    await sendAdminLoginAlert({ username: "admin", deviceSeenBefore: false, successful: true });
    expect(lastEmail().htmlBody).toContain("Location unavailable");
  });

  it("reports whether the device has been seen before", async () => {
    await sendAdminLoginAlert({ username: "admin", deviceSeenBefore: true, successful: true });
    expect(lastEmail().htmlBody).toMatch(/seen before|signed in before/i);
  });

  it("uses the current shared admin email design", async () => {
    await sendAdminLoginAlert({ username: "admin", deviceSeenBefore: false, successful: true });
    const email = lastEmail();
    // The renderAdminEmail shell stamps these markers on every admin email.
    expect(email.htmlBody).toContain("operational notification");
    expect(email.htmlBody).toContain("— Admin");
  });

  it("never carries a Suspicious Activity / Security Breach subject", async () => {
    await sendAdminLoginAlert({ username: "admin", deviceSeenBefore: false, successful: true });
    const email = lastEmail();
    expect(email.subject).not.toBe("Suspicious Activity");
    expect(email.subject).not.toBe("Security Breach");
  });
});
