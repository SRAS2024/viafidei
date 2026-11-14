import { describe, expect, it } from "vitest";
import { renderWelcomeEmail } from "@/lib/email/templates";

const baseParams = {
  firstName: "Maria",
  fullName: "Maria Goretti",
  siteUrl: "https://etviafidei.com",
  verifyUrl: "https://etviafidei.com/verify-email?token=tkn",
} as const;

describe("renderWelcomeEmail (required wording)", () => {
  it("uses the exact required message in HTML and text", () => {
    const out = renderWelcomeEmail({ ...baseParams, locale: "en" });
    const required = "Welcome, Maria Goretti. Account creation successful.";
    expect(out.htmlBody).toContain(required);
    expect(out.textBody).toContain(required);
  });

  it("subject is exactly 'Welcome!'", () => {
    const out = renderWelcomeEmail({ ...baseParams, locale: "en" });
    expect(out.subject).toBe("Welcome!");
  });

  it("includes a link back to Via Fidei in the footer", () => {
    const out = renderWelcomeEmail({ ...baseParams, locale: "en" });
    expect(out.htmlBody).toContain('href="https://etviafidei.com"');
  });

  it("embeds the verify-email link as the CTA (combined welcome + verify flow)", () => {
    const out = renderWelcomeEmail({ ...baseParams, locale: "en" });
    expect(out.htmlBody).toContain("/verify-email?token=tkn");
    expect(out.textBody).toContain("/verify-email?token=tkn");
  });

  it("includes the brand name throughout", () => {
    const out = renderWelcomeEmail({ ...baseParams, locale: "en" });
    expect(out.htmlBody).toContain("Via Fidei");
    expect(out.textBody).toContain("Via Fidei");
  });

  it("shows the crucifix logo as a hosted image, since Gmail and Outlook drop inline SVG", () => {
    const out = renderWelcomeEmail({ ...baseParams, locale: "en" });
    expect(out.htmlBody).toContain('src="https://etviafidei.com/email/crucifix-logo.png"');
    expect(out.htmlBody).not.toContain("<svg");
  });

  it("writes the whole message, subject included, in the member's own language", () => {
    for (const locale of [
      "es",
      "fr",
      "it",
      "de",
      "pt",
      "pl",
      "la",
      "tl",
      "vi",
      "ko",
      "zh",
    ] as const) {
      const out = renderWelcomeEmail({ ...baseParams, locale });
      expect(out.subject, locale).not.toBe("Welcome!");
      expect(out.htmlBody, locale).not.toContain("Account creation successful");
      expect(out.textBody, locale).not.toContain("Account creation successful");
      expect(out.htmlBody, locale).toContain("Maria Goretti");
      expect(out.htmlBody, locale).toContain(`lang="${locale === "zh" ? "zh-Hans" : locale}"`);
    }
  });
});
