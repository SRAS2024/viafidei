export const REQUEST_ID_HEADER = "x-request-id";

const ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function generateRequestId(): string {
  // crypto.randomUUID is part of the Web Crypto API and available both in
  // Node >= 19 and the Edge runtime. Stripping dashes keeps the value
  // header-safe while preserving 128 bits of entropy.
  return crypto.randomUUID().replace(/-/g, "");
}

export function normalizeIncomingRequestId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function ensureRequestId(headerValue: string | null): string {
  return normalizeIncomingRequestId(headerValue) ?? generateRequestId();
}
