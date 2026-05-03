import { describe, expect, it } from "vitest";
import { renderEmailVerificationEmail, renderPasswordResetEmail } from "@/lib/email/templates";

describe("renderPasswordResetEmail", () => {
  it("contains a clear subject and reset URL in both bodies", () => {
    const url = "https://app.example.com/reset-password?token=abc";
    const expiresAt = new Date("2026-01-01T00:00:00Z");
    const out = renderPasswordResetEmail({ resetUrl: url, expiresAt });
    expect(out.subject).toMatch(/reset/i);
    expect(out.textBody).toContain(url);
    expect(out.htmlBody).toContain(url);
  });

  it("html-escapes URLs that contain unsafe characters", () => {
    const url = "https://app.example.com/reset-password?token=a&b=<x>";
    const out = renderPasswordResetEmail({
      resetUrl: url,
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(out.htmlBody).not.toContain("<x>");
    expect(out.htmlBody).toContain("&lt;x&gt;");
    // Plain text body is not escaped (it's not HTML).
    expect(out.textBody).toContain(url);
  });
});

describe("renderEmailVerificationEmail", () => {
  it("contains the verification URL in both bodies", () => {
    const url = "https://app.example.com/verify-email?token=abc";
    const out = renderEmailVerificationEmail({
      verifyUrl: url,
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(out.subject).toMatch(/verify/i);
    expect(out.textBody).toContain(url);
    expect(out.htmlBody).toContain(url);
  });
});
