/**
 * Admin /api/admin/login behavior under the Suspicious/Breach split:
 *
 * - A valid admin login never emits any security event.
 * - A single failure logs to audit but does not email the admin.
 * - More than three consecutive failures emit a Suspicious Activity event.
 * - A high-burst run of failures escalates to a Security Breach event.
 * - A successful login resets the failure counter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const verifyAdminCredentialsMock = vi.fn();
const rateLimitMock = vi.fn();
const writeAuditMock = vi.fn();
const reportSuspiciousActivityMock = vi.fn().mockResolvedValue(undefined);
const reportSecurityBreachMock = vi.fn().mockResolvedValue(undefined);
const sessionSaveMock = vi.fn().mockResolvedValue(undefined);
const getSessionMock = vi.fn().mockResolvedValue({ save: sessionSaveMock });

vi.mock("@/lib/auth", () => ({
  adminLoginSchema: {
    safeParse: (v: { username: string; password: string }) => {
      if (
        typeof v.username === "string" &&
        v.username.length > 0 &&
        typeof v.password === "string" &&
        v.password.length > 0
      ) {
        return { success: true, data: v };
      }
      return { success: false };
    },
  },
  verifyAdminCredentials: (...args: unknown[]) => verifyAdminCredentialsMock(...args),
  getSession: (...args: unknown[]) => getSessionMock(...args),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  RATE_POLICIES: { adminLogin: { max: 10, windowMs: 900_000 } },
}));

vi.mock("@/lib/audit", () => ({
  writeAudit: (...args: unknown[]) => writeAuditMock(...args),
}));

vi.mock("@/lib/security/security-events", () => ({
  reportSuspiciousActivity: (...args: unknown[]) => reportSuspiciousActivityMock(...args),
  reportSecurityBreach: (...args: unknown[]) => reportSecurityBreachMock(...args),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import type { NextRequest } from "next/server";
import { _resetAllAdminFailureCountersForTests } from "@/lib/security/admin-failure-counter";

beforeEach(() => {
  resetPrismaMock();
  verifyAdminCredentialsMock.mockReset();
  rateLimitMock.mockReset();
  writeAuditMock.mockReset();
  reportSuspiciousActivityMock.mockClear();
  reportSecurityBreachMock.mockClear();
  sessionSaveMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 });
  writeAuditMock.mockResolvedValue(undefined);
  _resetAllAdminFailureCountersForTests();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function callLogin(form: { username: string; password: string }): Promise<Response> {
  const { POST } = await import("@/app/api/admin/login/route");
  const body = new URLSearchParams(form).toString();
  const base = new Request("http://localhost/api/admin/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": "203.0.113.10",
    },
    body,
  });
  // Attach a minimal cookies API so the route handler can read the
  // device-credential cookie without depending on the full NextRequest
  // implementation.
  const req = Object.assign(base, {
    cookies: {
      get(name: string) {
        if (name === "vf_dev_id") return { value: "test-device-credential-1234" };
        return undefined;
      },
    },
  }) as unknown as NextRequest;
  return POST(req);
}

describe("admin login — Suspicious vs Breach classification", () => {
  it("a valid admin login emits NO security event of any kind", async () => {
    verifyAdminCredentialsMock.mockReturnValue(true);
    const res = await callLogin({ username: "admin", password: "correct-horse-battery-staple" });
    expect(res.status).toBe(303);
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();
    expect(reportSecurityBreachMock).not.toHaveBeenCalled();
  });

  it("a single failed login emits NO security event (below threshold)", async () => {
    verifyAdminCredentialsMock.mockReturnValue(false);
    await callLogin({ username: "admin", password: "wrong" });
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();
    expect(reportSecurityBreachMock).not.toHaveBeenCalled();
  });

  it("the fourth consecutive failure triggers Suspicious Activity (but not Breach)", async () => {
    verifyAdminCredentialsMock.mockReturnValue(false);
    for (let i = 0; i < 4; i++) {
      await callLogin({ username: "admin", password: "wrong" });
    }
    expect(reportSuspiciousActivityMock).toHaveBeenCalledTimes(1);
    expect(reportSecurityBreachMock).not.toHaveBeenCalled();
  });

  it("a high-burst run escalates to Security Breach (brute-force pattern)", async () => {
    verifyAdminCredentialsMock.mockReturnValue(false);
    for (let i = 0; i < 17; i++) {
      await callLogin({ username: "admin", password: "wrong" });
    }
    expect(reportSecurityBreachMock).toHaveBeenCalled();
  });

  it("rate-limit blowout emits Security Breach (treated as an active probe)", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 60_000 });
    verifyAdminCredentialsMock.mockReturnValue(false);
    await callLogin({ username: "admin", password: "wrong" });
    expect(reportSecurityBreachMock).toHaveBeenCalled();
  });

  it("a successful login resets the failure counter so a later run starts fresh", async () => {
    verifyAdminCredentialsMock.mockReturnValue(false);
    // 3 failures — below threshold, no event.
    for (let i = 0; i < 3; i++) {
      await callLogin({ username: "admin", password: "wrong" });
    }
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();

    // Successful login resets the counter.
    verifyAdminCredentialsMock.mockReturnValue(true);
    await callLogin({ username: "admin", password: "correct" });

    // Now another 3 failures — should still be below threshold.
    verifyAdminCredentialsMock.mockReturnValue(false);
    for (let i = 0; i < 3; i++) {
      await callLogin({ username: "admin", password: "wrong" });
    }
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();
  });
});
