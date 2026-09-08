import argon2 from "argon2";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, isPasswordHash, verifyAdminPassword } from "@/lib/auth/password";

const PLAINTEXT = "admin-password-for-tests-only";
// Same length as PLAINTEXT so a length-leaking comparison cannot pass by luck.
const WRONG_SAME_LENGTH = "admin-password-for-tests-ONLY";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verifyAdminPassword", () => {
  it("accepts the correct password when ADMIN_PASSWORD is configured in plaintext", async () => {
    expect(await verifyAdminPassword(PLAINTEXT, PLAINTEXT)).toBe(true);
  });

  it("rejects a wrong password of identical length", async () => {
    expect(await verifyAdminPassword(PLAINTEXT, WRONG_SAME_LENGTH)).toBe(false);
  });

  it("accepts and rejects correctly when ADMIN_PASSWORD holds an argon2id hash", async () => {
    const stored = await hashPassword("hashed-admin-secret");
    expect(isPasswordHash(stored)).toBe(true);
    expect(await verifyAdminPassword(stored, "hashed-admin-secret")).toBe(true);
    expect(await verifyAdminPassword(stored, "hashed-admin-secreT")).toBe(false);
  });

  it("refuses when the credential is unconfigured or the attempt is empty", async () => {
    expect(await verifyAdminPassword(undefined, PLAINTEXT)).toBe(false);
    expect(await verifyAdminPassword(null, PLAINTEXT)).toBe(false);
    expect(await verifyAdminPassword("", PLAINTEXT)).toBe(false);
    expect(await verifyAdminPassword(PLAINTEXT, "")).toBe(false);
  });

  it("verifies a plaintext-configured password through argon2id, never plaintext vs plaintext", async () => {
    const configured = "rotating-plaintext-admin-secret-a";
    const verifySpy = vi.spyOn(argon2, "verify");
    expect(await verifyAdminPassword(configured, configured)).toBe(true);
    expect(verifySpy).toHaveBeenCalled();
    for (const call of verifySpy.mock.calls) {
      // The first argument is the digest being verified against; the
      // configured secret itself must never appear there.
      expect(String(call[0]).startsWith("$argon2id$")).toBe(true);
      expect(call[0]).not.toBe(configured);
    }
  });

  it("derives the argon2 digest of a plaintext secret once per process, not per login", async () => {
    const configured = "rotating-plaintext-admin-secret-b";
    // Prime the cache before spying so the spy only sees steady-state logins.
    await verifyAdminPassword(configured, configured);
    const hashSpy = vi.spyOn(argon2, "hash");
    expect(await verifyAdminPassword(configured, configured)).toBe(true);
    expect(await verifyAdminPassword(configured, "wrong-guess")).toBe(false);
    expect(hashSpy).not.toHaveBeenCalled();
  });

  it("invalidates the cached digest when the configured credential is rotated", async () => {
    const before = "rotating-plaintext-admin-secret-c";
    const after = "rotating-plaintext-admin-secret-d";
    expect(await verifyAdminPassword(before, before)).toBe(true);
    expect(await verifyAdminPassword(after, after)).toBe(true);
    expect(await verifyAdminPassword(after, before)).toBe(false);
    expect(await verifyAdminPassword(before, after)).toBe(false);
  });

  it("still authenticates when the argon2 binding is unavailable (no admin lockout)", async () => {
    const configured = "fallback-plaintext-admin-secret";
    vi.spyOn(argon2, "hash").mockRejectedValue(new Error("native binding unavailable"));
    expect(await verifyAdminPassword(configured, configured)).toBe(true);
    expect(await verifyAdminPassword(configured, "fallback-plaintext-admin-secreT")).toBe(false);
  });
});

describe("isPasswordHash", () => {
  it("recognises argon2 PHC strings and nothing else", async () => {
    expect(isPasswordHash(await hashPassword("x"))).toBe(true);
    expect(isPasswordHash("a-plaintext-admin-password")).toBe(false);
    expect(isPasswordHash("")).toBe(false);
  });
});
