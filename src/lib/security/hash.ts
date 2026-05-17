import crypto from "node:crypto";

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
 * One-way fingerprint used by the security-event store. HMAC with
 * SESSION_SECRET so two different deployments cannot correlate the
 * same raw IP / device credential. The salt prefix gives each kind
 * of fingerprint its own keyspace so a leaked IP hash cannot be
 * compared against device-credential hashes.
 */
export function securityFingerprint(kind: string, value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (trimmed.length === 0) return null;
  const secret = process.env.SESSION_SECRET ?? "via-fidei-dev-secret-change-me-please-32b";
  return crypto.createHmac("sha256", secret).update(`${kind}:${trimmed}`).digest("hex");
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
