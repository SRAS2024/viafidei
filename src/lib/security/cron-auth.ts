import type { NextRequest } from "next/server";

const BEARER_PREFIX = "bearer ";

// Domain-separation tag so the cron secret can never collide with the raw
// SESSION_SECRET or any other key derived from it elsewhere in the app.
const CRON_DERIVATION_INFO = "viafidei:cron:v1";

export function getProvidedCronToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith(BEARER_PREFIX)) {
    return authHeader.slice(BEARER_PREFIX.length).trim();
  }
  const explicit = req.headers.get("x-cron-secret");
  return explicit?.trim() || null;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

// Constant-time string comparison. Inlined here so this module does not
// transitively import `node:crypto` — that lets it be safely pulled into
// the Next.js instrumentation chunk via auto-seed.ts.
function constantTimeStringEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Deterministic per-deployment cron token derived from SESSION_SECRET.
 *
 * Returns null when SESSION_SECRET is missing or too short, in which case
 * the cron route refuses every request — that is, the cron surface is
 * disabled by default until SESSION_SECRET is provided. There is no
 * separate CRON_SECRET environment variable.
 *
 * Uses the Web Crypto API (`globalThis.crypto.subtle`) so this module can
 * be safely pulled into Node and edge bundles alike.
 */
export async function deriveCronSecret(): Promise<string | null> {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) return null;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await subtle.sign("HMAC", key, new TextEncoder().encode(CRON_DERIVATION_INFO));
  return bytesToHex(new Uint8Array(sig));
}

export async function isAuthorizedCron(req: NextRequest): Promise<boolean> {
  const expected = await deriveCronSecret();
  if (!expected) return false;
  const provided = getProvidedCronToken(req);
  if (!provided) return false;
  return constantTimeStringEquals(provided, expected);
}
