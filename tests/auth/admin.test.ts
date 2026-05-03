import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCookieJar } from "../helpers/cookies-mock";

const cookieJar = createCookieJar();
vi.mock("next/headers", () => ({
  cookies: () => cookieJar,
}));

import { requireAdmin, verifyAdminCredentials } from "@/lib/auth/admin";

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verifyAdminCredentials", () => {
  it("returns true only when both username and password match the env vars", () => {
    vi.stubEnv("ADMIN_USERNAME", "root");
    vi.stubEnv("ADMIN_PASSWORD", "super-secret-admin-password");
    expect(verifyAdminCredentials("root", "super-secret-admin-password")).toBe(true);
  });

  it("returns false when the username is wrong", () => {
    vi.stubEnv("ADMIN_USERNAME", "root");
    vi.stubEnv("ADMIN_PASSWORD", "super-secret-admin-password");
    expect(verifyAdminCredentials("not-root", "super-secret-admin-password")).toBe(false);
  });

  it("returns false when the password is wrong", () => {
    vi.stubEnv("ADMIN_USERNAME", "root");
    vi.stubEnv("ADMIN_PASSWORD", "super-secret-admin-password");
    expect(verifyAdminCredentials("root", "WRONG")).toBe(false);
  });

  it("returns false when env vars are missing (admin disabled)", () => {
    vi.stubEnv("ADMIN_USERNAME", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(verifyAdminCredentials("root", "anything")).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("returns null when no admin session is present", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof sessionModule.getSession>>,
    );
    expect(await requireAdmin()).toBeNull();
  });

  it("returns null when the session role is USER", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({
      role: "USER",
      adminSignedInAt: Date.now(),
    } as unknown as Awaited<ReturnType<typeof sessionModule.getSession>>);
    expect(await requireAdmin()).toBeNull();
  });

  it("returns a principal when the session is ADMIN with a sign-in timestamp", async () => {
    vi.stubEnv("ADMIN_USERNAME", "root");
    const sessionModule = await import("@/lib/auth/session");
    const signedInAt = 1_700_000_000_000;
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({
      role: "ADMIN",
      adminSignedInAt: signedInAt,
      userEmail: "admin@example.com",
    } as unknown as Awaited<ReturnType<typeof sessionModule.getSession>>);

    const principal = await requireAdmin();
    expect(principal).toEqual({ username: "admin@example.com", signedInAt });
  });

  it("falls back to ADMIN_USERNAME when no userEmail is on the session", async () => {
    vi.stubEnv("ADMIN_USERNAME", "root");
    const sessionModule = await import("@/lib/auth/session");
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({
      role: "ADMIN",
      adminSignedInAt: 42,
    } as unknown as Awaited<ReturnType<typeof sessionModule.getSession>>);

    const principal = await requireAdmin();
    expect(principal).toEqual({ username: "root", signedInAt: 42 });
  });
});
