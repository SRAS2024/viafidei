import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// End-to-end behavior tests for the account email pipeline. Each test
// here pins a piece of contract: missing token tables emit operator logs,
// Resend delivery failures are recorded (never silently treated as
// success), missing RESEND_API_KEY produces a clear operator log, and the
// resend verification UI gates correctly behind unverified accounts.
//
// Password recovery is the one flow whose FAILURES stay off the wire: its
// public response is identical for every address so the endpoint cannot be
// used to enumerate accounts, which means the operator log is the only
// place a delivery problem shows up. Those log assertions are below.

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

// Read-only "do the token tables exist" probe the recovery flow runs before
// doing any work. Healthy by default here; the probe has its own tests in
// tests/security/no-ddl-in-auth.test.ts.
vi.mock("@/lib/security/auth-storage", () => ({
  checkAuthTokenStorage: vi.fn().mockResolvedValue({ ok: true }),
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

/**
 * Read every structured log line a console.error/console.info spy captured.
 * The logger writes one JSON object per call as the first argument.
 */
function loggedLine(spy: ReturnType<typeof vi.spyOn>, msg: string): string | undefined {
  return spy.mock.calls.map((c) => String(c[0] ?? "")).find((s) => s.includes(`"msg":"${msg}"`));
}

const RESET_USER = {
  id: "u1",
  email: "user@example.com",
  firstName: "Pio",
  lastName: "P",
  language: "en",
};

async function postForgotPassword() {
  const { POST } = await import("@/app/api/auth/forgot-password/route");
  return POST(jsonReq("http://x/api/auth/forgot-password", { email: RESET_USER.email }));
}

describe("forgot-password — Resend delivery failures are recorded for the operator, not returned", () => {
  it("logs email_undelivered with Resend's structured cause when the send is rejected", async () => {
    findUserByEmailMock.mockResolvedValue(RESET_USER);
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
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await postForgotPassword();

    // Public response says nothing about the failure.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, sent: true });

    await vi.waitFor(() =>
      expect(loggedLine(errSpy, "auth.password_reset.email_undelivered")).toBeTruthy(),
    );
    const log = loggedLine(errSpy, "auth.password_reset.email_undelivered")!;
    expect(log).toContain('"reason":"delivery_failed"');
    expect(log).toContain('"errorName":"validation_error"');
    expect(log).toContain('"errorMessage":"Domain not verified"');
    // The raw token must never reach a log line.
    expect(log).not.toContain('"tok"');
    errSpy.mockRestore();
  });

  it("logs email_skipped when RESEND_API_KEY is missing (skipped delivery)", async () => {
    findUserByEmailMock.mockResolvedValue(RESET_USER);
    issuePasswordResetTokenMock.mockResolvedValue({
      token: "tok",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    sendPasswordResetEmailMock.mockResolvedValue({
      ok: true,
      delivery: "skipped",
      reason: "not_configured",
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await postForgotPassword();
    expect(res.status).toBe(200);
    await vi.waitFor(() =>
      expect(loggedLine(errSpy, "auth.password_reset.email_skipped")).toBeTruthy(),
    );
    expect(loggedLine(errSpy, "auth.password_reset.email_skipped")).toContain(
      '"reason":"not_configured"',
    );
    errSpy.mockRestore();
  });

  it("never lets a delivery failure change the public response", async () => {
    // `sent: true` is deliberately unconditional — it backs the wording
    // "if an account exists ... instructions have been sent". Varying it on
    // the delivery outcome would leak both the failure AND the account's
    // existence, since only real accounts ever attempt a send.
    findUserByEmailMock.mockResolvedValue(RESET_USER);
    issuePasswordResetTokenMock.mockResolvedValue({
      token: "tok",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    sendPasswordResetEmailMock.mockResolvedValue({ ok: false, reason: "delivery_failed" });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await postForgotPassword();
    const body = (await res.json()) as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, sent: true });
    errSpy.mockRestore();
  });
});

describe("forgot-password — missing database token tables produce clear operator logs", () => {
  it("logs database_table_missing while telling the caller nothing about the database", async () => {
    // The response used to carry `token_creation_failed` +
    // `database_table_missing`, which told an anonymous caller which table
    // this deployment is missing. The diagnosis now lives only in the log
    // line the operator reads (and on /admin/email).
    findUserByEmailMock.mockResolvedValue(RESET_USER);
    issuePasswordResetTokenMock.mockRejectedValue(
      new Error('relation "PasswordResetToken" does not exist'),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await postForgotPassword();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true, sent: true });
    expect(JSON.stringify(body)).not.toMatch(/PasswordResetToken|relation|database/i);

    await vi.waitFor(() =>
      expect(loggedLine(errSpy, "auth.password_reset.flow_failed")).toBeTruthy(),
    );
    const log = loggedLine(errSpy, "auth.password_reset.flow_failed")!;
    expect(log).toContain('"kind":"database_table_missing"');
    expect(log).toContain("PasswordResetToken");
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
        password: "Newp4ss!Strong",
        passwordConfirm: "Newp4ss!Strong",
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
        password: "Newp4ss!Strong",
        passwordConfirm: "Newp4ss!Strong",
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
        password: "Newp4ss!Strong",
        passwordConfirm: "Newp4ss!Strong",
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
