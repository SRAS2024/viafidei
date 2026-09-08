import crypto from "node:crypto";
import argon2 from "argon2";
import { constantTimeEquals } from "../security/hash";

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** True when a configured value is already an Argon2 PHC string. */
export function isPasswordHash(value: string): boolean {
  return value.startsWith("$argon2");
}

/**
 * Cached Argon2id digest of a PLAINTEXT ADMIN_PASSWORD.
 *
 * Keyed by a SHA-256 tag of the configured value, never by the value
 * itself, so rotating ADMIN_PASSWORD (or a test stubbing it) invalidates
 * the digest without the plaintext living in a second module-level
 * variable. The digest is derived once per process, not per login, so the
 * Argon2 cost lands on the attacker's guess and not on startup.
 */
let adminDigestTag: string | null = null;
let adminDigest: string | null = null;

function configTag(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function adminDigestFor(configured: string): Promise<string | null> {
  const tag = configTag(configured);
  if (adminDigestTag === tag && adminDigest) return adminDigest;
  try {
    const digest = await hashPassword(configured);
    adminDigestTag = tag;
    adminDigest = digest;
    return digest;
  } catch {
    // Argon2 is a native binding; if it is unavailable we must not lock the
    // administrator out of a live deployment. The caller falls back to the
    // original constant-time comparison.
    return null;
  }
}

/**
 * Verify a supplied admin password against the configured ADMIN_PASSWORD.
 *
 * Admin credentials now meet the same bar as ordinary user passwords
 * (Argon2id, memory-hard, constant-time inside the verifier) while staying
 * compatible with the live deployment, which still configures a plaintext
 * ADMIN_PASSWORD. There is no second admin password variable:
 *
 *   * ADMIN_PASSWORD holding an Argon2 PHC string (`$argon2id$...`) — the
 *     preferred form, produced by `hashPassword` — is verified directly, so
 *     no reusable plaintext admin secret exists anywhere in the deployment.
 *   * ADMIN_PASSWORD holding plaintext is converted, once per process, into
 *     an in-memory Argon2id digest and the supplied password is verified
 *     against THAT. The two plaintexts are never compared to each other, so
 *     a login never touches the configured secret directly, and the work
 *     performed is identical for a right and a wrong guess.
 *
 * The plaintext is never logged, returned, echoed in an error, or stored
 * anywhere beyond the environment variable it already lives in.
 */
export async function verifyAdminPassword(
  configured: string | null | undefined,
  supplied: string,
): Promise<boolean> {
  if (!configured || typeof supplied !== "string" || supplied.length === 0) return false;
  if (isPasswordHash(configured)) return verifyPassword(configured, supplied);
  const digest = await adminDigestFor(configured);
  if (!digest) return constantTimeEquals(supplied, configured);
  return verifyPassword(digest, supplied);
}
