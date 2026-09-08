/**
 * Protection of the two-factor endpoints (security spec item 11), and the
 * new shape of stage one (item 1).
 *
 * The properties under test:
 *   • a correct password does NOT produce an administrator — it produces a
 *     powerless PENDING session plus a mailed code;
 *   • the verification endpoint is CSRF-protected and refuses everything it
 *     cannot positively verify;
 *   • consumed, expired, superseded and attempt-exhausted challenges are all
 *     refused with the SAME response, so a submission cannot be used to probe
 *     which control fired;
 *   • a challenge is not reusable after success;
 *   • the submitted code never appears in a redirect URL.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const verifyCodeMock = vi.fn();
const abandonMock = vi.fn().mockResolvedValue(1);
const issueChallengeMock = vi.fn();
vi.mock("@/lib/auth/admin-2fa", () => ({
  verifyAdminTwoFactorCode: (...a: unknown[]) => verifyCodeMock(...a),
  abandonAdminTwoFactorChallenges: (...a: unknown[]) => abandonMock(...a),
  issueAdminTwoFactorChallenge: (...a: unknown[]) => issueChallengeMock(...a),
}));

const getPendingMock = vi.fn();
const completeMock = vi.fn();
const revokeMock = vi.fn().mockResolvedValue(true);
const beginMock = vi.fn();
vi.mock("@/lib/auth/admin-session", () => ({
  getPendingAdminSession: (...a: unknown[]) => getPendingMock(...a),
  completeAdminTwoFactor: (...a: unknown[]) => completeMock(...a),
  revokeCurrentAdminSession: (...a: unknown[]) => revokeMock(...a),
  beginAdminSession: (...a: unknown[]) => beginMock(...a),
}));

const recordSuccessMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/security/admin-login-events", () => ({
  recordAdminLoginSuccess: (...a: unknown[]) => recordSuccessMock(...a),
  recordAdminLoginFailure: vi.fn().mockResolvedValue(null),
}));

const writeAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit", () => ({ writeAudit: (...a: unknown[]) => writeAuditMock(...a) }));

const ORIGIN = "http://localhost:3000";

function makeRequest(
  path: string,
  body: Record<string, string>,
  headers: Record<string, string> = {},
): NextRequest {
  const base = new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: ORIGIN,
      host: "localhost:3000",
      "x-forwarded-for": "203.0.113.10",
      ...headers,
    },
    body: new URLSearchParams(body).toString(),
  });
  return Object.assign(base, {
    cookies: {
      get: (n: string) => (n === "vf_dev_id" ? { value: "device-credential-1234" } : undefined),
    },
  }) as unknown as NextRequest;
}

async function postVerify(
  body: Record<string, string>,
  headers?: Record<string, string>,
): Promise<Response> {
  const { POST } = await import("@/app/api/auth/admin-2fa/verify/route");
  return POST(makeRequest("/api/auth/admin-2fa/verify", body, headers));
}

async function postResend(headers?: Record<string, string>): Promise<Response> {
  const { POST } = await import("@/app/api/auth/admin-2fa/resend/route");
  return POST(makeRequest("/api/auth/admin-2fa/resend", {}, headers));
}

const PENDING = {
  adminSessionId: "pending-session-id-abc",
  username: "root",
  authenticatedAt: new Date(),
  expiresAt: new Date(Date.now() + 600_000),
};

beforeEach(() => {
  resetPrismaMock();
  verifyCodeMock.mockReset();
  abandonMock.mockClear().mockResolvedValue(1);
  issueChallengeMock.mockReset().mockResolvedValue({
    ok: true,
    expiresAt: new Date(Date.now() + 300_000),
    delivery: "sent",
  });
  getPendingMock.mockReset().mockResolvedValue(PENDING);
  completeMock.mockReset().mockResolvedValue({
    ok: true,
    adminSessionId: "rotated-id",
    username: "root",
    authenticatedAt: new Date(),
    twoFactorVerifiedAt: new Date(),
  });
  revokeMock.mockClear().mockResolvedValue(true);
  beginMock.mockReset().mockResolvedValue({ ok: true, adminSessionId: PENDING.adminSessionId });
  recordSuccessMock.mockClear();
  writeAuditMock.mockClear();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

describe("stage one no longer authenticates anyone", () => {
  it("the admin login route never assigns the ADMIN role", () => {
    const src = readFileSync(
      join(process.cwd(), "src", "app", "api", "admin", "login", "route.ts"),
      "utf8",
    );
    // The only function allowed to grant ADMIN is completeAdminTwoFactor,
    // which refuses without a verified challenge.
    expect(src).not.toMatch(/role\s*=\s*["']ADMIN["']/);
    expect(src).toContain("beginAdminSession");
    expect(src).toContain("issueAdminTwoFactorChallenge");
  });

  it("the second-factor route is the only place a successful sign-in is recorded", () => {
    const login = readFileSync(
      join(process.cwd(), "src", "app", "api", "admin", "login", "route.ts"),
      "utf8",
    );
    const verify = readFileSync(
      join(process.cwd(), "src", "app", "api", "auth", "admin-2fa", "verify", "route.ts"),
      "utf8",
    );
    expect(login).not.toContain("recordAdminLoginSuccess");
    expect(verify).toContain("recordAdminLoginSuccess");
  });
});

describe("CSRF (item 11)", () => {
  it("refuses a cross-origin verification without touching the challenge", async () => {
    const res = await postVerify({ code: "123456" }, { origin: "https://evil.example.com" });
    expect(res.status).toBe(403);
    expect(verifyCodeMock).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it("refuses a cross-origin resend without issuing a code", async () => {
    const res = await postResend({ origin: "https://evil.example.com" });
    expect(res.status).toBe(403);
    expect(issueChallengeMock).not.toHaveBeenCalled();
  });

  it("refuses a request with no Origin and no Referer at all", async () => {
    const base = new Request(`${ORIGIN}/api/auth/admin-2fa/verify`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", host: "localhost:3000" },
      body: "code=123456",
    });
    const req = Object.assign(base, {
      cookies: { get: () => undefined },
    }) as unknown as NextRequest;
    const { POST } = await import("@/app/api/auth/admin-2fa/verify/route");
    expect((await POST(req)).status).toBe(403);
    expect(verifyCodeMock).not.toHaveBeenCalled();
  });
});

describe("verification outcomes", () => {
  it("refuses when there is no pending login attempt", async () => {
    getPendingMock.mockResolvedValue(null);
    const res = await postVerify({ code: "123456" });
    expect(res.headers.get("location")).toContain("/admin/login?error=invalid");
    expect(verifyCodeMock).not.toHaveBeenCalled();
  });

  it("verifies against the SERVER's idea of the account, not the form's", async () => {
    verifyCodeMock.mockResolvedValue({ ok: true });
    await postVerify({ code: "123456", username: "attacker" });
    const actor = verifyCodeMock.mock.calls[0]![0] as { username: string; adminSessionId: string };
    expect(actor.username).toBe("root");
    expect(actor.adminSessionId).toBe(PENDING.adminSessionId);
  });

  it("a wrong code keeps the attempt alive and never promotes the session", async () => {
    verifyCodeMock.mockResolvedValue({ ok: false, reason: "invalid_code", terminal: false });
    const res = await postVerify({ code: "000000" });
    expect(res.headers.get("location")).toContain("/admin/login?stage=code&error=code");
    expect(completeMock).not.toHaveBeenCalled();
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it("gives one identical answer for expired, consumed, superseded and exhausted", async () => {
    const locations = new Set<string>();
    for (const reason of ["expired", "no_challenge", "attempts_exhausted", "rate_limited"]) {
      verifyCodeMock.mockResolvedValue({ ok: false, reason, terminal: true });
      const res = await postVerify({ code: "000000" });
      locations.add(res.headers.get("location") ?? "");
      expect(res.status).toBe(303);
    }
    // One response for every terminal cause: nothing distinguishes them.
    expect(locations.size).toBe(1);
    expect([...locations][0]).toContain("/admin/login?error=invalid");
  });

  it("tears the whole attempt down on a terminal failure", async () => {
    verifyCodeMock.mockResolvedValue({ ok: false, reason: "attempts_exhausted", terminal: true });
    await postVerify({ code: "000000" });
    expect(abandonMock).toHaveBeenCalledWith(PENDING.adminSessionId);
    expect(revokeMock).toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it("promotes the session only after a verified code, and records the sign-in", async () => {
    verifyCodeMock.mockResolvedValue({ ok: true });
    const res = await postVerify({ code: "123456" });
    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(res.headers.get("location")).toContain("/admin?welcome=1");
    expect(recordSuccessMock).toHaveBeenCalledTimes(1);
    expect(writeAuditMock.mock.calls[0]![0]).toMatchObject({ action: "admin.login.success" });
  });

  it("fails closed when promotion itself is refused (a lost race)", async () => {
    verifyCodeMock.mockResolvedValue({ ok: true });
    completeMock.mockResolvedValue({ ok: false, reason: "pending_two_factor" });
    const res = await postVerify({ code: "123456" });
    expect(res.headers.get("location")).toContain("/admin/login?error=invalid");
    expect(revokeMock).toHaveBeenCalled();
    expect(recordSuccessMock).not.toHaveBeenCalled();
  });

  it("never echoes the submitted code back in the redirect", async () => {
    verifyCodeMock.mockResolvedValue({ ok: false, reason: "invalid_code", terminal: false });
    const res = await postVerify({ code: "424242" });
    expect(res.headers.get("location")).not.toContain("424242");
  });

  it("treats an unparsable body as an ordinary bad submission", async () => {
    const base = new Request(`${ORIGIN}/api/auth/admin-2fa/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost:3000" },
      body: "{}",
    });
    const req = Object.assign(base, {
      cookies: { get: () => undefined },
    }) as unknown as NextRequest;
    const { POST } = await import("@/app/api/auth/admin-2fa/verify/route");
    const res = await POST(req);
    expect(res.status).toBe(303);
    expect(completeMock).not.toHaveBeenCalled();
  });
});

describe("resend", () => {
  it("re-issues against the pending session and reports delivery", async () => {
    const res = await postResend();
    expect(issueChallengeMock).toHaveBeenCalledTimes(1);
    const actor = issueChallengeMock.mock.calls[0]![0] as { adminSessionId: string };
    expect(actor.adminSessionId).toBe(PENDING.adminSessionId);
    expect(res.headers.get("location")).toContain("notice=sent");
  });

  it("gives the same answer whether it was rate limited or the store failed", async () => {
    const locations = new Set<string>();
    for (const reason of ["rate_limited", "store_unavailable"]) {
      issueChallengeMock.mockResolvedValue({ ok: false, reason });
      const res = await postResend();
      locations.add(res.headers.get("location") ?? "");
    }
    expect(locations.size).toBe(1);
  });

  it("refuses when there is no pending login attempt", async () => {
    getPendingMock.mockResolvedValue(null);
    await postResend();
    expect(issueChallengeMock).not.toHaveBeenCalled();
  });
});
