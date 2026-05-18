/**
 * Spec-required fields in Suspicious Activity / Security Breach emails.
 *
 * The spec lists exact field sets:
 *
 *   Suspicious Activity:
 *     Event type, Time, IP address, Device credential ID when
 *     available, User agent, City when available, State or region
 *     when available, Country when available, Attempted account or
 *     route, Recommended automatic action.
 *
 *   Security Breach:
 *     Event type, Severity, Time, IP address, Device credential ID
 *     when available, User agent, City when available, State or
 *     region when available, Country when available, Target route,
 *     Action attempted, Automatic action taken, Ban device link
 *     when available.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

let capturedBody = "";

vi.mock("@/lib/email/resend", () => ({
  isEmailConfigured: () => true,
  readResendApiKey: () => "test-key",
  sendTransactionalEmail: async (input: { textBody: string }) => {
    capturedBody = input.textBody;
    return { ok: true, delivery: "sent" } as const;
  },
}));

import { sendSecurityBreachAlert, sendSuspiciousActivityAlert } from "@/lib/email/admin-send";

beforeEach(() => {
  capturedBody = "";
  process.env.ADMIN_EMAIL = "ops@example.com";
});

describe("Suspicious Activity email — spec-required fields", () => {
  it("includes Event type + Time on every email", async () => {
    await sendSuspiciousActivityAlert({
      kind: "admin_password_failed_repeatedly",
      summary: "4 consecutive failures",
    });
    expect(capturedBody).toMatch(/Event type/);
    expect(capturedBody).toMatch(/admin_password_failed_repeatedly/);
    expect(capturedBody).toMatch(/Time/);
    // Time renders as an ISO timestamp.
    expect(capturedBody).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("includes every optional field when supplied", async () => {
    await sendSuspiciousActivityAlert({
      kind: "admin_route_scan",
      summary: "Sustained probing detected",
      ipAddress: "203.0.113.5",
      deviceCredentialId: "dev-fp-abc",
      userAgent: "Mozilla/5.0",
      city: "Springfield",
      region: "IL",
      country: "US",
      attemptedAccountOrRoute: "/admin/users",
      recommendedAction: "Review the developer's behaviour",
    });
    expect(capturedBody).toMatch(/IP address/);
    expect(capturedBody).toMatch(/203\.0\.113\.5/);
    expect(capturedBody).toMatch(/Device credential/);
    expect(capturedBody).toMatch(/dev-fp-abc/);
    expect(capturedBody).toMatch(/User-Agent/);
    expect(capturedBody).toMatch(/Mozilla\/5\.0/);
    expect(capturedBody).toMatch(/City/);
    expect(capturedBody).toMatch(/Springfield/);
    expect(capturedBody).toMatch(/Region/);
    expect(capturedBody).toMatch(/IL\b/);
    expect(capturedBody).toMatch(/Country/);
    expect(capturedBody).toMatch(/Recommended/);
    expect(capturedBody).toMatch(/\/admin\/users/);
  });

  it("does NOT include a ban link (Suspicious never has one)", async () => {
    await sendSuspiciousActivityAlert({
      kind: "admin_password_failed_repeatedly",
      summary: "4 consecutive failures",
    });
    expect(capturedBody).not.toMatch(/ban[- ]?device/i);
    expect(capturedBody).not.toMatch(/\/api\/security\/ban-device/);
  });
});

describe("Security Breach email — spec-required fields", () => {
  it("includes Event type + Severity + Time on every breach email", async () => {
    await sendSecurityBreachAlert({
      kind: "csrf_violation",
      summary: "CSRF check failed on admin mutation",
    });
    expect(capturedBody).toMatch(/Event type/);
    expect(capturedBody).toMatch(/csrf_violation/);
    expect(capturedBody).toMatch(/Severity/);
    expect(capturedBody).toMatch(/Time/);
    expect(capturedBody).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("includes every optional field when supplied", async () => {
    await sendSecurityBreachAlert({
      kind: "sqli_attempt",
      summary: "SQL injection blocked",
      severity: "Critical",
      ipAddress: "203.0.113.99",
      deviceCredentialId: "dev-fp-xyz",
      userAgent: "curl/8.0",
      city: "Boston",
      region: "MA",
      country: "US",
      route: "/api/admin/sources",
      attemptedAction: "drop_table_users",
      automaticActionTaken: "Request blocked + Security Breach logged",
      banDeviceUrl: "https://viafidei.example.com/api/security/ban-device/TOKEN",
    });
    expect(capturedBody).toMatch(/Critical/);
    expect(capturedBody).toMatch(/Target route/);
    expect(capturedBody).toMatch(/\/api\/admin\/sources/);
    expect(capturedBody).toMatch(/Action attempted/);
    expect(capturedBody).toMatch(/drop_table_users/);
    expect(capturedBody).toMatch(/Automatic action taken/);
    expect(capturedBody).toMatch(/Boston/);
    expect(capturedBody).toMatch(/MA\b/);
    expect(capturedBody).toMatch(/US\b/);
    expect(capturedBody).toMatch(/curl\/8\.0/);
    expect(capturedBody).toMatch(/Ban the originating device/);
    expect(capturedBody).toMatch(/\/api\/security\/ban-device\/TOKEN/);
  });

  it("defaults Severity to 'Error' when not supplied", async () => {
    await sendSecurityBreachAlert({
      kind: "csrf_violation",
      summary: "CSRF check failed",
    });
    expect(capturedBody).toMatch(/Severity[^A-Z]*Error/);
  });
});
