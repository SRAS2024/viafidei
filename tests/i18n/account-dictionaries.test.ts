/**
 * The words of the journal's messages and the forgot-password confirmation, in every site
 * language. Every non-English dictionary starts as a copy of English, so a key someone
 * forgot would silently show English to a Polish reader. A screen reader would then voice
 * it with the wrong language's sounds.
 */
import { describe, expect, it } from "vitest";

import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

const EN = DICTIONARIES.en!;

/** Each key with the placeholders its code fills in. */
const KEYS: Record<string, string[]> = {
  "auth.forgot.success": ["{email}"],
  "auth.forgot.invalidAddress": [],
  "profile.journal.empty": [],
  "profile.journal.emptyFavorites": [],
  "profile.journal.saved": [],
  "profile.journal.titleTooLong": ["{count}", "{max}"],
  "profile.journal.bodyTooLong": ["{count}", "{max}"],
  "profile.journal.signedOut": [],
  "profile.journal.logInNewTab": [],
  "profile.journal.rateLimited": [],
  "profile.journal.saveFailed": [],
  "profile.journal.serverFailed": [],
  "profile.journal.draftBack": [],
  "profile.journal.leaveWarning": [],
  "profile.journal.notSaved": ["{titleMax}", "{bodyMax}"],
  "profile.journal.pdfLabel": ["{title}"],
  "profile.journal.printButton": [],
};

describe("account and journal dictionaries", () => {
  it("covers every site language", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(12);
  });

  for (const [key, placeholders] of Object.entries(KEYS)) {
    it(`${key} is written out in all twelve languages, with its placeholders`, () => {
      for (const locale of SUPPORTED_LOCALES) {
        const text = DICTIONARIES[locale]?.[key];
        expect(text, `${locale} has ${key}`).toBeTruthy();
        for (const placeholder of placeholders) {
          expect(text, `${locale} ${key} keeps ${placeholder}`).toContain(placeholder);
        }
        if (locale !== "en") {
          expect(text, `${locale} ${key} is translated`).not.toBe(EN[key]);
        }
      }
    });
  }

  // The print page's line under the title. French writes it as English does; the rest differ.
  it("names the journal in every language", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const text = DICTIONARIES[locale]?.["profile.tab.journal"];
      expect(text, `${locale} has it`).toBeTruthy();
      if (locale !== "en" && locale !== "fr") {
        expect(text, `${locale} is translated`).not.toBe(EN["profile.tab.journal"]);
      }
    }
  });

  it("keeps a lost connection and a server failure apart", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const dict = DICTIONARIES[locale]!;
      expect(dict["profile.journal.serverFailed"]).not.toBe(dict["profile.journal.saveFailed"]);
    }
    expect(EN["profile.journal.saveFailed"]).toMatch(/connection/);
    expect(EN["profile.journal.serverFailed"]).not.toMatch(/connection/);
  });

  it("does not claim to have sent a reset email to an address that may have no account", () => {
    const t = createTranslator("en");
    const message = t("auth.forgot.success", { email: "nobody@example.test" });
    expect(message).toMatch(/^If an account exists for nobody@example\.test,/);
    expect(EN["auth.forgot.success"]).not.toMatch(/^A password reset email has been sent/);
  });

  it("tells the two empty journal views apart", () => {
    expect(EN["profile.journal.emptyFavorites"]).not.toBe(EN["profile.journal.empty"]);
    expect(EN["profile.journal.emptyFavorites"]).toMatch(/favorite/i);
  });
});
