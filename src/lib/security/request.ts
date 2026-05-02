import type { NextRequest } from "next/server";

const ANONYMOUS_IP = "0.0.0.0";

function isLikelyValidIp(value: string): boolean {
  if (!value) return false;
  if (value.length > 64) return false;
  return /^[0-9a-fA-F:.]+$/.test(value);
}

function extractFirstForwardedIp(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  if (!first) return null;
  return isLikelyValidIp(first) ? first : null;
}

export function getClientIp(req: NextRequest): string {
  return getClientIpOrNull(req) ?? ANONYMOUS_IP;
}

export function getClientIpOrNull(req: NextRequest): string | null {
  return (
    extractFirstForwardedIp(req.headers.get("x-forwarded-for")) ??
    extractFirstForwardedIp(req.headers.get("x-real-ip")) ??
    null
  );
}

export function getUserAgent(req: NextRequest): string | null {
  const ua = req.headers.get("user-agent");
  if (!ua) return null;
  return ua.length > 512 ? ua.slice(0, 512) : ua;
}
