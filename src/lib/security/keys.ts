import crypto from "node:crypto";

export const DEV_FALLBACK_SECRET = "via-fidei-dev-secret-change-me-please-32b";

export function deriveKey(): Buffer {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    DEV_FALLBACK_SECRET;
  return crypto.createHash("sha256").update(secret).digest();
}
