import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitMock = vi.fn();
const requireUserMock = vi.fn();
const issueEmailVerificationTokenMock = vi.fn();
const consumeEmailVerificationTokenMock = vi.fn();
const sendEmailVerificationEmailMock = vi.fn();
const userFindUniqueMock = vi.fn();

vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
    "@/lib/security/rate-limit",
  );
  return {
    ...actual,
    rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  };
});

vi.mock("@/lib/auth", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
  issueEmailVerificationToken: (...args: unknown[]) => issueEmailVerificationTokenMock(...args),
  consumeEmailVerificationToken: (...args: unknown[]) => consumeEmailVerificationTokenMock(...args),
}));

vi.mock("@/lib/email", () => ({
  sendEmailVerificationEmail: (...args: unknown[]) => sendEmailVerificationEmailMock(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => userFindUniqueMock(...args) },
  },
}));

import { POST, PUT } from "@/app/api/auth/verify-email/route";
import type { NextRequest } from "next/server";

const VALID_TOKEN = "v".repeat(40);

function postRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.3" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function putRequest(): NextRequest {
  return new Request("http://localhost/api/auth/verify-email", {
    method: "PUT",
  }) as unknown as NextRequest;
}

beforeEach(() => {
  rateLimitMock.mockReset();
  requireUserMock.mockReset();
  issueEmailVerificationTokenMock.mockReset();
  consumeEmailVerificationTokenMock.mockReset();
  sendEmailVerificationEmailMock.mockReset();
  userFindUniqueMock.mockReset();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 2, resetAt: Date.now() + 60_000 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/auth/verify-email (consume)", () => {
  it("rejects malformed body", async () => {
    const res = await POST(postRequest({ token: "short" }));
    expect(res.status).toBe(400);
  });

  it("rejects rate-limited requests", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() });
    const res = await POST(postRequest({ token: VALID_TOKEN }));
    expect(res.status).toBe(429);
    expect(consumeEmailVerificationTokenMock).not.toHaveBeenCalled();
  });

  it("returns not_found for unknown / invalid token", async () => {
    consumeEmailVerificationTokenMock.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await POST(postRequest({ token: VALID_TOKEN }));
    expect(res.status).toBe(404);
  });

  it("returns invalid+message=expired for expired token", async () => {
    consumeEmailVerificationTokenMock.mockResolvedValue({ ok: false, reason: "expired" });
    const res = await POST(postRequest({ token: VALID_TOKEN }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("expired");
  });

  it("returns invalid+message=used for already used token", async () => {
    consumeEmailVerificationTokenMock.mockResolvedValue({ ok: false, reason: "used" });
    const res = await POST(postRequest({ token: VALID_TOKEN }));
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("used");
  });

  it("returns ok on success", async () => {
    consumeEmailVerificationTokenMock.mockResolvedValue({ ok: true, userId: "u1" });
    const res = await POST(postRequest({ token: VALID_TOKEN }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; verified: boolean };
    expect(body).toEqual({ ok: true, verified: true });
  });
});

describe("PUT /api/auth/verify-email (resend)", () => {
  it("rejects unauthenticated callers", async () => {
    requireUserMock.mockResolvedValue(null);
    const res = await PUT(putRequest());
    expect(res.status).toBe(401);
    expect(issueEmailVerificationTokenMock).not.toHaveBeenCalled();
  });

  it("returns conflict for already-verified accounts", async () => {
    requireUserMock.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      emailVerifiedAt: new Date(),
    });
    const res = await PUT(putRequest());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("already_verified");
  });

  it("rate limits per user", async () => {
    requireUserMock.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      emailVerifiedAt: null,
    });
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() });
    const res = await PUT(putRequest());
    expect(res.status).toBe(429);
    expect(issueEmailVerificationTokenMock).not.toHaveBeenCalled();
  });

  it("issues a token and sends a verification email in the saved language", async () => {
    requireUserMock.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      emailVerifiedAt: null,
    });
    userFindUniqueMock.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      firstName: "Pio",
      lastName: "Pietrelcina",
      language: "es",
    });
    issueEmailVerificationTokenMock.mockResolvedValue({
      token: "raw-verify",
      expiresAt: new Date(Date.now() + 60_000),
    });
    sendEmailVerificationEmailMock.mockResolvedValue({ ok: true, delivery: "sent" });

    const res = await PUT(putRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; requested: boolean };
    expect(body).toEqual({ ok: true, requested: true });

    expect(issueEmailVerificationTokenMock).toHaveBeenCalledWith("u1");
    expect(sendEmailVerificationEmailMock).toHaveBeenCalledTimes(1);
    const arg = sendEmailVerificationEmailMock.mock.calls[0][0] as {
      user: { id: string; email: string; language: string };
      token: string;
    };
    expect(arg.user.id).toBe("u1");
    expect(arg.user.email).toBe("u@example.com");
    expect(arg.user.language).toBe("es");
    expect(arg.token).toBe("raw-verify");
  });
});
