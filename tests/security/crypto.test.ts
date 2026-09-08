import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptAtRest, encryptAtRest } from "@/lib/security/crypto";
import { deriveKey, getPurposeKey } from "@/lib/security/keys";

const TEST_SECRET = "test-session-secret-must-be-at-least-32-characters-long";

/**
 * Byte-for-byte reproduction of the ORIGINAL (pre-domain-separation)
 * encryptAtRest: key = SHA-256(SESSION_SECRET), no AAD, "v1" prefix. This is
 * the format every already-encrypted production row is stored in.
 */
function encryptLegacyV1(plaintext: string): string {
  const key = crypto.createHash("sha256").update(TEST_SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("at-rest encryption", () => {
  it("round-trips a value", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    expect(decryptAtRest(encryptAtRest("someone@example.com"))).toBe("someone@example.com");
  });

  it("round-trips unicode and empty strings", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    expect(decryptAtRest(encryptAtRest("José Ñuñez — 祈り"))).toBe("José Ñuñez — 祈り");
    expect(decryptAtRest(encryptAtRest(""))).toBe("");
  });

  it("writes the new v2 envelope under the derived at-rest subkey", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    const payload = encryptAtRest("secret-value");
    expect(payload.startsWith("v2.")).toBe(true);
    // The v2 key is the HKDF subkey, not the legacy SHA-256 of the secret.
    expect(getPurposeKey("at-rest").equals(deriveKey())).toBe(false);
  });

  it("uses a fresh IV per call", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    expect(encryptAtRest("same")).not.toBe(encryptAtRest("same"));
  });

  /**
   * THE compatibility guarantee: rows encrypted by the deployed release
   * must still decrypt after the key-derivation change. If this ever fails,
   * live user data has become unreadable.
   */
  it("still decrypts legacy v1 payloads written with the old SHA-256 key", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    const legacy = encryptLegacyV1("pilgrim@viafidei.example");
    expect(legacy.startsWith("v1.")).toBe(true);
    expect(decryptAtRest(legacy)).toBe("pilgrim@viafidei.example");
  });

  it("decrypts a legacy v1 payload and a new v2 payload of the same plaintext alike", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    const plaintext = "Maria Guadalupe";
    expect(decryptAtRest(encryptLegacyV1(plaintext))).toBe(plaintext);
    expect(decryptAtRest(encryptAtRest(plaintext))).toBe(plaintext);
  });

  it("rejects a v2 payload relabelled as v1 (version binding via AAD)", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    const forged = `v1.${encryptAtRest("secret-value").slice(3)}`;
    expect(() => decryptAtRest(forged)).toThrow();
  });

  it("rejects an unknown version and a malformed payload", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    expect(() => decryptAtRest("v3.a.b.c")).toThrow(/Invalid encrypted payload/);
    expect(() => decryptAtRest("v2.only-two-parts")).toThrow(/Invalid encrypted payload/);
  });

  it("rejects a tampered ciphertext", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    const parts = encryptAtRest("secret-value").split(".");
    const ct = Buffer.from(parts[3], "base64url");
    ct[0] ^= 0xff;
    expect(() =>
      decryptAtRest(`${parts[0]}.${parts[1]}.${parts[2]}.${ct.toString("base64url")}`),
    ).toThrow();
  });

  it("cannot decrypt under a different root secret", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    const payload = encryptAtRest("secret-value");
    vi.stubEnv("SESSION_SECRET", `${TEST_SECRET}-rotated`);
    expect(() => decryptAtRest(payload)).toThrow();
  });
});
