import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCookieJar, type FakeCookieJar } from "../helpers/cookies-mock";

const rateLimitMock = vi.fn();
const findUserByEmailMock = vi.fn();
const createUserMock = vi.fn();
const issueEmailVerificationTokenMock = vi.fn();
const sendEmailVerificationEmailMock = vi.fn();
const sendWelcomeEmailMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
    "@/lib/security/rate-limit",
  );
  return { ...actual, rateLimit: (...args: unknown[]) => rateLimitMock(...args) };
});

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/schemas")>("@/lib/auth/schemas");
  return {
    ...actual,
    findUserByEmail: (...args: unknown[]) => findUserByEmailMock(...args),
    createUser: (...args: unknown[]) => createUserMock(...args),
    issueEmailVerificationToken: (...args: unknown[]) => issueEmailVerificationTokenMock(...args),
    getSession: (...args: unknown[]) => getSessionMock(...args),
  };
});

vi.mock("@/lib/email", () => ({
  sendEmailVerificationEmail: (...args: unknown[]) => sendEmailVerificationEmailMock(...args),
  sendWelcomeEmail: (...args: unknown[]) => sendWelcomeEmailMock(...args),
}));

let cookieJar: FakeCookieJar;
vi.mock("next/headers", () => ({
  cookies: () => cookieJar,
}));

import { POST } from "@/app/api/auth/register/route";
import type { NextRequest } from "next/server";

function buildRequest(form: Record<string, string>): NextRequest {
  const fd = new FormData();
  for (const [k, v] of Object.entries(form)) fd.append(k, v);
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    body: fd,
    headers: { "x-forwarded-for": "203.0.113.5" },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  rateLimitMock.mockReset();
  findUserByEmailMock.mockReset();
  createUserMock.mockReset();
  issueEmailVerificationTokenMock.mockReset();
  sendEmailVerificationEmailMock.mockReset();
  sendWelcomeEmailMock.mockReset();
  getSessionMock.mockReset();
  cookieJar = createCookieJar();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 4, resetAt: Date.now() + 60_000 });
  findUserByEmailMock.mockResolvedValue(null);
  createUserMock.mockResolvedValue({
    id: "u1",
    email: "user@example.com",
    firstName: "Pio",
    lastName: "P",
    language: "en",
  });
  issueEmailVerificationTokenMock.mockResolvedValue({
    token: "raw-verify-token",
    expiresAt: new Date(Date.now() + 60_000),
  });
  sendEmailVerificationEmailMock.mockResolvedValue({ ok: true, delivery: "sent" });
  sendWelcomeEmailMock.mockResolvedValue({ ok: true, delivery: "sent" });
  getSessionMock.mockResolvedValue({
    userId: undefined,
    save: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/auth/register", () => {
  const validBody = {
    firstName: "Pio",
    lastName: "Pietrelcina",
    email: "user@example.com",
    password: "Stigm1ata",
    passwordConfirm: "Stigm1ata",
  };

  it("rejects malformed email by redirecting back to /register", async () => {
    const res = await POST(buildRequest({ ...validBody, email: "not-email" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/register?error=invalid");
  });

  it("rejects weak passwords", async () => {
    const res = await POST(
      buildRequest({ ...validBody, password: "weak", passwordConfirm: "weak" }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/register?error=weak");
  });

  it("rejects passwords missing a number", async () => {
    const res = await POST(
      buildRequest({ ...validBody, password: "Padre", passwordConfirm: "Padre" }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=weak");
  });

  it("rejects passwords missing a capital letter", async () => {
    const res = await POST(
      buildRequest({ ...validBody, password: "padre1", passwordConfirm: "padre1" }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=weak");
  });

  it("rejects mismatched password confirmation", async () => {
    const res = await POST(buildRequest({ ...validBody, passwordConfirm: "Different1" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=mismatch");
  });

  it("rejects already-registered email", async () => {
    findUserByEmailMock.mockResolvedValue({ id: "existing", email: "user@example.com" });
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=exists");
  });

  it("redirects to rate-limited when limiter rejects", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=rate_limited");
  });

  it("creates the user, sends welcome and verification emails, and redirects to /profile", async () => {
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/profile");

    expect(createUserMock).toHaveBeenCalledTimes(1);
    expect(sendWelcomeEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailVerificationEmailMock).toHaveBeenCalledTimes(1);
    const verifyCall = sendEmailVerificationEmailMock.mock.calls[0][0] as {
      user: { id: string };
      token: string;
    };
    expect(verifyCall.user.id).toBe("u1");
    expect(verifyCall.token).toBe("raw-verify-token");
  });

  it("saves the requested language to the user record", async () => {
    cookieJar.set("vf_locale", "es", {});
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(303);
    const arg = createUserMock.mock.calls[0][0] as { language: string };
    expect(arg.language).toBe("es");
  });

  it("creates the user even when welcome email delivery fails (non-blocking)", async () => {
    sendWelcomeEmailMock.mockResolvedValue({ ok: false, reason: "delivery_failed" });
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/profile");
    expect(createUserMock).toHaveBeenCalled();
  });
});
