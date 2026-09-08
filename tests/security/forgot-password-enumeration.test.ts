import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const rateLimitMock = vi.fn();
const findUserByEmailMock = vi.fn();
const issuePasswordResetTokenMock = vi.fn();
const sendPasswordResetEmailMock = vi.fn();
const checkAuthTokenStorageMock = vi.fn();

vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
    "@/lib/security/rate-limit",
  );
  return { ...actual, rateLimit: (...args: unknown[]) => rateLimitMock(...args) };
});

vi.mock("@/lib/auth", () => ({
  findUserByEmail: (...args: unknown[]) => findUserByEmailMock(...args),
  issuePasswordResetToken: (...args: unknown[]) => issuePasswordResetTokenMock(...args),
}));

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
}));

vi.mock("@/lib/security/auth-storage", () => ({
  checkAuthTokenStorage: (...args: unknown[]) => checkAuthTokenStorageMock(...args),
}));

import { POST } from "@/app/api/auth/forgot-password/route";

const KNOWN = "member@example.com";
const UNKNOWN = "nobody@example.com";

const KNOWN_USER = {
  id: "u1",
  email: KNOWN,
  firstName: "Pio",
  lastName: "P",
  language: "en",
};

function buildRequest(email: string): NextRequest {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify({ email }),
  }) as unknown as NextRequest;
}

/** Everything an unauthenticated caller can observe about one response. */
async function observe(email: string) {
  const res = await POST(buildRequest(email));
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
    contentType: res.headers.get("content-type"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 2, resetAt: Date.now() + 60_000 });
  findUserByEmailMock.mockImplementation(async (email: string) =>
    email === KNOWN ? KNOWN_USER : null,
  );
  issuePasswordResetTokenMock.mockResolvedValue({
    token: "raw-token-never-leaves-the-server",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  sendPasswordResetEmailMock.mockResolvedValue({ ok: true, delivery: "sent" });
  checkAuthTokenStorageMock.mockResolvedValue({ ok: true });
});

describe("forgot-password — a caller cannot tell whether the account exists", () => {
  it("returns the identical status, body and content-type for both addresses", async () => {
    const registered = await observe(KNOWN);
    const unregistered = await observe(UNKNOWN);
    expect(registered.status).toBe(200);
    expect(registered).toEqual(unregistered);
    expect(registered.body).toEqual({ ok: true, sent: true });
  });

  it("never answers 404 for an unknown address", async () => {
    const { status, body } = await observe(UNKNOWN);
    expect(status).not.toBe(404);
    expect(body.error).toBeUndefined();
  });

  it("does not echo the account's email address back", async () => {
    const { body } = await observe(KNOWN);
    expect(JSON.stringify(body)).not.toContain(KNOWN);
  });

  it("never returns the reset token or any part of it", async () => {
    const { body } = await observe(KNOWN);
    expect(JSON.stringify(body)).not.toContain("raw-token-never-leaves-the-server");
  });
});

describe("forgot-password — provider and database failures stay internal", () => {
  it("answers identically when Resend rejects the send", async () => {
    sendPasswordResetEmailMock.mockResolvedValue({
      ok: false,
      reason: "delivery_failed",
      errorName: "validation_error",
      errorMessage: "Domain not verified",
      statusCode: 403,
    });
    const registered = await observe(KNOWN);
    expect(registered.status).toBe(200);
    expect(registered.body).toEqual({ ok: true, sent: true });
    const serialized = JSON.stringify(registered.body);
    expect(serialized).not.toContain("validation_error");
    expect(serialized).not.toContain("Domain not verified");
  });

  it("answers identically when the email provider is not configured", async () => {
    sendPasswordResetEmailMock.mockResolvedValue({
      ok: true,
      delivery: "skipped",
      reason: "not_configured",
    });
    expect((await observe(KNOWN)).body).toEqual({ ok: true, sent: true });
  });

  it("answers identically when the token table is missing, and issues no token", async () => {
    // Fail closed: the flow refuses to run rather than repairing the schema,
    // and the caller learns nothing about the database's state.
    checkAuthTokenStorageMock.mockResolvedValue({
      ok: false,
      reason: "missing_tables",
      missing: ["PasswordResetToken"],
    });
    const registered = await observe(KNOWN);
    expect(registered.status).toBe(200);
    expect(JSON.stringify(registered.body)).not.toMatch(/PasswordResetToken|relation|table/i);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(issuePasswordResetTokenMock).not.toHaveBeenCalled();
  });

  it("answers identically when the token write throws", async () => {
    issuePasswordResetTokenMock.mockRejectedValue(
      new Error('relation "PasswordResetToken" does not exist'),
    );
    const registered = await observe(KNOWN);
    expect(registered.status).toBe(200);
    expect(registered.body).toEqual({ ok: true, sent: true });
  });

  it("answers identically when the user lookup itself throws", async () => {
    findUserByEmailMock.mockRejectedValue(new Error("connection refused"));
    const failed = await observe(KNOWN);
    expect(failed.status).toBe(200);
    expect(failed.body).toEqual({ ok: true, sent: true });
    expect(JSON.stringify(failed.body)).not.toContain("connection refused");
  });
});

describe("forgot-password — the recovery flow itself still works", () => {
  it("issues a token and sends the email for a registered address", async () => {
    await observe(KNOWN);
    await vi.waitFor(() => expect(issuePasswordResetTokenMock).toHaveBeenCalledWith("u1"));
    await vi.waitFor(() => expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1));
    const arg = sendPasswordResetEmailMock.mock.calls[0]![0] as {
      user: { id: string };
      token: string;
      expiresAt: Date;
    };
    expect(arg.user.id).toBe("u1");
    expect(arg.token).toBe("raw-token-never-leaves-the-server");
  });

  it("does no work at all for an unregistered address", async () => {
    await observe(UNKNOWN);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(issuePasswordResetTokenMock).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });
});

describe("forgot-password — request-shaped errors are still distinguishable", () => {
  it("rejects a malformed email with 400 (a property of the request, not the account)", async () => {
    const res = await POST(buildRequest("not-an-email"));
    expect(res.status).toBe(400);
  });

  it("rate-limits identically for both addresses", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const registered = await observe(KNOWN);
    const unregistered = await observe(UNKNOWN);
    expect(registered.status).toBe(429);
    expect(registered).toEqual(unregistered);
    expect(findUserByEmailMock).not.toHaveBeenCalled();
  });
});

describe("forgot-password — the timing channel is closed too", () => {
  it("does not wait for the email round-trip, so both paths return in the same time", async () => {
    // A 300ms provider call is unremarkable for a real SMTP/API send. If the
    // route awaited it, the registered address would answer ~300ms slower
    // than the unregistered one and the oracle would be back — identical
    // bodies or not.
    const PROVIDER_LATENCY_MS = 300;
    sendPasswordResetEmailMock.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, delivery: "sent" }), PROVIDER_LATENCY_MS),
        ),
    );

    const startKnown = Date.now();
    await observe(KNOWN);
    const knownMs = Date.now() - startKnown;

    const startUnknown = Date.now();
    await observe(UNKNOWN);
    const unknownMs = Date.now() - startUnknown;

    expect(knownMs).toBeLessThan(PROVIDER_LATENCY_MS / 2);
    expect(Math.abs(knownMs - unknownMs)).toBeLessThan(PROVIDER_LATENCY_MS / 4);
  });
});
