import { describe, expect, it } from "vitest";
import { renderThankYouEmail, thankYouDictionary, THANK_YOU_LOCALES } from "@/lib/email/thank-you";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";

const counts = {
  prayers: 1028,
  litanies: 24,
  devotions: 106,
  novenas: 104,
  saints: 3752,
  apparitions: 52,
  marianTitles: 61,
  doctors: 38,
  popes: 265,
  parishes: 271768,
  spiritualLife: 55,
  guides: 103,
  liturgy: 145,
  rites: 36,
  history: 1427,
  churchDocuments: 268,
};
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

  it("lists every section of the site in the menu's order, the calendar as complete, and no sacraments", () => {
    const out = renderThankYouEmail({ language: "en", counts, siteUrl: site });
    const rows = [
      ...out.htmlBody.matchAll(/<th scope="row"[^>]*>([^<]+)<\/th><td[^>]*>([^<]+)<\/td>/g),
    ].map((m) => `${m[1]} ${m[2]}`);
    expect(rows).toEqual([
      "Prayers 1,028",
      "Litanies 24",
      "Devotions 106",
      "Novenas 104",
      "Saints 3,752",
      "Apparitions 52",
      "Marian Titles 61",
      "Doctors of the Church 38",
      "Popes 265",
      "Parishes 271,768",
      "Spiritual Life 55",
      "Guides 103",
      "Liturgy 145",
      "Liturgical Calendar Complete",
      "Rites 36",
      "History 1,427",
      "Church Documents 268",
    ]);
    expect(out.htmlBody).not.toMatch(/sacrament/i);
  });

  it("is written for every language the site offers", () => {
    expect([...THANK_YOU_LOCALES].sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it("is fully translated: every sentence is in the member's language", () => {
    const en = thankYouDictionary("en");
    const keys = Object.keys(en) as Array<keyof typeof en>;
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== "en")) {
      const t = thankYouDictionary(locale);
      for (const key of keys) {
        expect(t[key].trim().length, `${locale}.${key}`).toBeGreaterThan(0);
        // Row labels may be spelled as in English (French "Saints", Spanish
        // "Novenas"); every sentence and the sign-off must be translated.
        if (key.startsWith("label") || key === "valueComplete" || key === "signoffTeam") continue;
        expect(t[key], `${locale}.${key}`).not.toBe(en[key]);
      }
      const labels = keys.filter((k) => k.startsWith("label"));
      const translated = labels.filter((k) => t[k] !== en[k]).length;
      expect(translated, `${locale} labels translated`).toBeGreaterThanOrEqual(labels.length / 2);
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

  it("links the site's address under the team's name, and closes with the copyright notice", () => {
    const out = renderThankYouEmail({ language: "en", counts, siteUrl: site });
    expect(out.htmlBody).toMatch(
      /The Via Fidei Team<br><a href="https:\/\/etviafidei\.com"[^>]*>etviafidei\.com<\/a>/,
    );
    const year = new Date().getUTCFullYear();
    expect(out.htmlBody).toContain(`© ${year} Via Fidei. All rights reserved.`);
    expect(out.textBody.trimEnd().endsWith(`© ${year} Via Fidei. All rights reserved.`)).toBe(true);
    // The old tagline is gone from the foot of the letter.
    expect(out.htmlBody).not.toContain("a reverent, private Catholic companion");
    expect(renderThankYouEmail({ language: "es", counts, siteUrl: site }).htmlBody).toContain(
      "Todos los derechos reservados.",
    );
  });
});
