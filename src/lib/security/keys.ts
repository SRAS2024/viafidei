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

export function deriveKey(): Buffer {
  return crypto.createHash("sha256").update(resolveSecret()).digest();
}
