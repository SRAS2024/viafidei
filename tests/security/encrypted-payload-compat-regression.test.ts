/**
 * Backwards-compatibility regression for at-rest encryption.
 *
 * Production `User.emailEncrypted` / `nameEncrypted` rows were written by
 * releases that predate key domain separation. They are "v1": key =
 * SHA-256(SESSION_SECRET), AES-256-GCM, no AAD. If a future change rotates
 * that key or starts setting AAD on the v1 branch, every one of those rows
 * becomes permanently unreadable — and no unit test that re-implements the v1
 * scheme in the test file would notice, because the re-implementation would be
 * updated alongside the code it is supposed to be checking.
 *
 * So the fixtures below are FROZEN LITERALS: ciphertext produced once, under a
 * fixed secret, by the pre-change implementation. Nothing in the repository
 * generates them at run time. They are the closest thing a unit test can hold
 * to a real production row, and they will keep failing until whoever changed
 * the v1 read path either restores it or ships a migration that re-encrypts
 * the live data.
 *
 * (tests/security/crypto.test.ts covers the same property by re-implementing
 * v1 in-test; that catches an accidental change today, this catches one that
 * "fixes" the helper too.)
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

/** The secret the fixtures below were produced under. Fixed forever. */
const FIXTURE_SECRET = "via-fidei-frozen-fixture-secret-32chars!!";

/**
 * v1 envelopes captured from the pre-domain-separation implementation.
 * DO NOT REGENERATE. If one of these stops decrypting, existing production
 * rows have stopped decrypting too.
 */
const FROZEN_V1 = [
  {
    what: "an email address",
    plaintext: "pilgrim@example.com",
    payload: "v1.qBBpmYwTbV49g1Vb.BDZbc-k7Z4_T88Jmu4n9fQ.31uC5kJQOZqB2VCrZeacaeAIRg",
  },
  {
    what: "a name with accents and an emoji",
    plaintext: "María José Ñuñez 🕊",
    payload: "v1.9Ix1zkr08HFezPLc.BnsxCXG84mCAaM0o7gMHfQ.r8NRHi_iMGKBEqKsGApiDBL6V-8ihokvIw",
  },
  {
    what: "an empty value",
    plaintext: "",
    payload: "v1.3SpjQe32Ow3pPB4z.w_4GDWZnsWFeNPF5fkKrHA.",
  },
] as const;

async function crypto() {
  return import("@/lib/security/crypto");
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("SESSION_SECRET", FIXTURE_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("frozen v1 payloads still decrypt after domain separation", () => {
  for (const fixture of FROZEN_V1) {
    it(`reads ${fixture.what} written by the pre-change implementation`, async () => {
      const { decryptAtRest } = await crypto();
      expect(decryptAtRest(fixture.payload)).toBe(fixture.plaintext);
    });
  }

  it("a long value round-trips too (multi-block ciphertext)", async () => {
    const { decryptAtRest } = await crypto();
    const long =
      "v1.el2i5oDr9DQssIrT.dVp9jqkX_a2yjbrzZhaaTQ.1E5AgY_pgWauY5Gn8WnXMUHWsPy8WWJHoXr9W-by0oDuFExQr_8g" +
      "sUQ7lmU6uxXfIqGsp-YBPlyDG7gnT7io88uhGilumizRN0Rf9gt-lyUk54gPuJpVMrJ0Svo5KVEwlHcRiAsNYE6gAqEaKaJZ" +
      "78qrM_3X3CWAZ--mL4u0kwTwlEBQHE4Fp9b4hmNmnkPLN8OBfYZ9vFr6ZLA9UiWc2SgHMbw9m1IGITbqHic9EJ37DvoBD2fM" +
      "jvb6vBpVNGo_SSmB_-RfDZaJapMaOU_RUhJfmKd9kDyamWGVFb_FZ1amd7BrsHSRqXvKtUhOX9kFV-mlUc29rsVnh9u1aGVK" +
      "OlO6bzaDmpnR8xhGnnZXRY39IwV1KhOT1oHR3HoyFyeYNYVMsMtUHPeJQCy5";
    expect(decryptAtRest(long)).toBe("a".repeat(300));
  });

  it("the v1 read key is still SHA-256 of the root secret, byte for byte", async () => {
    const node = await import("node:crypto");
    const { deriveKey } = await import("@/lib/security/keys");
    expect(deriveKey().equals(node.createHash("sha256").update(FIXTURE_SECRET).digest())).toBe(
      true,
    );
  });

  it("v1 is read-only — nothing writes it any more", async () => {
    const { encryptAtRest } = await crypto();
    expect(encryptAtRest("anything").startsWith("v1.")).toBe(false);
  });
});

describe("the new envelope does not compromise the old one", () => {
  it("v2 round-trips and is keyed differently from v1", async () => {
    const { encryptAtRest, decryptAtRest } = await crypto();
    const { deriveKey, getPurposeKey } = await import("@/lib/security/keys");

    const payload = encryptAtRest("pilgrim@example.com");
    expect(payload.startsWith("v2.")).toBe(true);
    expect(decryptAtRest(payload)).toBe("pilgrim@example.com");
    // Domain separation: an oracle against one key says nothing about the other.
    expect(deriveKey().equals(getPurposeKey("at-rest"))).toBe(false);
  });

  it("both versions of the same value decrypt to the same plaintext in one process", async () => {
    const { encryptAtRest, decryptAtRest } = await crypto();
    const fixture = FROZEN_V1[0];
    expect(decryptAtRest(fixture.payload)).toBe(fixture.plaintext);
    expect(decryptAtRest(encryptAtRest(fixture.plaintext))).toBe(fixture.plaintext);
  });

  it("a v2 payload cannot be replayed as v1", async () => {
    const { encryptAtRest, decryptAtRest } = await crypto();
    const relabelled = encryptAtRest("secret").replace(/^v2\./, "v1.");
    expect(() => decryptAtRest(relabelled)).toThrow();
  });

  it("a v1 payload cannot be relabelled as v2 either", async () => {
    const { decryptAtRest } = await crypto();
    const relabelled = FROZEN_V1[0].payload.replace(/^v1\./, "v2.");
    expect(() => decryptAtRest(relabelled)).toThrow();
  });

  it("a tampered frozen payload is rejected rather than silently mis-read", async () => {
    const { decryptAtRest } = await crypto();
    const parts = FROZEN_V1[0].payload.split(".");
    const flipped = Buffer.from(parts[3]!, "base64url");
    flipped[0] ^= 0xff;
    expect(() =>
      decryptAtRest([parts[0], parts[1], parts[2], flipped.toString("base64url")].join(".")),
    ).toThrow();
  });

  it("an unrecognised version is refused, so a future v3 cannot be read as v2", async () => {
    const { encryptAtRest, decryptAtRest } = await crypto();
    expect(() => decryptAtRest(encryptAtRest("x").replace(/^v2\./, "v3."))).toThrow(
      /Invalid encrypted payload/,
    );
  });

  it("the wrong root secret cannot read a frozen row", async () => {
    vi.stubEnv("SESSION_SECRET", "a-completely-different-secret-32-chars");
    vi.resetModules();
    const { decryptAtRest } = await crypto();
    expect(() => decryptAtRest(FROZEN_V1[0].payload)).toThrow();
  });
});
