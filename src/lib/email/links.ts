import { getEnv } from "@/lib/env";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getAppBaseUrl(): string {
  const env = getEnv();
  const base = env.APP_URL ?? env.CANONICAL_URL ?? "http://localhost:3000";
  return trimTrailingSlash(base);
}

export function getCanonicalUrl(): string {
  const env = getEnv();
  return trimTrailingSlash(env.CANONICAL_URL ?? "https://etviafidei.com");
}

export function buildPasswordResetLink(token: string): string {
  const url = new URL("/reset-password", getAppBaseUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildEmailVerificationLink(token: string): string {
  const url = new URL("/verify-email", getAppBaseUrl());
  url.searchParams.set("token", token);
  return url.toString();
}
