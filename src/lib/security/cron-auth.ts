import type { NextRequest } from "next/server";
import { constantTimeEquals } from "./hash";

const BEARER_PREFIX = "bearer ";

export function getProvidedCronToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith(BEARER_PREFIX)) {
    return authHeader.slice(BEARER_PREFIX.length).trim();
  }
  const explicit = req.headers.get("x-cron-secret");
  return explicit?.trim() || null;
}

export function isAuthorizedCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 16) return false;
  const provided = getProvidedCronToken(req);
  if (!provided) return false;
  return constantTimeEquals(provided, expected);
}
