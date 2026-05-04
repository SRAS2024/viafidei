import { describe, expect, it } from "vitest";
import { renderWelcomeEmail } from "@/lib/email/templates";

describe("renderWelcomeEmail (required wording)", () => {
  it("uses the exact required message in HTML and text", () => {
    const out = renderWelcomeEmail({
      firstName: "Maria",
      fullName: "Maria Goretti",
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    const required = "Welcome, Maria Goretti. Account creation successful.";
    expect(out.htmlBody).toContain(required);
    expect(out.textBody).toContain(required);
  });

  it("subject is exactly 'Welcome!'", () => {
    const out = renderWelcomeEmail({
      firstName: "Maria",
      fullName: "Maria Goretti",
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    expect(out.subject).toBe("Welcome!");
  });

  it("includes a link back to Via Fidei", () => {
    const out = renderWelcomeEmail({
      firstName: "Maria",
      fullName: "Maria Goretti",
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    expect(out.htmlBody).toContain('href="https://etviafidei.com"');
  });

  it("includes the brand name throughout", () => {
    const out = renderWelcomeEmail({
      firstName: "Maria",
      fullName: "Maria Goretti",
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
    expect(out.htmlBody).toContain("Via Fidei");
    expect(out.textBody).toContain("Via Fidei");
  });

  it("includes the cross logo SVG inline", () => {
    const out = renderWelcomeEmail({
      firstName: "Maria",
      fullName: "Maria Goretti",
      siteUrl: "https://etviafidei.com",
      locale: "en",
    });
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
      const out = renderWelcomeEmail({
        firstName: "Maria",
        fullName: "Maria Goretti",
        siteUrl: "https://etviafidei.com",
        locale,
      });
      expect(out.subject).toBe("Welcome!");
      expect(out.htmlBody).toContain("Welcome, Maria Goretti. Account creation successful.");
    }
  });
});
