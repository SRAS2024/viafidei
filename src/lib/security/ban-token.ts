/**
 * Signed ban-token helpers. A Security Breach email contains a
 * single-use, signed URL the admin can click to ban the originating
 * device. The token carries:
 *
 *   * securityEventId        — links the action back to the
 *                              SecurityEvent row that triggered it.
 *   * deviceCredentialHash   — HMAC fingerprint of the device cookie
 *                              that produced the breach. Hashes only,
 *                              never raw values.
 *   * expiresAt              — absolute expiry timestamp (ms). 24 h
 *                              by default so the email is actionable
 *                              for a day but not forever.
 *   * signature              — HMAC-SHA256 over the canonical
 *                              payload string, using SESSION_SECRET.
 *
 * The token is single-use because the ban route writes a BannedDevice
 * row keyed on `deviceCredentialHash` (unique). A second click on the
 * same link finds the existing row and reports "already banned" —
 * the action is idempotent and the second click cannot do anything
 * malicious.
 */

import crypto from "node:crypto";
import { deviceCredentialFingerprint } from "./hash";
import { getAppBaseUrl } from "../email/links";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type BanTokenClaims = {
  securityEventId: string;
  deviceCredentialHash: string;
  expiresAt: number;
};

function resolveSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  return "via-fidei-dev-secret-change-me-please-32b";
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const padding = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", resolveSecret()).update(payload).digest("hex");
}

/**
 * Encode a signed ban token. Returns a URL-safe string the email
 * link can include. Callers should never construct the token
 * manually — use this helper.
 */
export function encodeBanToken(claims: BanTokenClaims): string {
  const payload = JSON.stringify(claims);
  const payloadB64 = base64UrlEncode(payload);
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

export type DecodedBanToken =
  | { ok: true; claims: BanTokenClaims }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

/**
 * Decode and verify a signed ban token. Constant-time signature
 * compare. Returns the claims on success, an error reason
 * otherwise.
 */
export function decodeBanToken(token: string, now: number = Date.now()): DecodedBanToken {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed" };
  }
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    return { ok: false, reason: "malformed" };
  }
  const expected = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }
  let claims: BanTokenClaims;
  try {
    claims = JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as BanTokenClaims;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    typeof claims.securityEventId !== "string" ||
    typeof claims.deviceCredentialHash !== "string" ||
    typeof claims.expiresAt !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }
  if (claims.expiresAt <= now) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, claims };
}

export type BuildSignedBanUrlInput = {
  securityEventId: string;
  /** Raw device credential — fingerprinted before being embedded. */
  deviceCredential: string;
  /** Optional override TTL in milliseconds. */
  ttlMs?: number;
};

/**
 * Mint a signed ban URL the admin email can include.
 */
export function buildSignedBanUrl(input: BuildSignedBanUrlInput): string {
  const deviceCredentialHash = deviceCredentialFingerprint(input.deviceCredential);
  if (!deviceCredentialHash) {
    throw new Error("buildSignedBanUrl: device credential cannot be fingerprinted");
  }
  const claims: BanTokenClaims = {
    securityEventId: input.securityEventId,
    deviceCredentialHash,
    expiresAt: Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS),
  };
  const token = encodeBanToken(claims);
  const base = getAppBaseUrl();
  // The base may already end with "/"; normalise.
  const normalisedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalisedBase}/api/security/ban-device/${token}`;
}
