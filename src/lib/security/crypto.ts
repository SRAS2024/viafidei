import crypto from "node:crypto";
import { deriveKey, getPurposeKey } from "./keys";

/**
 * At-rest AES-256-GCM envelope, versioned by its first field.
 *
 *   v1 — key = SHA-256(SESSION_SECRET), no AAD. Written by every release
 *        before domain separation landed, so PRODUCTION ROWS ARE v1 and
 *        must stay readable forever (or until a migration re-encrypts
 *        them). Read-only: nothing writes v1 any more.
 *   v2 — key = HKDF(SESSION_SECRET, "viafidei/v1/at-rest-encryption"), and
 *        the version string is bound in as GCM additional authenticated
 *        data so a v2 payload cannot be replayed as some other version.
 */
const LEGACY_PAYLOAD_VERSION = "v1";
const PAYLOAD_VERSION = "v2";

// Bound as AAD on v2 only. v1 was written without AAD and setting one on
// decrypt would make every existing production row fail its auth tag.
const V2_AAD = Buffer.from("viafidei/at-rest/v2", "utf8");

function keyForVersion(version: string): Buffer {
  return version === LEGACY_PAYLOAD_VERSION ? deriveKey() : getPurposeKey("at-rest");
}

export function encryptAtRest(plaintext: string): string {
  const key = keyForVersion(PAYLOAD_VERSION);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(V2_AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PAYLOAD_VERSION}.${iv.toString("base64url")}.${authTag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptAtRest(payload: string): string {
  const [version, ivB64, tagB64, ctB64] = payload.split(".");
  // The ciphertext field is checked for presence, not truthiness: an empty
  // string encrypts to an empty ciphertext, and rejecting that would make a
  // legitimately stored empty value permanently unreadable.
  if (
    (version !== PAYLOAD_VERSION && version !== LEGACY_PAYLOAD_VERSION) ||
    !ivB64 ||
    !tagB64 ||
    ctB64 === undefined
  ) {
    throw new Error("Invalid encrypted payload");
  }
  const key = keyForVersion(version);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  if (version === PAYLOAD_VERSION) {
    decipher.setAAD(V2_AAD);
  }
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
