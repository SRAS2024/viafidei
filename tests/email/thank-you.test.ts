import { describe, expect, it } from "vitest";
import { renderThankYouEmail, thankYouDictionary, THANK_YOU_LOCALES } from "@/lib/email/thank-you";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";

const SAME_IN_FRENCH = new Set(["labelSaints", "labelApparitions", "labelGuides"]);
const counts = { saints: 3752, apparitions: 52, churchDocuments: 268, prayers: 1028, guides: 103 };
const site = "https://etviafidei.com";

describe("the thank-you letter", () => {
  it("is the owner's wording in English", () => {
    const out = renderThankYouEmail({ language: "en", counts, siteUrl: site });
    expect(out.subject).toBe("Thank you!");
    for (const line of [
      "We would like to thank you for using our platform.",
      "help the Church fulfill her mission of spreading the Good News.",
      "If you know anyone else that may find use in our website, give it a share and introduce them to it.",
      "Maybe share your favorite prayer or saint.",
      "We will be developing more features while maintaining an easy-to-use page.",
      "In the coming months we plan to roll out:",
      "An audio companion that will help people with prayers.",
      "A feedback feature for product requests and issue reporting.",
      "We look forward to seeing how this project grows, as we already have dozens of users!",
      "Blessings,",
      "The Via Fidei Team",
    ]) {
      expect(out.textBody).toContain(line);
      expect(out.htmlBody).toContain(line.replace(/'/g, "&#39;"));
    }
  });

  it("lists the three plans as a bulleted list", () => {
    const out = renderThankYouEmail({ language: "en", counts, siteUrl: site });
    expect(out.htmlBody.match(/<li /g)).toHaveLength(3);
  });

  it("puts the five figures in a table, in the owner's order, and no sacraments", () => {
    const out = renderThankYouEmail({ language: "en", counts, siteUrl: site });
    const rows = [
      ...out.htmlBody.matchAll(/<th scope="row"[^>]*>([^<]+)<\/th><td[^>]*>([^<]+)<\/td>/g),
    ].map((m) => `${m[1]} ${m[2]}`);
    expect(rows).toEqual([
      "Saints 3,752",
      "Apparitions 52",
      "Church Documents 268",
      "Prayers 1,028",
      "Guides 103",
    ]);
    expect(out.htmlBody).not.toMatch(/sacrament/i);
  });

  it("is written for every language the site offers", () => {
    expect([...THANK_YOU_LOCALES].sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it("is fully translated: no language but English carries the English text", () => {
    const en = thankYouDictionary("en");
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== "en")) {
      const t = thankYouDictionary(locale);
      for (const key of Object.keys(en) as Array<keyof typeof en>) {
        expect(t[key].trim().length, `${locale}.${key}`).toBeGreaterThan(0);
        if (key === "signoffTeam") continue; // "Via Fidei" stays as the name
        // French spells these three row labels as English does (they are the
        // site's own French words); every sentence must still be translated.
        if (locale === "fr" && SAME_IN_FRENCH.has(key)) continue;
        expect(t[key], `${locale}.${key}`).not.toBe(en[key]);
      }
      expect(t.signoffTeam, locale).toContain("Via Fidei");
    }
  });

  it("goes out in the member's saved language, falling back to English", () => {
    expect(renderThankYouEmail({ language: "es", counts, siteUrl: site }).locale).toBe("es");
    expect(renderThankYouEmail({ language: "zh", counts, siteUrl: site }).htmlBody).toContain(
      'lang="zh-Hans"',
    );
    expect(renderThankYouEmail({ language: "xx", counts, siteUrl: site }).locale).toBe("en");
    expect(renderThankYouEmail({ language: null, counts, siteUrl: site }).subject).toBe(
      "Thank you!",
    );
  });

  it("formats the figures for each language", () => {
    expect(renderThankYouEmail({ language: "de", counts, siteUrl: site }).textBody).toMatch(
      /3\.752/,
    );
  });

  it("links the site's address in the footer so it is easy to share", () => {
    const out = renderThankYouEmail({ language: "en", counts, siteUrl: site });
    expect(out.htmlBody).toContain('href="https://etviafidei.com"');
    expect(out.htmlBody).toContain(">etviafidei.com</a>");
  });
});
