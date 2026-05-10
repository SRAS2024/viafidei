import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// End-to-end behavior tests for the account email pipeline. Each test
// here pins a piece of contract that the task description spells out
// explicitly: missing token tables emit operator logs, Resend delivery
// failures surface to the caller (never silently treated as success),
// missing RESEND_API_KEY produces a clear operator log, and the resend
// verification UI gates correctly behind unverified accounts.

const rateLimitMock = vi.fn();
const findUserByEmailMock = vi.fn();
const issuePasswordResetTokenMock = vi.fn();
const issueEmailVerificationTokenMock = vi.fn();
const consumePasswordResetTokenMock = vi.fn();
const consumeEmailVerificationTokenMock = vi.fn();
const sendPasswordResetEmailMock = vi.fn();
const sendEmailVerificationEmailMock = vi.fn();
const sendWelcomeEmailMock = vi.fn();
const requireUserMock = vi.fn();
const userFindUniqueMock = vi.fn();

vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
    "@/lib/security/rate-limit",
  );
  return { ...actual, rateLimit: (...args: unknown[]) => rateLimitMock(...args) };
});

vi.mock("@/lib/auth", async () => {
  // Pull the real Zod schemas so the routes' .safeParse() calls behave
  // identically to production. Only the imperative auth functions are
  // mocked — the validation contract (15-minute TTL is irrelevant here;
  // we hand-craft the consume mock results) stays exact.
  const actual = await vi.importActual<typeof import("@/lib/auth/schemas")>("@/lib/auth/schemas");
  return {
    ...actual,
    findUserByEmail: (...args: unknown[]) => findUserByEmailMock(...args),
    issuePasswordResetToken: (...args: unknown[]) => issuePasswordResetTokenMock(...args),
    issueEmailVerificationToken: (...args: unknown[]) => issueEmailVerificationTokenMock(...args),
    consumePasswordResetToken: (...args: unknown[]) => consumePasswordResetTokenMock(...args),
    consumeEmailVerificationToken: (...args: unknown[]) =>
      consumeEmailVerificationTokenMock(...args),
    requireUser: (...args: unknown[]) => requireUserMock(...args),
  };
});

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
  sendEmailVerificationEmail: (...args: unknown[]) => sendEmailVerificationEmailMock(...args),
  sendWelcomeEmail: (...args: unknown[]) => sendWelcomeEmailMock(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => userFindUniqueMock(...args) },
  },
}));

