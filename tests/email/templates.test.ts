import { describe, expect, it } from "vitest";
import {
  renderEmailVerificationEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
  SITE_NAME,
  escapeHtml,
} from "@/lib/email/templates";

const FUTURE = new Date("2099-01-01T00:00:00Z");

describe("renderWelcomeEmail", () => {
  it("uses the required subject 'Welcome!' and required body wording", () => {
    const out = renderWelcomeEmail({
      firstName: "Maria",
      fullName: "Maria Goretti",
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    expect(out.subject).toBe("Welcome!");
    expect(out.textBody).toContain("Welcome, Maria Goretti. Account creation successful.");
    expect(out.htmlBody).toContain("Welcome, Maria Goretti. Account creation successful.");
  });

  it("includes the brand name and site URL link", () => {
    const out = renderWelcomeEmail({
      firstName: "Maria",
      fullName: "Maria Goretti",
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    expect(out.htmlBody).toContain(SITE_NAME);
    expect(out.htmlBody).toContain("https://etviafidei.com");
    expect(out.textBody).toContain("https://etviafidei.com");
  });

  it("includes both HTML and text bodies", () => {
    const out = renderWelcomeEmail({
      firstName: "Pio",
      fullName: "Pio Pietrelcina",
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    expect(out.htmlBody).toMatch(/<html/i);
    expect(out.textBody.length).toBeGreaterThan(0);
    expect(out.textBody).not.toMatch(/<html/i);
  });

  it("escapes HTML in the user's name", () => {
    const out = renderWelcomeEmail({
      firstName: "<script>",
      fullName: "<script>alert(1)</script>",
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    expect(out.htmlBody).not.toContain("<script>alert(1)</script>");
    expect(out.htmlBody).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("falls back to English when locale is unsupported", () => {
    const out = renderWelcomeEmail({
      firstName: "Maria",
      fullName: "Maria Goretti",
      siteUrl: "https://etviafidei.com",
      // @ts-expect-error - simulate runtime mistake
      locale: "klingon",
    });
    expect(out.subject).toBe("Welcome!");
    expect(out.htmlBody).toContain("Welcome, Maria Goretti. Account creation successful.");
  });

  it("renders the localized welcome heading in Spanish while keeping the required wording intact", () => {
    const out = renderWelcomeEmail({
      firstName: "Maria",
      fullName: "María Goretti",
      siteUrl: "https://etviafidei.com",
      locale: "es",
    });
    expect(out.subject).toBe("Welcome!");
    expect(out.htmlBody).toContain("Bienvenido a Via Fidei");
    expect(out.htmlBody).toContain("Welcome, María Goretti. Account creation successful.");
  });
});

describe("renderPasswordResetEmail", () => {
  it("uses the subject 'Password Reset' and includes the reset URL in both bodies", () => {
    const url = "https://etviafidei.com/reset-password?token=abc";
    const out = renderPasswordResetEmail({
      firstName: "Pio",
      fullName: "Pio Pietrelcina",
      resetUrl: url,
      expiresAt: FUTURE,
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    expect(out.subject).toBe("Password Reset");
    expect(out.textBody).toContain(url);
    expect(out.htmlBody).toContain(url);
  });

  it("uses 'Reset password for [User Name]' as the link text", () => {
    const url = "https://etviafidei.com/reset-password?token=abc";
    const out = renderPasswordResetEmail({
      firstName: "Pio",
      fullName: "Pio Pietrelcina",
      resetUrl: url,
      expiresAt: FUTURE,
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    expect(out.htmlBody).toContain("Reset password for Pio Pietrelcina");
    expect(out.textBody).toContain("Reset password for Pio Pietrelcina");
  });

  it("html-escapes URLs that contain unsafe characters", () => {
    const url = "https://etviafidei.com/reset-password?token=a&b=<x>";
    const out = renderPasswordResetEmail({
      firstName: "Pio",
      fullName: "Pio Pietrelcina",
      resetUrl: url,
      expiresAt: FUTURE,
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    expect(out.htmlBody).not.toContain("<x>");
    expect(out.htmlBody).toContain("&lt;x&gt;");
    expect(out.textBody).toContain(url);
  });

  it("escapes HTML in the user's name", () => {
    const out = renderPasswordResetEmail({
      firstName: "<x>",
      fullName: "<script>alert(1)</script>",
      resetUrl: "https://etviafidei.com/reset-password?token=a",
      expiresAt: FUTURE,
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    expect(out.htmlBody).not.toContain("<script>alert(1)</script>");
    expect(out.htmlBody).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("renderEmailVerificationEmail", () => {
  it("contains the verification URL in both bodies", () => {
    const url = "https://etviafidei.com/verify-email?token=abc";
    const out = renderEmailVerificationEmail({
      firstName: "Pio",
      fullName: "Pio Pietrelcina",
      verifyUrl: url,
      expiresAt: FUTURE,
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    expect(out.subject).toMatch(/verify/i);
    expect(out.textBody).toContain(url);
    expect(out.htmlBody).toContain(url);
  });

  it("uses the saved language for the email body", () => {
    const url = "https://etviafidei.com/verify-email?token=abc";
    const out = renderEmailVerificationEmail({
      firstName: "Maria",
      fullName: "Maria Goretti",
      verifyUrl: url,
      expiresAt: FUTURE,
      siteUrl: "https://etviafidei.com",
      locale: "fr",
    });
    expect(out.htmlBody).toContain("Vérifiez votre e-mail");
  });

  it("falls back to English for unsupported locales", () => {
    const url = "https://etviafidei.com/verify-email?token=abc";
    const out = renderEmailVerificationEmail({
      firstName: "Maria",
      fullName: "Maria Goretti",
      verifyUrl: url,
      expiresAt: FUTURE,
      siteUrl: "https://etviafidei.com",
      // @ts-expect-error - simulate runtime mistake
      locale: "klingon",
    });
    expect(out.htmlBody).toMatch(/Verify your Via Fidei email/);
  });
});

describe("escapeHtml", () => {
  it("escapes the five XML special characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});
