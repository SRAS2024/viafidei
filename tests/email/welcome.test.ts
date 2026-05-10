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

  it("includes the cross logo SVG inline", () => {
    const out = renderWelcomeEmail({ ...baseParams, locale: "en" });
    expect(out.htmlBody).toContain("<svg");
    expect(out.htmlBody).toContain('aria-label="Via Fidei"');
  });

  it("preserves the required wording even in non-English locales", () => {
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
      expect(out.subject).toBe("Welcome!");
      expect(out.htmlBody).toContain("Welcome, Maria Goretti. Account creation successful.");
    }
  });
});
