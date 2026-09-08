import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCookieJar } from "../helpers/cookies-mock";

const cookieJar = createCookieJar();
vi.mock("next/headers", () => ({
  cookies: () => cookieJar,
}));

const resolveAdminSessionMock = vi.fn();
const revokeAdminSessionMock = vi.fn();
vi.mock("@/lib/auth/admin-session", () => ({
  resolveAdminSession: (...args: unknown[]) => resolveAdminSessionMock(...args),
  revokeAdminSession: (...args: unknown[]) => revokeAdminSessionMock(...args),
}));

import { requireAdmin, resolveAdminPrincipal, verifyAdminCredentials } from "@/lib/auth/admin";

beforeEach(() => {
  vi.unstubAllEnvs();
  resolveAdminSessionMock.mockReset();
  revokeAdminSessionMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Install a fake session cookie payload for the next requireAdmin() call. */
async function withSession(data: Record<string, unknown>) {
  const sessionModule = await import("@/lib/auth/session");
  vi.spyOn(sessionModule, "getSession").mockResolvedValue(
    data as unknown as Awaited<ReturnType<typeof sessionModule.getSession>>,
  );
}

function liveRecord(overrides: Record<string, unknown> = {}) {
  return {
    valid: true as const,
    record: {
      storedId: "stored",
      adminUsername: "admin@example.com",
      stage: "AUTHENTICATED" as const,
      authenticatedAt: new Date(1_700_000_000_000),
      twoFactorVerifiedAt: new Date(1_700_000_060_000),
      lastActivityAt: new Date(),
      absoluteExpiresAt: new Date(Date.now() + 3_600_000),
      idleExpiresAt: new Date(Date.now() + 600_000),
      revokedAt: null,
      ...overrides,
    },
  };
}

// verifyAdminCredentials became async: the password now goes through Argon2id
// (verifyAdminPassword), which has no synchronous API. The assertions await
// the call instead of comparing a Promise to a boolean.
describe("verifyAdminCredentials", () => {
  it("returns true only when both username and password match the env vars", async () => {
    vi.stubEnv("ADMIN_USERNAME", "root");
    vi.stubEnv("ADMIN_PASSWORD", "super-secret-admin-password");
    expect(await verifyAdminCredentials("root", "super-secret-admin-password")).toBe(true);
  });

  it("authenticates against an Argon2-hashed ADMIN_PASSWORD", async () => {
    const { hashPassword } = await import("@/lib/auth/password");
    vi.stubEnv("ADMIN_USERNAME", "root");
    vi.stubEnv("ADMIN_PASSWORD", await hashPassword("super-secret-admin-password"));
    expect(await verifyAdminCredentials("root", "super-secret-admin-password")).toBe(true);
    expect(await verifyAdminCredentials("root", "WRONG")).toBe(false);
  });

  it("returns false when the username is wrong", async () => {
    vi.stubEnv("ADMIN_USERNAME", "root");
    vi.stubEnv("ADMIN_PASSWORD", "super-secret-admin-password");
    expect(await verifyAdminCredentials("not-root", "super-secret-admin-password")).toBe(false);
  });

  it("returns false when the password is wrong", async () => {
    vi.stubEnv("ADMIN_USERNAME", "root");
    vi.stubEnv("ADMIN_PASSWORD", "super-secret-admin-password");
    expect(await verifyAdminCredentials("root", "WRONG")).toBe(false);
  });

  it("returns false when env vars are missing (admin disabled)", async () => {
    vi.stubEnv("ADMIN_USERNAME", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(await verifyAdminCredentials("root", "anything")).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("returns null when no admin session is present", async () => {
    await withSession({});
    expect(await requireAdmin()).toBeNull();
    expect(resolveAdminSessionMock).not.toHaveBeenCalled();
  });

  it("returns null when the session role is USER", async () => {
    await withSession({ role: "USER", adminSignedInAt: Date.now() });
    expect(await requireAdmin()).toBeNull();
  });

  /**
   * Spec item 3: a cookie that merely says role=ADMIN is not an admin. Without
   * a server-side session id there is nothing to expire, revoke or prove the
   * second factor with, so the request is refused.
   */
  it("returns null for a role=ADMIN cookie with no server-side session id", async () => {
    await withSession({ role: "ADMIN", adminSignedInAt: Date.now() });
    const outcome = await resolveAdminPrincipal();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("no_server_session");
    expect(await requireAdmin()).toBeNull();
    expect(resolveAdminSessionMock).not.toHaveBeenCalled();
  });

  /** A password-verified, 2FA-outstanding session must never pass. */
  it("returns null for a PENDING (password-only) session", async () => {
    await withSession({
      adminSessionId: "sid",
      adminAuthStage: "PENDING",
      adminSignedInAt: Date.now(),
    });
    const outcome = await resolveAdminPrincipal();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("pending_two_factor");
    // Refused on the cookie alone — the store is not even consulted.
    expect(resolveAdminSessionMock).not.toHaveBeenCalled();
  });

  it("returns null when the cookie claims AUTHENTICATED but the role is missing", async () => {
    await withSession({ adminSessionId: "sid", adminAuthStage: "AUTHENTICATED" });
    const outcome = await resolveAdminPrincipal();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("pending_two_factor");
  });

  it("returns a principal when the server-side session is authenticated and live", async () => {
    vi.stubEnv("ADMIN_USERNAME", "admin@example.com");
    resolveAdminSessionMock.mockResolvedValue(liveRecord());
    await withSession({
      role: "ADMIN",
      adminAuthStage: "AUTHENTICATED",
      adminSessionId: "sid",
      userEmail: "admin@example.com",
      adminSignedInAt: 1,
    });

    const principal = await requireAdmin();
    expect(principal).toEqual({
      username: "admin@example.com",
      // Taken from the server-side record, not the client-visible cookie.
      signedInAt: 1_700_000_000_000,
      adminSessionId: "sid",
      twoFactorVerifiedAt: 1_700_000_060_000,
    });
  });

  it("falls back to ADMIN_USERNAME when the record carries no username", async () => {
    vi.stubEnv("ADMIN_USERNAME", "root");
    resolveAdminSessionMock.mockResolvedValue(liveRecord({ adminUsername: "" }));
    await withSession({
      role: "ADMIN",
      adminAuthStage: "AUTHENTICATED",
      adminSessionId: "sid",
    });
    const principal = await requireAdmin();
    expect(principal?.username).toBe("root");
  });

  for (const reason of ["revoked", "expired_absolute", "expired_idle", "no_server_session"]) {
    it(`returns null when the server-side session is ${reason}`, async () => {
      resolveAdminSessionMock.mockResolvedValue({ valid: false, reason });
      await withSession({
        role: "ADMIN",
        adminAuthStage: "AUTHENTICATED",
        adminSessionId: "sid",
      });
      const outcome = await resolveAdminPrincipal();
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toBe(reason);
      expect(await requireAdmin()).toBeNull();
    });
  }

  /** Spec item 9: an undeterminable authorization state denies. */
  it("FAILS CLOSED when the session store cannot be read", async () => {
    resolveAdminSessionMock.mockResolvedValue({ valid: false, reason: "indeterminate" });
    await withSession({
      role: "ADMIN",
      adminAuthStage: "AUTHENTICATED",
      adminSessionId: "sid",
    });
    const outcome = await resolveAdminPrincipal();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("indeterminate");
    expect(await requireAdmin()).toBeNull();
  });

  it("FAILS CLOSED (without throwing) when the session cookie cannot be read", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.spyOn(sessionModule, "getSession").mockRejectedValue(new Error("bad cookie"));
    await expect(requireAdmin()).resolves.toBeNull();
  });
});

/**
 * Spec item 3: invalidate when the authentication state itself becomes
 * invalid, not only at sign-out.
 */
describe("sessions minted for a previous admin identity are revoked", () => {
  it("denies and revokes when ADMIN_USERNAME no longer matches the session record", async () => {
    vi.stubEnv("ADMIN_USERNAME", "rotated-admin");
    resolveAdminSessionMock.mockResolvedValue(liveRecord());
    await withSession({
      role: "ADMIN",
      adminAuthStage: "AUTHENTICATED",
      adminSessionId: "sid",
    });
    const outcome = await resolveAdminPrincipal();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("revoked");
    expect(revokeAdminSessionMock).toHaveBeenCalledWith("sid", "admin_identity_changed");
  });

  it("leaves a matching identity alone", async () => {
    vi.stubEnv("ADMIN_USERNAME", "admin@example.com");
    resolveAdminSessionMock.mockResolvedValue(liveRecord());
    await withSession({
      role: "ADMIN",
      adminAuthStage: "AUTHENTICATED",
      adminSessionId: "sid",
    });
    expect((await resolveAdminPrincipal()).ok).toBe(true);
    expect(revokeAdminSessionMock).not.toHaveBeenCalled();
  });
});
