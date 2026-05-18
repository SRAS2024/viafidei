import { beforeEach, describe, expect, it } from "vitest";
import {
  buildSignedBanUrl,
  decodeBanToken,
  encodeBanToken,
  type BanTokenClaims,
} from "@/lib/security/ban-token";

describe("ban token — encode + decode + signature", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
  });

  it("decodes a freshly minted token", () => {
    const claims: BanTokenClaims = {
      securityEventId: "evt_abc",
      deviceCredentialHash: "dev_hash_123",
      expiresAt: Date.now() + 60_000,
    };
    const token = encodeBanToken(claims);
    const decoded = decodeBanToken(token);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.claims.securityEventId).toBe("evt_abc");
      expect(decoded.claims.deviceCredentialHash).toBe("dev_hash_123");
    }
  });

  it("rejects a token with a tampered signature", () => {
    const claims: BanTokenClaims = {
      securityEventId: "evt_abc",
      deviceCredentialHash: "dev_hash_123",
      expiresAt: Date.now() + 60_000,
    };
    const token = encodeBanToken(claims);
    const tampered = token.slice(0, -3) + "AAA";
    const decoded = decodeBanToken(tampered);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.reason).toBe("bad_signature");
  });

  it("rejects a token whose payload was modified", () => {
    const token = encodeBanToken({
      securityEventId: "evt_abc",
      deviceCredentialHash: "dev_hash_123",
      expiresAt: Date.now() + 60_000,
    });
    // Swap the payload half for a different (validly base64-url'd) string.
    const [, sig] = token.split(".");
    const otherPayload = Buffer.from(
      JSON.stringify({
        securityEventId: "evt_xxx",
        deviceCredentialHash: "dev_hash_xxx",
        expiresAt: Date.now() + 60_000,
      }),
      "utf8",
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const swapped = `${otherPayload}.${sig}`;
    const decoded = decodeBanToken(swapped);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.reason).toBe("bad_signature");
  });

  it("rejects an expired token", () => {
    const claims: BanTokenClaims = {
      securityEventId: "evt_abc",
      deviceCredentialHash: "dev_hash_123",
      expiresAt: Date.now() - 1_000,
    };
    const token = encodeBanToken(claims);
    const decoded = decodeBanToken(token);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.reason).toBe("expired");
  });

  it("rejects a malformed token", () => {
    const decoded = decodeBanToken("not-a-real-token");
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.reason).toBe("malformed");
  });

  it("buildSignedBanUrl returns a URL pointing at /api/security/ban-device/<token>", () => {
    const url = buildSignedBanUrl({
      securityEventId: "evt_link_1",
      deviceCredential: "raw-cookie-value",
    });
    expect(url).toMatch(/\/api\/security\/ban-device\/[^/]+\.[^/]+$/);
  });

  it("buildSignedBanUrl fingerprints the device credential (raw value never appears in the token)", () => {
    const url = buildSignedBanUrl({
      securityEventId: "evt_link_2",
      deviceCredential: "secret-raw-cookie-value-12345",
    });
    expect(url).not.toContain("secret-raw-cookie-value-12345");
  });
});
