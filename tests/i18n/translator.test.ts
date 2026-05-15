import { describe, expect, it } from "vitest";
import { createTranslator, getDictionary } from "@/lib/i18n/translator";
import { DEFAULT_LOCALE, FALLBACK_LOCALE, type Locale } from "@/lib/i18n/locales";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";

describe("getDictionary", () => {
  it("returns the matching dictionary for every supported locale", () => {
    for (const locale of Object.keys(DICTIONARIES) as Locale[]) {
      const d = getDictionary(locale);
      expect(d).toBe(DICTIONARIES[locale]);
    }
  });

  it("falls back to FALLBACK_LOCALE when the locale is not in the dictionary table", () => {
    // Pass an explicit unknown locale via the typed seam.
    const dict = getDictionary("xx" as unknown as Locale);
    expect(dict).toBe(DICTIONARIES[FALLBACK_LOCALE]);
  });
});

describe("createTranslator", () => {
  it("returns the locale-specific value when the key exists", () => {
    const t = createTranslator(DEFAULT_LOCALE);
    const dict = DICTIONARIES[DEFAULT_LOCALE];
    const firstKey = Object.keys(dict)[0];
    expect(t(firstKey)).toBe(dict[firstKey]);
  });

  it("falls back to the DEFAULT_LOCALE dictionary when the key is missing from the requested locale", () => {
    // Pick a key that exists in the default dictionary and verify a locale
    // that doesn't have a custom translation falls back to it.
    const defaultDict = DICTIONARIES[DEFAULT_LOCALE];
    const seedKey = "_test_fallback_only";
    // Mutate the default dictionary in place — same reference the translator
    // reads at call time.
    defaultDict[seedKey] = "DEFAULT VALUE";
    try {
      // Find a locale whose dictionary is missing this key.
      const otherLocale = (Object.keys(DICTIONARIES) as Locale[]).find(
        (l) => l !== DEFAULT_LOCALE && DICTIONARIES[l][seedKey] === undefined,
      );
      expect(otherLocale).toBeDefined();
      if (!otherLocale) return;
      const t = createTranslator(otherLocale);
      expect(t(seedKey)).toBe("DEFAULT VALUE");
    } finally {
      delete defaultDict[seedKey];
    }
  });

  it("returns the key verbatim when the key is missing from both the requested and default dictionaries", () => {
    const t = createTranslator(DEFAULT_LOCALE);
    expect(t("definitely.does.not.exist.in.any.dictionary")).toBe(
      "definitely.does.not.exist.in.any.dictionary",
    );
  });

  it("interpolates {name}-style placeholders with the provided replacements", () => {
    const defaultDict = DICTIONARIES[DEFAULT_LOCALE];
    const seedKey = "_test_interpolation";
    defaultDict[seedKey] = "Hello, {name}! You have {count} messages.";
    try {
      const t = createTranslator(DEFAULT_LOCALE);
      expect(t(seedKey, { name: "Maria", count: 3 })).toBe("Hello, Maria! You have 3 messages.");
    } finally {
      delete defaultDict[seedKey];
    }
  });

  it("leaves placeholders intact when no replacements are passed", () => {
    const defaultDict = DICTIONARIES[DEFAULT_LOCALE];
    const seedKey = "_test_no_replacements";
    defaultDict[seedKey] = "Hello, {name}";
    try {
      const t = createTranslator(DEFAULT_LOCALE);
      expect(t(seedKey)).toBe("Hello, {name}");
    } finally {
      delete defaultDict[seedKey];
    }
  });

  it("replaces every occurrence of the same placeholder", () => {
    const defaultDict = DICTIONARIES[DEFAULT_LOCALE];
    const seedKey = "_test_repeat";
    defaultDict[seedKey] = "{name} said hi to {name} in the mirror";
    try {
      const t = createTranslator(DEFAULT_LOCALE);
      expect(t(seedKey, { name: "Maria" })).toBe("Maria said hi to Maria in the mirror");
    } finally {
      delete defaultDict[seedKey];
    }
  });
});
