import crypto from "node:crypto";

// Mirror of the constant inlined in src/lib/auth/session.ts. The two are kept
// in lockstep deliberately — session.ts cannot import from this file because
// it would drag node:crypto into the edge-runtime middleware bundle.
export const DEV_FALLBACK_SECRET = "via-fidei-dev-secret-change-me-please-32b";

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function resolveSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production" && !isBuildPhase()) {
    throw new Error("SESSION_SECRET must be set to a 32+ character value in production.");
  }
  return DEV_FALLBACK_SECRET;
}

/**
 * Application-specific HKDF context labels ("info" strings).
 *
 * The deployment has exactly ONE piece of root secret material
 * (SESSION_SECRET) and several independent uses for it. Reusing the same
 * bytes for encryption, HMAC fingerprinting and code verification means a
 * weakness in one use — or an oracle in one protocol — leaks into all the
 * others. Every purpose therefore gets its own HKDF-SHA256 subkey under a
 * unique, fixed, human-readable label: subkeys are computationally
 * independent, and knowing one tells an attacker nothing about the rest.
 *
 * Labels are part of the on-disk/on-wire contract. NEVER edit an existing
 * label — that silently rotates the key and invalidates everything derived
 * under it. Add a new label (bump its /vN) instead, and keep reading the
 * old one for as long as old data exists.
 */
export const KEY_PURPOSE_LABELS = {
  /** Session cookie sealing / session-scoped secrets. */
  session: "viafidei/v1/session-security",
  /** AES-256-GCM at-rest encryption of database columns. */
  "at-rest": "viafidei/v1/at-rest-encryption",
  /** HMAC fingerprints stored on security-event / audit rows. */
  "security-fingerprint": "viafidei/v1/security-event-fingerprint",
  /** HMAC over admin two-factor codes (see getTwoFactorHmacKey). */
  "admin-2fa": "viafidei/v1/admin-2fa-code",
  /** Signatures on internal / machine-to-machine authentication payloads. */
  "internal-auth": "viafidei/v1/internal-auth-signature",
} as const;

export type KeyPurpose = keyof typeof KEY_PURPOSE_LABELS;

// Fixed, non-secret HKDF salt. A constant salt is fine here (RFC 5869 §3.1):
// the entropy comes from the root secret, and the per-purpose separation
// comes from the `info` label. It is pinned so derivation is reproducible
// across processes and deploys.
const HKDF_SALT = "via-fidei/hkdf/v1";

/** 256 bits — the size AES-256-GCM and HMAC-SHA256 both want. */
export const SUBKEY_BYTES = 32;

// Derivation is deterministic, so cache it. The cache is keyed by a digest
// of the resolved secret (never the secret itself) so a process that swaps
// SESSION_SECRET — tests do, via vi.stubEnv — cannot read a stale subkey.
let cacheTag: string | null = null;
const subkeyCache = new Map<KeyPurpose, Buffer>();

function secretTag(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/**
 * The single typed accessor for derived key material. Callers name the
 * PURPOSE they need; they never touch the root secret and never invent
 * their own derivation.
 *
 * Returns a fresh 32-byte Buffer on every call so a caller cannot mutate
 * the cached copy out from under everyone else.
 */
export function getPurposeKey(purpose: KeyPurpose): Buffer {
  const label = KEY_PURPOSE_LABELS[purpose];
  if (!label) {
    // Defensive: JS callers (tests, dynamic dispatch) can reach this with an
    // unknown string. Failing loudly beats deriving a key from `undefined`.
    throw new Error(`Unknown key purpose: ${String(purpose)}`);
  }
  const secret = resolveSecret();
  const tag = secretTag(secret);
  if (cacheTag !== tag) {
    subkeyCache.clear();
    cacheTag = tag;
  }
  const cached = subkeyCache.get(purpose);
  if (cached) return Buffer.from(cached);
  const derived = Buffer.from(
    crypto.hkdfSync("sha256", Buffer.from(secret, "utf8"), HKDF_SALT, label, SUBKEY_BYTES),
  );
  subkeyCache.set(purpose, derived);
  return Buffer.from(derived);
}

/**
 * HMAC key for admin two-factor code verification.
 *
 * Thin named wrapper over `getPurposeKey("admin-2fa")` — the 2FA code path
 * asks for this and nothing else, so it can never accidentally reach for
 * the at-rest or session key. Two-factor is an interactive-human-admin
 * control only: no user account, worker or machine flow derives this key.
 */
export function getTwoFactorHmacKey(): Buffer {
  return getPurposeKey("admin-2fa");
}

/**
 * LEGACY v1 at-rest key: a bare SHA-256 of the root secret, with no
 * domain separation.
 *
 * @deprecated Retained ONLY so `decryptAtRest` can still read the "v1"
 * payloads already written to the production database. New code must use
 * `getPurposeKey("at-rest")`. Do not add callers.
 */
export function deriveKey(): Buffer {
  return crypto.createHash("sha256").update(resolveSecret()).digest();
}
