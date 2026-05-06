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

  it("returns 404 not_found for emails with no matching account (no token issued)", async () => {
    // Product decision: surface "no account" explicitly so the user knows
    // they need to register instead. The per-IP rate limit upstream is the
    // mitigation for email enumeration, not response-body opacity.
    findUserByEmailMock.mockResolvedValue(null);
    const res = await POST(buildRequest({ email: "ghost@example.com" }));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("not_found");
    expect(issuePasswordResetTokenMock).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("issues a token, sends a reset email, and returns the typed email back to the caller", async () => {
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
    const body = (await res.json()) as {
      ok: boolean;
      sent: boolean;
      email: string;
    };
    expect(body).toEqual({ ok: true, sent: true, email: "user@example.com" });

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

  it("still returns sent: true when email delivery is silently skipped (Resend down)", async () => {
    // The token is issued; if the delivery layer fails the user must still
    // see a "sent" result, otherwise an outage on Resend would surface to
    // them as an "account doesn't exist" error.
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
    const body = (await res.json()) as { ok: boolean; sent: boolean; email: string };
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(true);
    expect(body.email).toBe("user@example.com");
  });
});
