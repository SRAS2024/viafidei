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

// The route confirms (read-only) that the token table exists before doing any
// recovery work. Stub it healthy; tests/security/no-ddl-in-auth.test.ts covers
// the probe itself.
vi.mock("@/lib/security/auth-storage", () => ({
  checkAuthTokenStorage: vi.fn().mockResolvedValue({ ok: true }),
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

  it("returns the same opaque 200 for an unknown address, and issues no token", async () => {
    // Enumeration-safe: an unauthenticated caller must not be able to learn
    // that "ghost@example.com" has no account here. See
    // tests/security/forgot-password-enumeration.test.ts for the full
    // equivalence contract.
    findUserByEmailMock.mockResolvedValue(null);
    const res = await POST(buildRequest({ email: "ghost@example.com" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true, sent: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(issuePasswordResetTokenMock).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("issues a token and sends the reset email, without echoing the address back", async () => {
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
    const body = (await res.json()) as Record<string, unknown>;
    // Same body an unknown address gets, and it names no account.
    expect(body).toEqual({ ok: true, sent: true });

    // The delivery work runs off the response path so the two branches cost
    // the same wall-clock time; wait for it before asserting on it.
    await vi.waitFor(() => expect(issuePasswordResetTokenMock).toHaveBeenCalledWith("u1"));
    await vi.waitFor(() => expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1));
    const arg = sendPasswordResetEmailMock.mock.calls[0][0] as {
      user: { id: string; email: string };
      token: string;
    };
    expect(arg.user.id).toBe("u1");
    expect(arg.user.email).toBe("user@example.com");
    expect(arg.token).toBe("raw-token-123");
  });

  it("keeps a Resend rejection out of the public response", async () => {
    // The provider's error text used to be handed to the caller. It named
    // the sender domain and the key's restrictions — deployment detail an
    // unauthenticated caller has no business reading — and it only appeared
    // for addresses that HAVE an account, which was itself the oracle. It
    // now lives in the operator log only.
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
    sendPasswordResetEmailMock.mockResolvedValue({
      ok: false,
      reason: "delivery_failed",
      errorName: "validation_error",
      errorMessage: "Domain not verified",
    });

    const res = await POST(buildRequest({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true, sent: true });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("validation_error");
    expect(serialized).not.toContain("Domain not verified");
  });

  it("keeps 'the provider is not configured' out of the public response", async () => {
    // The send was a no-op because Resend isn't configured. That is an
    // operational fact about the deployment; it goes to the log, not to an
    // anonymous caller who would otherwise learn it only for real accounts.
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
    sendPasswordResetEmailMock.mockResolvedValue({
      ok: true,
      delivery: "skipped",
      reason: "not_configured",
    });

    const res = await POST(buildRequest({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true, sent: true });
    expect(JSON.stringify(body)).not.toMatch(/not_configured|email_not_configured/);
  });
});
