import { describe, expect, it } from "vitest";
import {
  buildPasswordResetLink,
  buildEmailVerificationLink,
  getAppBaseUrl,
} from "@/lib/email/links";
import { appConfig } from "@/lib/config";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

describe("buildPasswordResetLink / buildEmailVerificationLink", () => {
  it("builds links anchored at the configured app URL", () => {
    const expectedBase = trimTrailingSlash(appConfig.appUrl);
    expect(getAppBaseUrl()).toBe(expectedBase);
    expect(buildPasswordResetLink("abc")).toBe(`${expectedBase}/reset-password?token=abc`);
    expect(buildEmailVerificationLink("xyz")).toBe(`${expectedBase}/verify-email?token=xyz`);
  });

  it("URL-encodes the token", () => {
    const expectedBase = trimTrailingSlash(appConfig.appUrl);
    const link = buildPasswordResetLink("a b/c");
    expect(link.startsWith(`${expectedBase}/reset-password?token=`)).toBe(true);
    const url = new URL(link);
    expect(url.searchParams.get("token")).toBe("a b/c");
  });
});
