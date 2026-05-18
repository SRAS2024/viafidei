/**
 * User /api/auth/login fires the correct classification:
 *
 *   * A valid login emits no security event.
 *   * A single wrong password emits no security event (below threshold).
 *   * More than 5 consecutive failures fires Suspicious Activity.
 *   * More than 20 consecutive failures escalates to Security Breach
 *     (brute-force pattern).
 *   * A successful login resets the counter so a later run starts fresh.
 *
 * Spec: "Security Breach should trigger if someone attempts brute
 * force attacks against an account."
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateMock = vi.fn();
const rateLimitMock = vi
  .fn()
  .mockResolvedValue({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 });
const reportSuspiciousActivityMock = vi.fn().mockResolvedValue(undefined);
const reportSecurityBreachMock = vi.fn().mockResolvedValue(undefined);
const sessionSaveMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth", () => ({
  authenticate: (...args: unknown[]) => authenticateMock(...args),
  loginSchema: {
    safeParse: (v: { email: string; password: string }) => {
      if (
        typeof v.email === "string" &&
        v.email.includes("@") &&
        typeof v.password === "string" &&
        v.password.length > 0
      ) {
        return { success: true, data: v };
      }
      return { success: false };
    },
  },
  getSession: vi.fn().mockResolvedValue({ save: sessionSaveMock }),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  RATE_POLICIES: { login: { max: 50, windowMs: 900_000 } },
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: (...args: unknown[]) => reportSecurityBreachMock(...args),
  reportSuspiciousActivity: (...args: unknown[]) => reportSuspiciousActivityMock(...args),
}));
vi.mock("@/lib/data/profile", () => ({
  getProfileForUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
  }),
}));

import type { NextRequest } from "next/server";
import { _resetAllUserFailureCountersForTests } from "@/lib/security/user-failure-counter";

beforeEach(() => {
  authenticateMock.mockReset();
  rateLimitMock.mockClear();
  reportSuspiciousActivityMock.mockClear();
  reportSecurityBreachMock.mockClear();
  sessionSaveMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 });
  _resetAllUserFailureCountersForTests();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function callLogin(args: { email: string; password: string }): Promise<Response> {
  const { POST } = await import("@/app/api/auth/login/route");
  const body = new URLSearchParams(args).toString();
  const base = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": "203.0.113.50",
    },
    body,
  });
  const req = Object.assign(base, {
    cookies: {
      get(name: string) {
        if (name === "vf_dev_id") return { value: "test-user-device" };
        return undefined;
      },
    },
  }) as unknown as NextRequest;
  return POST(req);
}

describe("user login — Suspicious vs Breach classification", () => {
  it("a valid login emits NO security event", async () => {
    authenticateMock.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      firstName: "Test",
      lastName: "User",
      language: "en",
    });
    const res = await callLogin({ email: "user@example.com", password: "correct" });
    expect(res.status).toBe(303);
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();
    expect(reportSecurityBreachMock).not.toHaveBeenCalled();
  });

  it("a single failed login does NOT trigger any security event (below threshold)", async () => {
    authenticateMock.mockResolvedValue(null);
    await callLogin({ email: "user@example.com", password: "wrong" });
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();
    expect(reportSecurityBreachMock).not.toHaveBeenCalled();
  });

  it("more than 5 consecutive failures triggers Suspicious Activity", async () => {
    authenticateMock.mockResolvedValue(null);
    for (let i = 0; i < 6; i++) {
      await callLogin({ email: "user@example.com", password: "wrong" });
    }
    expect(reportSuspiciousActivityMock).toHaveBeenCalledTimes(1);
    expect(reportSecurityBreachMock).not.toHaveBeenCalled();
  });

  it("more than 20 consecutive failures escalates to Security Breach (brute force)", async () => {
    authenticateMock.mockResolvedValue(null);
    for (let i = 0; i < 22; i++) {
      await callLogin({ email: "user@example.com", password: "wrong" });
    }
    expect(reportSecurityBreachMock).toHaveBeenCalled();
    const args = reportSecurityBreachMock.mock.calls[0]![0] as {
      kind: string;
      attemptedAction?: string;
    };
    expect(args.kind).toBe("user_password_brute_force");
    expect(args.attemptedAction).toBe("user_password_brute_force");
  });

  it("a successful login resets the failure counter", async () => {
    // 5 failures — below threshold.
    authenticateMock.mockResolvedValue(null);
    for (let i = 0; i < 5; i++) {
      await callLogin({ email: "user@example.com", password: "wrong" });
    }
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();

    // Successful login resets.
    authenticateMock.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      firstName: "Test",
      lastName: "User",
      language: "en",
    });
    await callLogin({ email: "user@example.com", password: "correct" });

    // Now 5 more failures — should still be below threshold (no
    // alert), because the counter was reset.
    authenticateMock.mockResolvedValue(null);
    for (let i = 0; i < 5; i++) {
      await callLogin({ email: "user@example.com", password: "wrong" });
    }
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();
  });
});
