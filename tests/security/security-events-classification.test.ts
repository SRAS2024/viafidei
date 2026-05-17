/**
 * Suspicious Activity and Security Breach are two distinct alert
 * paths. These tests prove:
 *
 *   * reportSuspiciousActivity writes classification = "Suspicious"
 *     and sends a Suspicious Activity email (never a Breach email).
 *   * reportSecurityBreach writes classification = "Breach", sends
 *     a Security Breach email, and mints a signed ban link when a
 *     device credential is available.
 *   * Suspicious Activity emails do NOT contain a ban link.
 *   * The dedup window separates Suspicious from Breach so an
 *     escalation still gets through.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const sendSuspiciousActivityAlertMock = vi.fn().mockResolvedValue({ ok: true, delivery: "sent" });
const sendSecurityBreachAlertMock = vi.fn().mockResolvedValue({ ok: true, delivery: "sent" });

vi.mock("@/lib/email", () => ({
  sendSuspiciousActivityAlert: sendSuspiciousActivityAlertMock,
  sendSecurityBreachAlert: sendSecurityBreachAlertMock,
  readAdminEmail: vi.fn().mockReturnValue("admin@example.com"),
}));

import {
  reportSuspiciousActivity,
  reportSecurityBreach,
  _resetSecurityEventDedupForTests,
} from "@/lib/security/security-events";

beforeEach(() => {
  resetPrismaMock();
  _resetSecurityEventDedupForTests();
  sendSuspiciousActivityAlertMock.mockClear();
  sendSecurityBreachAlertMock.mockClear();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";

  // Standard SecurityEvent mock — accept any insert.
  prismaMock.securityEvent.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: `evt_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date(),
      ...data,
    }),
  );
  prismaMock.securityEvent.update.mockResolvedValue({});
});

describe("Suspicious vs Breach classification", () => {
  it("reportSuspiciousActivity writes Suspicious and sends a Suspicious Activity email", async () => {
    await reportSuspiciousActivity({
      kind: "admin_password_failed_repeatedly",
      summary: "4 consecutive failures",
      ipAddress: "203.0.113.5",
    });
    expect(prismaMock.securityEvent.create).toHaveBeenCalled();
    const writeArgs = prismaMock.securityEvent.create.mock.calls[0]![0] as {
      data: { classification: string; severity: string };
    };
    expect(writeArgs.data.classification).toBe("Suspicious");
    expect(writeArgs.data.severity).toBe("warning");
    expect(sendSuspiciousActivityAlertMock).toHaveBeenCalledTimes(1);
    expect(sendSecurityBreachAlertMock).not.toHaveBeenCalled();
  });

  it("reportSecurityBreach writes Breach and sends a Security Breach email", async () => {
    await reportSecurityBreach({
      kind: "csrf_violation",
      summary: "CSRF token missing on admin mutation",
      ipAddress: "203.0.113.5",
    });
    expect(prismaMock.securityEvent.create).toHaveBeenCalled();
    const writeArgs = prismaMock.securityEvent.create.mock.calls[0]![0] as {
      data: { classification: string; severity: string };
    };
    expect(writeArgs.data.classification).toBe("Breach");
    expect(writeArgs.data.severity).toBe("error");
    expect(sendSecurityBreachAlertMock).toHaveBeenCalledTimes(1);
    expect(sendSuspiciousActivityAlertMock).not.toHaveBeenCalled();
  });

  it("Suspicious Activity emails never include a ban link", async () => {
    await reportSuspiciousActivity({
      kind: "admin_password_failed_repeatedly",
      summary: "4 consecutive failures",
      ipAddress: "203.0.113.5",
      // Even with a device credential, Suspicious must not include a
      // ban link — only Breach escalation does.
      deviceCredential: "raw-device-cookie",
    });
    expect(sendSuspiciousActivityAlertMock).toHaveBeenCalledTimes(1);
    const sentArgs = sendSuspiciousActivityAlertMock.mock.calls[0]![0] as Record<string, unknown>;
    // The Suspicious Activity email helper does not accept a
    // banDeviceUrl parameter at all.
    expect(sentArgs).not.toHaveProperty("banDeviceUrl");
  });

  it("Security Breach emails include a signed ban link when a device credential is available", async () => {
    await reportSecurityBreach({
      kind: "sqli_attempt",
      summary: "SQL injection payload in /api/admin/...",
      ipAddress: "203.0.113.5",
      deviceCredential: "raw-device-cookie-xyz",
    });
    expect(sendSecurityBreachAlertMock).toHaveBeenCalledTimes(1);
    const sentArgs = sendSecurityBreachAlertMock.mock.calls[0]![0] as { banDeviceUrl?: string };
    expect(sentArgs.banDeviceUrl).toMatch(/\/api\/security\/ban-device\//);
    // The raw device credential never appears in the URL.
    expect(sentArgs.banDeviceUrl).not.toContain("raw-device-cookie-xyz");
  });

  it("Security Breach emails skip the ban link when no device credential is available", async () => {
    await reportSecurityBreach({
      kind: "sqli_attempt",
      summary: "SQL injection from anonymous client",
      ipAddress: "203.0.113.5",
    });
    expect(sendSecurityBreachAlertMock).toHaveBeenCalledTimes(1);
    const sentArgs = sendSecurityBreachAlertMock.mock.calls[0]![0] as { banDeviceUrl?: string };
    expect(sentArgs.banDeviceUrl).toBeUndefined();
  });
});

describe("Suspicious / Breach dedup window", () => {
  it("a second Suspicious event of the same kind within the window is deduped", async () => {
    await reportSuspiciousActivity({
      kind: "admin_password_failed_repeatedly",
      summary: "4 consecutive failures",
      ipAddress: "203.0.113.5",
    });
    await reportSuspiciousActivity({
      kind: "admin_password_failed_repeatedly",
      summary: "5 consecutive failures",
      ipAddress: "203.0.113.5",
    });
    expect(sendSuspiciousActivityAlertMock).toHaveBeenCalledTimes(1);
  });

  it("Suspicious -> Breach escalation is NOT deduped (separate classification keyspace)", async () => {
    await reportSuspiciousActivity({
      kind: "admin_password_failed_repeatedly",
      summary: "4 consecutive failures",
      ipAddress: "203.0.113.5",
    });
    await reportSecurityBreach({
      kind: "admin_password_failed_repeatedly",
      summary: "16 consecutive failures — brute force",
      ipAddress: "203.0.113.5",
    });
    expect(sendSuspiciousActivityAlertMock).toHaveBeenCalledTimes(1);
    expect(sendSecurityBreachAlertMock).toHaveBeenCalledTimes(1);
  });
});
