/**
 * The hero's buttons and the placeholders' sentence, in every site language. Every
 * non-English dictionary starts as a copy of English, so a key someone forgot would
 * silently show English to a Polish reader, beside whatever is already translated.
 */
import { describe, expect, it } from "vitest";

import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";

const EN = DICTIONARIES.en!;

describe.each([
  "home.ctaExplore",
  "home.ctaJoin",
  "home.ctaProfile",
  "common.loadingContent",
  "common.loadingReadings",
  "common.loadingCalendar",
  "common.loadingLiturgy",
  "common.loadingPrayer",
  "common.loadingSaints",
])("%s", (key) => {
  it("has its English words", () => {
    expect(EN[key]).toBeTruthy();
  });

  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== "en"))(
    "is translated in %s",
    (locale) => {
      const text = DICTIONARIES[locale]![key];
      expect(text).toBeTruthy();
      expect(text).not.toBe(EN[key]);
    },
  );
});
