import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("buildPasswordResetLink / buildEmailVerificationLink", () => {
  it("uses APP_URL when set", async () => {
    vi.stubEnv("APP_URL", "https://app.example.com");
    vi.stubEnv("CANONICAL_URL", "https://www.example.com");
    const { buildPasswordResetLink, buildEmailVerificationLink } =
      await import("@/lib/email/links");
    expect(buildPasswordResetLink("abc")).toBe("https://app.example.com/reset-password?token=abc");
    expect(buildEmailVerificationLink("abc")).toBe(
      "https://app.example.com/verify-email?token=abc",
    );
  });

  it("falls back to CANONICAL_URL when APP_URL is unset", async () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("CANONICAL_URL", "https://canon.example.com");
    const { buildPasswordResetLink } = await import("@/lib/email/links");
    expect(buildPasswordResetLink("xyz")).toBe(
      "https://canon.example.com/reset-password?token=xyz",
    );
  });

  it("falls back to localhost when both are unset", async () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("CANONICAL_URL", "");
    const { buildPasswordResetLink } = await import("@/lib/email/links");
    expect(buildPasswordResetLink("xyz")).toBe("http://localhost:3000/reset-password?token=xyz");
  });

  it("escapes/strips trailing slash", async () => {
    vi.stubEnv("APP_URL", "https://app.example.com/");
    const { buildPasswordResetLink } = await import("@/lib/email/links");
    expect(buildPasswordResetLink("t1")).toBe("https://app.example.com/reset-password?token=t1");
  });
});
