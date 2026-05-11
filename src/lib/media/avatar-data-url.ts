/**
 * Server-side validator for the data URL the avatar API receives.
 *
 * The browser optimizer keeps the payload small, but we still defend the
 * database against an oversized or malformed string by enforcing a strict
 * mime + length check on every request.
 */

const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MAX_AVATAR_DATA_URL_BYTES = 350 * 1024;

export type AvatarDataUrlOk = {
  ok: true;
  mimeType: string;
  dataUrl: string;
  byteLength: number;
};

export type AvatarDataUrlErr = {
  ok: false;
  reason: "invalid_format" | "unsupported_mime" | "too_large";
};

export type AvatarDataUrlResult = AvatarDataUrlOk | AvatarDataUrlErr;

const DATA_URL_RE = /^data:([a-z]+\/[a-z0-9.+-]+)(?:;[^,]*)*;base64,([A-Za-z0-9+/=\s]+)$/i;

export function validateAvatarDataUrl(value: unknown): AvatarDataUrlResult {
  if (typeof value !== "string" || !value.startsWith("data:")) {
    return { ok: false, reason: "invalid_format" };
  }
  if (value.length > MAX_AVATAR_DATA_URL_BYTES * 2) {
    return { ok: false, reason: "too_large" };
  }
  const match = DATA_URL_RE.exec(value);
  if (!match) {
    return { ok: false, reason: "invalid_format" };
  }
  const mimeType = match[1].toLowerCase();
  if (!ACCEPTED_MIME.has(mimeType)) {
    return { ok: false, reason: "unsupported_mime" };
  }
  const base64 = match[2].replace(/\s+/g, "");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const byteLength = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  if (byteLength > MAX_AVATAR_DATA_URL_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  return {
    ok: true,
    mimeType,
    dataUrl: `data:${mimeType};base64,${base64}`,
    byteLength,
  };
}

/**
 * Compute a stable checksum for the image bytes so duplicate uploads can be
 * coalesced into a single MediaAsset row. We use the SubtleCrypto-free Node
 * `crypto` module so this is callable from a route handler.
 */
export async function checksumDataUrl(dataUrl: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(dataUrl).digest("hex");
}
