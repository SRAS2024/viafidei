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

/**
 * Loopback addresses (127.0.0.0/8 + IPv6 ::1). Requests with these as the
 * connecting IP can only originate from the same machine — the kernel
 * routes them through the loopback interface and they never touch the
 * network. We allow these without a bearer so the in-process startup
 * scheduler can drive ingestion even when SESSION_SECRET isn't set; an
 * external caller cannot spoof this because their packets arrive on a
 * different interface with a different source IP.
 */
function isLoopbackAddress(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const trimmed = ip.trim().toLowerCase();
  // IPv6 loopback (with or without zone) and IPv4-mapped IPv6 loopback.
  if (trimmed === "::1" || trimmed.startsWith("::1%") || trimmed === "::ffff:127.0.0.1") {
    return true;
  }
  // IPv4 127.0.0.0/8.
  return /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(trimmed);
}

function isLoopbackRequest(req: NextRequest): boolean {
  // x-forwarded-for is set by reverse proxies for external traffic. If
  // it's present, the request reached us through a proxy and is not
  // truly loopback — refuse the loopback fallback so a misconfigured
  // proxy header can't bypass auth.
  if (req.headers.get("x-forwarded-for")) return false;
  if (req.headers.get("x-real-ip")) return false;
  const direct = req.ip ?? null;
  return isLoopbackAddress(direct);
}

export async function isAuthorizedCron(req: NextRequest): Promise<boolean> {
  const expected = await deriveCronSecret();
  const provided = getProvidedCronToken(req);
  if (expected && provided && constantTimeStringEquals(provided, expected)) {
    return true;
  }
  // Loopback fallback: in-process startup scheduler hits /api/cron/ingest
  // over HTTP because the heavy runner code must stay out of the Next.js
  // instrumentation bundle. The kernel guarantees loopback traffic
  // originated on this machine, so we accept it even without a bearer.
  return isLoopbackRequest(req);
}
