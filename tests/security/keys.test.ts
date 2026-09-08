import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEV_FALLBACK_SECRET,
  KEY_PURPOSE_LABELS,
  SUBKEY_BYTES,
  deriveKey,
  getPurposeKey,
  getTwoFactorHmacKey,
  type KeyPurpose,
} from "@/lib/security/keys";

const PURPOSES = Object.keys(KEY_PURPOSE_LABELS) as KeyPurpose[];

const TEST_SECRET = "test-session-secret-must-be-at-least-32-characters-long";

// Independent re-implementation of the derivation, so the test fails if the
// salt, digest, label or length ever silently changes.
function expectedSubkey(secret: string, label: string): Buffer {
  return Buffer.from(
    crypto.hkdfSync("sha256", Buffer.from(secret, "utf8"), "via-fidei/hkdf/v1", label, 32),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPurposeKey", () => {
  it("covers every purpose the application needs, each with a unique label", () => {
    expect(PURPOSES.sort()).toEqual(
      ["admin-2fa", "at-rest", "internal-auth", "security-fingerprint", "session"].sort(),
    );
    const labels = Object.values(KEY_PURPOSE_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).toMatch(/^viafidei\/v\d+\//);
  });

  it("derives a 32-byte subkey per purpose, matching HKDF-SHA256 over the root secret", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    for (const purpose of PURPOSES) {
      const key = getPurposeKey(purpose);
      expect(key).toHaveLength(SUBKEY_BYTES);
      expect(key.equals(expectedSubkey(TEST_SECRET, KEY_PURPOSE_LABELS[purpose]))).toBe(true);
    }
  });

  it("gives every purpose an independent key", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    const hexes = PURPOSES.map((p) => getPurposeKey(p).toString("hex"));
    expect(new Set(hexes).size).toBe(PURPOSES.length);
  });

  it("never returns the bare hash of the root secret (no context-free derivation)", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    const bare = crypto.createHash("sha256").update(TEST_SECRET).digest("hex");
    const raw = Buffer.from(TEST_SECRET, "utf8").toString("hex");
    for (const purpose of PURPOSES) {
      const key = getPurposeKey(purpose).toString("hex");
      expect(key).not.toBe(bare);
      expect(key).not.toBe(raw);
    }
  });

  it("is deterministic for the same secret and changes when the secret changes", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    const a = getPurposeKey("at-rest").toString("hex");
    const b = getPurposeKey("at-rest").toString("hex");
    expect(a).toBe(b);
    vi.stubEnv("SESSION_SECRET", `${TEST_SECRET}-rotated`);
    expect(getPurposeKey("at-rest").toString("hex")).not.toBe(a);
  });

  it("hands back a copy so a caller cannot poison the cache", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    const first = getPurposeKey("session");
    first.fill(0);
    expect(getPurposeKey("session").equals(first)).toBe(false);
  });

  it("throws on an unknown purpose rather than deriving from undefined", () => {
    expect(() => getPurposeKey("nope" as KeyPurpose)).toThrow(/Unknown key purpose/);
  });

  it("falls back to the dev secret outside production", () => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NODE_ENV", "test");
    expect(
      getPurposeKey("at-rest").equals(
        expectedSubkey(DEV_FALLBACK_SECRET, KEY_PURPOSE_LABELS["at-rest"]),
      ),
    ).toBe(true);
  });
});

describe("getTwoFactorHmacKey", () => {
  it("is exactly the admin-2fa subkey and shares no bytes with the other purposes", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    const twoFactor = getTwoFactorHmacKey();
    expect(twoFactor.equals(getPurposeKey("admin-2fa"))).toBe(true);
    for (const purpose of PURPOSES.filter((p) => p !== "admin-2fa")) {
      expect(twoFactor.equals(getPurposeKey(purpose))).toBe(false);
    }
    // Not the at-rest key in particular: a 2FA HMAC must never be computable
    // by anything holding the database encryption key.
    expect(twoFactor.equals(deriveKey())).toBe(false);
  });
});

describe("deriveKey (legacy v1)", () => {
  it("still returns SHA-256(root secret) so v1 payloads stay decryptable", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    expect(deriveKey().toString("hex")).toBe(
      crypto.createHash("sha256").update(TEST_SECRET).digest("hex"),
    );
  });
});
