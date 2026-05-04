import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitMock = vi.fn();
const findUserByEmailMock = vi.fn();
const issuePasswordResetTokenMock = vi.fn();
const sendPasswordResetEmailMock = vi.fn();

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
  findUserByEmail: (...args: unknown[]) => findUserByEmailMock(...args),
  issuePasswordResetToken: (...args: unknown[]) => issuePasswordResetTokenMock(...args),
}));

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
}));

import { POST } from "@/app/api/auth/forgot-password/route";
import type { NextRequest } from "next/server";

function buildRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.1" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  rateLimitMock.mockReset();
  findUserByEmailMock.mockReset();
  issuePasswordResetTokenMock.mockReset();
  sendPasswordResetEmailMock.mockReset();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 2, resetAt: Date.now() + 60_000 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/auth/forgot-password", () => {
  it("returns 400 invalid for malformed email", async () => {
    const res = await POST(buildRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid");
  });

  it("returns 429 rate_limited when limiter rejects (forgot password rate limit)", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const res = await POST(buildRequest({ email: "user@example.com" }));
    expect(res.status).toBe(429);
    expect(findUserByEmailMock).not.toHaveBeenCalled();
  });

  it("returns the same generic 200 success for unknown emails (privacy-safe)", async () => {
    findUserByEmailMock.mockResolvedValue(null);
    const res = await POST(buildRequest({ email: "ghost@example.com" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; accepted: boolean };
    expect(body).toEqual({ ok: true, accepted: true });
    expect(issuePasswordResetTokenMock).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("issues a token and sends a password reset email when the user exists", async () => {
    const user = {
      id: "u1",
      email: "user@example.com",
      firstName: "Pio",
      lastName: "P",
      language: "en",
    };
    findUserByEmailMock.mockResolvedValue(user);
    issuePasswordResetTokenMock.mockResolvedValue({
      token: "raw-token-123",
      expiresAt: new Date(Date.now() + 60_000),
    });
    sendPasswordResetEmailMock.mockResolvedValue({ ok: true, delivery: "sent" });

    const res = await POST(buildRequest({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; accepted: boolean };
    expect(body).toEqual({ ok: true, accepted: true });

    expect(issuePasswordResetTokenMock).toHaveBeenCalledWith("u1");
    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
    const arg = sendPasswordResetEmailMock.mock.calls[0][0] as {
      user: { id: string; email: string };
      token: string;
    };
    expect(arg.user.id).toBe("u1");
    expect(arg.user.email).toBe("user@example.com");
    expect(arg.token).toBe("raw-token-123");
  });

  it("still returns the generic 200 success when email delivery fails (no leak)", async () => {
    findUserByEmailMock.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      firstName: "Pio",
      lastName: "P",
      language: "en",
    });
    issuePasswordResetTokenMock.mockResolvedValue({
      token: "raw-token",
      expiresAt: new Date(Date.now() + 60_000),
    });
    sendPasswordResetEmailMock.mockResolvedValue({ ok: false, reason: "not_configured" });

    const res = await POST(buildRequest({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
