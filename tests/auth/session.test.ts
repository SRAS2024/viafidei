import { afterEach, describe, expect, it, vi } from "vitest";

describe("session cookie options", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("marks the cookie HttpOnly and SameSite=lax always", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const mod = await import("@/lib/auth/session");
    expect(mod.sessionOptions.cookieOptions?.httpOnly).toBe(true);
    expect(mod.sessionOptions.cookieOptions?.sameSite).toBe("lax");
    expect(mod.sessionOptions.cookieOptions?.path).toBe("/");
  });

  it("does NOT set Secure in development (so localhost http still works)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const mod = await import("@/lib/auth/session");
    expect(mod.sessionOptions.cookieOptions?.secure).toBe(false);
  });

  it("sets Secure in production so the cookie cannot ride over plain HTTP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const mod = await import("@/lib/auth/session");
    expect(mod.sessionOptions.cookieOptions?.secure).toBe(true);
  });

  it("pins the cookie name as the documented constant", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const mod = await import("@/lib/auth/session");
    expect(mod.SESSION_COOKIE_NAME).toBe("vf_session");
    expect(mod.sessionOptions.cookieName).toBe("vf_session");
  });

  it("refuses to resolve a missing SESSION_SECRET at request time in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NEXT_PHASE", "");
    vi.resetModules();
    const mod = await import("@/lib/auth/session");
    // Accessing `.password` on the options object triggers the getter and
    // therefore the production guard. The guard intentionally throws so a
    // missing secret never silently falls back to the dev string.
    expect(() => mod.sessionOptions.password).toThrow(/SESSION_SECRET/);
  });

  it("accepts a 32+ character SESSION_SECRET in production without throwing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "a".repeat(64));
    vi.resetModules();
    const mod = await import("@/lib/auth/session");
    expect(() => mod.sessionOptions.password).not.toThrow();
    expect(mod.sessionOptions.password).toBe("a".repeat(64));
  });
});
