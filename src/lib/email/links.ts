import { appConfig } from "@/lib/config";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getAppBaseUrl(): string {
  return trimTrailingSlash(appConfig.appUrl);
}

export function getCanonicalUrl(): string {
  return trimTrailingSlash(appConfig.canonicalUrl);
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
