/**
 * Failed admin login threshold + Suspicious Activity email behaviour.
 *
 * Drives the real /api/admin/login route with the real failure counter
 * and the real `reportSuspiciousActivity` (so its 5-minute dedup is
 * exercised); only the email transport is mocked, so the test counts
 * actual Suspicious Activity emails.
 *
 *   • one / two failed logins  → no email;
 *   • three failed logins      → one email;
 *   • further failures         → deduplicated, still one email;
 *   • streaks are scoped by device + IP;
 *   • a success on one device does not erase another device's streak.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const verifyAdminCredentialsMock = vi.fn();
const sessionSaveMock = vi.fn().mockResolvedValue(undefined);
const sendSuspiciousActivityMock = vi.fn().mockResolvedValue({ ok: true, delivery: "sent" });
const sendSecurityBreachMock = vi.fn().mockResolvedValue({ ok: true, delivery: "sent" });
const sendAdminLoginAlertMock = vi.fn().mockResolvedValue({ ok: true, delivery: "sent" });

vi.mock("@/lib/auth", () => ({
  adminLoginSchema: {
    safeParse: (v: { username: string; password: string }) =>
      typeof v.username === "string" && v.username.length > 0 && typeof v.password === "string"
        ? { success: true, data: v }
        : { success: false },
  },
  verifyAdminCredentials: (...a: unknown[]) => verifyAdminCredentialsMock(...a),
  getSession: vi.fn().mockResolvedValue({ save: sessionSaveMock }),
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 }),
  RATE_POLICIES: { adminLogin: { max: 10, windowMs: 900_000 } },
}));
vi.mock("@/lib/security/security-event-store", () => ({
  recordSecurityEvent: vi.fn().mockResolvedValue({ id: "evt-1" }),
  updateSecurityEventFlags: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/data/error-log", () => ({ recordError: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({
  sendSuspiciousActivityAlert: (...a: unknown[]) => sendSuspiciousActivityMock(...a),
  sendSecurityBreachAlert: (...a: unknown[]) => sendSecurityBreachMock(...a),
  sendAdminLoginAlert: (...a: unknown[]) => sendAdminLoginAlertMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { _resetAllAdminFailureCountersForTests } from "@/lib/security/admin-failure-counter";
import { _resetSecurityEventDedupForTests } from "@/lib/security/security-events";
import { _resetAdminActionRateWindowForTests } from "@/lib/audit/admin-action-log";

async function callLogin(opts: {
  password?: string;
  device?: string;
  ip?: string;
}): Promise<Response> {
  const { POST } = await import("@/app/api/admin/login/route");
  const body = new URLSearchParams({
    username: "admin",
    password: opts.password ?? "wrong-password",
  }).toString();
  const base = new Request("http://localhost/api/admin/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": opts.ip ?? "203.0.113.10",
    },
    body,
  });
  const req = Object.assign(base, {
    cookies: {
      get: (n: string) => (n === "vf_dev_id" ? { value: opts.device ?? "device-A" } : undefined),
    },
  }) as unknown as NextRequest;
  return POST(req);
}

/** Let the route's fire-and-forget security reporting settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 40));
}

beforeEach(() => {
  resetPrismaMock();
  verifyAdminCredentialsMock.mockReset().mockReturnValue(false);
  sendSuspiciousActivityMock.mockClear();
  sendSecurityBreachMock.mockClear();
  sendAdminLoginAlertMock.mockClear();
  _resetAllAdminFailureCountersForTests();
  _resetSecurityEventDedupForTests();
  _resetAdminActionRateWindowForTests();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("failed admin login threshold", () => {
  it("one failed login does not send a Suspicious Activity email", async () => {
    await callLogin({});
    await flush();
    expect(sendSuspiciousActivityMock).not.toHaveBeenCalled();
  });

  it("two failed logins do not send a Suspicious Activity email", async () => {
    await callLogin({});
    await callLogin({});
    await flush();
    expect(sendSuspiciousActivityMock).not.toHaveBeenCalled();
  });

  it("three failed logins send a Suspicious Activity email", async () => {
    await callLogin({});
    await callLogin({});
    await callLogin({});
    await vi.waitFor(() => expect(sendSuspiciousActivityMock).toHaveBeenCalled());
  });

  it("deduplicates — further failures do not send another email", async () => {
    for (let i = 0; i < 6; i++) {
      await callLogin({});
    }
    await vi.waitFor(() => expect(sendSuspiciousActivityMock).toHaveBeenCalled());
    await flush();
    expect(sendSuspiciousActivityMock).toHaveBeenCalledTimes(1);
  });

  it("scopes the streak by device and IP — separate devices do not aggregate", async () => {
    await callLogin({ device: "device-A", ip: "203.0.113.1" });
    await callLogin({ device: "device-A", ip: "203.0.113.1" });
    await callLogin({ device: "device-B", ip: "203.0.113.2" });
    await callLogin({ device: "device-B", ip: "203.0.113.2" });
    await flush();
    // Two failures per device — each is below the three-failure threshold.
    expect(sendSuspiciousActivityMock).not.toHaveBeenCalled();
  });

  it("a successful login on one device does not erase another device's attack streak", async () => {
    // Device B accumulates two failed attempts.
    await callLogin({ device: "device-B", ip: "203.0.113.2" });
    await callLogin({ device: "device-B", ip: "203.0.113.2" });
    // A legitimate success arrives on a different device.
    verifyAdminCredentialsMock.mockReturnValue(true);
    await callLogin({ device: "device-A", ip: "203.0.113.1", password: "correct" });
    verifyAdminCredentialsMock.mockReturnValue(false);
    // Device B's third failure must still cross the threshold.
    await callLogin({ device: "device-B", ip: "203.0.113.2" });
    await vi.waitFor(() => expect(sendSuspiciousActivityMock).toHaveBeenCalled());
  });
});