beforeEach(() => {
  rateLimitMock.mockReset();
  findUserByEmailMock.mockReset();
  issuePasswordResetTokenMock.mockReset();
  issueEmailVerificationTokenMock.mockReset();
  consumePasswordResetTokenMock.mockReset();
  consumeEmailVerificationTokenMock.mockReset();
  sendPasswordResetEmailMock.mockReset();
  sendEmailVerificationEmailMock.mockReset();
  sendWelcomeEmailMock.mockReset();
  requireUserMock.mockReset();
  userFindUniqueMock.mockReset();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 5, resetAt: Date.now() + 60_000 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function jsonReq(url: string, body: unknown, method = "POST"): NextRequest {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const VALID_RESET_TOKEN = "r".repeat(40);
const VALID_VERIFY_TOKEN = "v".repeat(40);

describe("forgot-password — Resend delivery failures are surfaced (never silently treated as success)", () => {
  it("returns server_error/delivery_failed when Resend rejects the send", async () => {
    findUserByEmailMock.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      firstName: "Pio",
      lastName: "P",
      language: "en",
    });
    issuePasswordResetTokenMock.mockResolvedValue({
      token: "tok",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    sendPasswordResetEmailMock.mockResolvedValue({
      ok: false,
      reason: "delivery_failed",
      errorName: "validation_error",
      errorMessage: "Domain not verified",
    });
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(
      jsonReq("http://x/api/auth/forgot-password", { email: "user@example.com" }),
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; error: string; message: string };
    expect(body.ok).toBe(false);
    expect(body.message).toBe("delivery_failed");
  });

  it("returns server_error/email_not_configured when RESEND_API_KEY is missing (skipped delivery)", async () => {
    findUserByEmailMock.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      firstName: "Pio",
      lastName: "P",
      language: "en",
    });
    issuePasswordResetTokenMock.mockResolvedValue({
      token: "tok",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    sendPasswordResetEmailMock.mockResolvedValue({
      ok: true,
      delivery: "skipped",
      reason: "not_configured",
    });
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(
      jsonReq("http://x/api/auth/forgot-password", { email: "user@example.com" }),
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; error: string; message: string };
    expect(body.message).toBe("email_not_configured");
  });

  it("never returns sent:true when delivery failed — sent:true requires Resend to have accepted the message", async () => {
    findUserByEmailMock.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      firstName: "Pio",
      lastName: "P",
      language: "en",
    });
    issuePasswordResetTokenMock.mockResolvedValue({
      token: "tok",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    sendPasswordResetEmailMock.mockResolvedValue({ ok: false, reason: "delivery_failed" });
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(
      jsonReq("http://x/api/auth/forgot-password", { email: "user@example.com" }),
    );
    const body = (await res.json()) as { sent?: boolean; ok: boolean };
    expect(body.sent).toBeUndefined();
    expect(body.ok).toBe(false);
  });
});

describe("forgot-password — missing database token tables produce clear operator logs", () => {
  it("logs database_table_missing AND returns token_creation_failed when PasswordResetToken is missing", async () => {
    // Prior to this contract, a missing PasswordResetToken table produced
    // a generic `delivery_failed` response — indistinguishable in the
    // network tab from a Resend rejection. The route now returns
    // `token_creation_failed` so the admin can see at a glance that this
    // is a database problem, while the operator log line names the
    // missing table exactly.
    findUserByEmailMock.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      firstName: "Pio",
      lastName: "P",
      language: "en",
    });
    issuePasswordResetTokenMock.mockRejectedValue(
      new Error('relation "PasswordResetToken" does not exist'),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(
      jsonReq("http://x/api/auth/forgot-password", { email: "user@example.com" }),
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      message: string;
      details?: { reason?: string };
    };
    expect(body.message).toBe("token_creation_failed");
    expect(body.details?.reason).toBe("database_table_missing");
    const log = errSpy.mock.calls
      .map((c) => String(c[0] ?? ""))
      .find((s) => s.includes('"msg":"auth.password_reset.flow_failed"'));
    expect(log).toBeTruthy();
    if (log) {
      expect(log).toContain('"kind":"database_table_missing"');
    }
    errSpy.mockRestore();
  });
});

describe("resend verification (PUT /api/auth/verify-email)", () => {
  it("only succeeds when the email was actually sent (delivery failures surface as server_error)", async () => {
    requireUserMock.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      emailVerifiedAt: null,
    });
    userFindUniqueMock.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      firstName: "Pio",
      lastName: "P",
      language: "en",
    });
    issueEmailVerificationTokenMock.mockResolvedValue({
      token: "tok",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    sendEmailVerificationEmailMock.mockResolvedValue({ ok: false, reason: "delivery_failed" });
    const { PUT } = await import("@/app/api/auth/verify-email/route");
    const res = await PUT(
      new Request("http://x/api/auth/verify-email", { method: "PUT" }) as unknown as NextRequest,
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(false);
    expect(body.message).toBe("delivery_failed");
  });

  it("returns email_not_configured when RESEND_API_KEY is unset (skipped delivery)", async () => {
    requireUserMock.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      emailVerifiedAt: null,
    });
    userFindUniqueMock.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      firstName: "Pio",
      lastName: "P",
      language: "en",
    });
    issueEmailVerificationTokenMock.mockResolvedValue({
      token: "tok",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    sendEmailVerificationEmailMock.mockResolvedValue({
      ok: true,
      delivery: "skipped",
      reason: "not_configured",
    });
    const { PUT } = await import("@/app/api/auth/verify-email/route");
    const res = await PUT(
      new Request("http://x/api/auth/verify-email", { method: "PUT" }) as unknown as NextRequest,
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; message: string };
    expect(body.message).toBe("email_not_configured");
  });

  it("logs token_creation_failed and returns server_error when EmailVerificationToken table is missing", async () => {
    requireUserMock.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      emailVerifiedAt: null,
    });
    userFindUniqueMock.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      firstName: "Pio",
      lastName: "P",
      language: "en",
    });
    issueEmailVerificationTokenMock.mockRejectedValue(
      new Error('relation "EmailVerificationToken" does not exist'),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { PUT } = await import("@/app/api/auth/verify-email/route");
    const res = await PUT(
      new Request("http://x/api/auth/verify-email", { method: "PUT" }) as unknown as NextRequest,
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("token_creation_failed");
    const log = errSpy.mock.calls
      .map((c) => String(c[0] ?? ""))
      .find((s) => s.includes('"msg":"auth.email_verification.token_creation_failed"'));
    expect(log).toBeTruthy();
    if (log) expect(log).toContain('"kind":"database_table_missing"');
    errSpy.mockRestore();
  });

  it("does not issue a token for an already-verified account", async () => {
    requireUserMock.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      emailVerifiedAt: new Date("2025-01-01T00:00:00Z"),
    });
    const { PUT } = await import("@/app/api/auth/verify-email/route");
    const res = await PUT(
      new Request("http://x/api/auth/verify-email", { method: "PUT" }) as unknown as NextRequest,
    );
    expect(res.status).toBe(409);
    expect(issueEmailVerificationTokenMock).not.toHaveBeenCalled();
    expect(sendEmailVerificationEmailMock).not.toHaveBeenCalled();
  });
});

