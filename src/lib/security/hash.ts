import crypto from "node:crypto";
import { DEV_FALLBACK_SECRET, getPurposeKey } from "./keys";

export function emailLookupHash(email: string): string {
  const normalized = email.trim().toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Fingerprint kinds whose output is already persisted in production and
 * used as a LOOKUP KEY, not just as an opaque record:
 *
 *   * "device" — BannedDevice.deviceCredentialHash is unique and every
 *     request's live ban check is a findUnique on it. Re-keying it would
 *     silently un-ban every currently banned device.
 *   * "ip" / "ua" — stored on SecurityEvent / AdminActionLog rows and
 *     correlated across time by the detectors and admin console.
 *
 * These three keep the original root-secret HMAC key so existing rows keep
 * matching. Every other (i.e. newly introduced) kind uses the derived
 * "security-fingerprint" subkey — see the note on the function below.
 */
const LEGACY_ROOT_KEY_KINDS: ReadonlySet<string> = new Set(["ip", "device", "ua"]);

// Byte-identical to the pre-domain-separation key: the raw SESSION_SECRET,
// with no minimum-length check, falling back to the dev constant. Any change
// here — including "tightening" it — rotates production fingerprints.
function legacyFingerprintKey(): Buffer {
  return Buffer.from(process.env.SESSION_SECRET ?? DEV_FALLBACK_SECRET, "utf8");
}

/**
 * One-way fingerprint used by the security-event store. HMAC keyed on
 * secret material so two different deployments cannot correlate the same
 * raw IP / device credential. The `kind` prefix gives each kind of
 * fingerprint its own keyspace so a leaked IP hash cannot be compared
 * against device-credential hashes.
 *
 * New kinds are keyed with the HKDF-derived "security-fingerprint" subkey
 * so fingerprinting can never share key material with at-rest encryption,
 * 2FA or internal signatures. The three legacy kinds stay on the original
 * key for database compatibility (see LEGACY_ROOT_KEY_KINDS).
 */
export function securityFingerprint(kind: string, value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (trimmed.length === 0) return null;
  const key = LEGACY_ROOT_KEY_KINDS.has(kind)
    ? legacyFingerprintKey()
    : getPurposeKey("security-fingerprint");
  return crypto.createHmac("sha256", key).update(`${kind}:${trimmed}`).digest("hex");
}

export function ipFingerprint(ip: string | null | undefined): string | null {
  return securityFingerprint("ip", ip);
}

export function deviceCredentialFingerprint(value: string | null | undefined): string | null {
  return securityFingerprint("device", value);
}

export function userAgentFingerprint(value: string | null | undefined): string | null {
  return securityFingerprint("ua", value);
}
