import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deviceCredentialFingerprint,
  ipFingerprint,
  securityFingerprint,
  userAgentFingerprint,
} from "@/lib/security/hash";
import { getPurposeKey } from "@/lib/security/keys";

const TEST_SECRET = "test-session-secret-must-be-at-least-32-characters-long";

/** The original fingerprint formula: HMAC-SHA256 keyed on the raw secret. */
function legacyFingerprint(kind: string, value: string): string {
  return crypto.createHmac("sha256", TEST_SECRET).update(`${kind}:${value}`).digest("hex");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("security fingerprints", () => {
  /**
   * BannedDevice.deviceCredentialHash is a unique lookup key: every request's
   * ban check is a findUnique on this exact value. If these three kinds ever
   * change, live bans silently stop matching and historical security events
   * de-correlate — so their key material is pinned.
   */
  it("keeps ip / device / ua fingerprints byte-identical to the deployed formula", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    expect(ipFingerprint("203.0.113.7")).toBe(legacyFingerprint("ip", "203.0.113.7"));
    expect(deviceCredentialFingerprint("device-cookie-value")).toBe(
      legacyFingerprint("device", "device-cookie-value"),
    );
    expect(userAgentFingerprint("Mozilla/5.0")).toBe(legacyFingerprint("ua", "Mozilla/5.0"));
  });

  it("keys any new fingerprint kind with the derived subkey, not the root secret", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    const actual = securityFingerprint("admin-session", "abc123");
    expect(actual).not.toBe(legacyFingerprint("admin-session", "abc123"));
    expect(actual).toBe(
      crypto
        .createHmac("sha256", getPurposeKey("security-fingerprint"))
        .update("admin-session:abc123")
        .digest("hex"),
    );
  });

  it("still separates keyspaces per kind and normalises input", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    expect(ipFingerprint("  203.0.113.7 ")).toBe(ipFingerprint("203.0.113.7"));
    expect(ipFingerprint("same")).not.toBe(deviceCredentialFingerprint("same"));
    expect(securityFingerprint("a", "same")).not.toBe(securityFingerprint("b", "same"));
  });

  it("returns null for empty input", () => {
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
    expect(ipFingerprint(null)).toBeNull();
    expect(ipFingerprint(undefined)).toBeNull();
    expect(ipFingerprint("   ")).toBeNull();
  });
});
