import type { NextRequest } from "next/server";

export function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function getClientIpOrNull(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export function getUserAgent(req: NextRequest): string | null {
  return req.headers.get("user-agent");
}