describe("verify-email POST — token consumption", () => {
  it("returns invalid+expired for tokens past their TTL", async () => {
    consumeEmailVerificationTokenMock.mockResolvedValue({ ok: false, reason: "expired" });
    const { POST } = await import("@/app/api/auth/verify-email/route");
    const res = await POST(
      jsonReq("http://x/api/auth/verify-email", { token: VALID_VERIFY_TOKEN }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("expired");
  });

  it("returns invalid+used when the token has already been consumed", async () => {
    consumeEmailVerificationTokenMock.mockResolvedValue({ ok: false, reason: "used" });
    const { POST } = await import("@/app/api/auth/verify-email/route");
    const res = await POST(
      jsonReq("http://x/api/auth/verify-email", { token: VALID_VERIFY_TOKEN }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("used");
  });

  it("logs database_table_missing when consumption throws a missing-relation error", async () => {
    consumeEmailVerificationTokenMock.mockRejectedValue(
      new Error('relation "EmailVerificationToken" does not exist'),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("@/app/api/auth/verify-email/route");
    const res = await POST(
      jsonReq("http://x/api/auth/verify-email", { token: VALID_VERIFY_TOKEN }),
    );
    expect(res.status).toBe(500);
    const log = errSpy.mock.calls
      .map((c) => String(c[0] ?? ""))
      .find((s) => s.includes('"msg":"auth.email_verification.consume_failed"'));
    expect(log).toBeTruthy();
    if (log) expect(log).toContain('"kind":"database_table_missing"');
    errSpy.mockRestore();
  });
});

describe("reset-password POST — token consumption", () => {
  it("returns invalid+expired for tokens past their 15-minute TTL", async () => {
    consumePasswordResetTokenMock.mockResolvedValue({ ok: false, reason: "expired" });
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(
      jsonReq("http://x/api/auth/reset-password", {
        token: VALID_RESET_TOKEN,
        password: "Newp4ss!",
        passwordConfirm: "Newp4ss!",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("expired");
  });

  it("returns invalid+used when the token has already been consumed (cannot be reused)", async () => {
    consumePasswordResetTokenMock.mockResolvedValue({ ok: false, reason: "used" });
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(
      jsonReq("http://x/api/auth/reset-password", {
        token: VALID_RESET_TOKEN,
        password: "Newp4ss!",
        passwordConfirm: "Newp4ss!",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("used");
  });

  it("logs database_table_missing when consumption throws a missing-relation error", async () => {
    consumePasswordResetTokenMock.mockRejectedValue(
      new Error('relation "PasswordResetToken" does not exist'),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(
      jsonReq("http://x/api/auth/reset-password", {
        token: VALID_RESET_TOKEN,
        password: "Newp4ss!",
        passwordConfirm: "Newp4ss!",
      }),
    );
    expect(res.status).toBe(500);
    const log = errSpy.mock.calls
      .map((c) => String(c[0] ?? ""))
      .find((s) => s.includes('"msg":"auth.password_reset.consume_failed"'));
    expect(log).toBeTruthy();
    if (log) expect(log).toContain('"kind":"database_table_missing"');
    errSpy.mockRestore();
  });
});
