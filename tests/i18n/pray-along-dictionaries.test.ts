import { describe, expect, it } from "vitest";

import { DICTIONARIES } from "@/lib/i18n/dictionaries";

/**
 * The pray-along player's words in every language the site speaks: each button's name
 * and each change said in the status region, read aloud by VoiceOver in the reader's
 * own language, never in English or as a raw key.
 */
const ENGLISH = DICTIONARIES.en as Record<string, string>;
const KEYS = Object.keys(ENGLISH).filter((key) => key.startsWith("prayAlong."));

describe("pray-along words in every language", () => {
  it("has every one of the player's words in all 12 languages", () => {
    expect(Object.keys(DICTIONARIES)).toHaveLength(12);
    expect(KEYS).toContain("prayAlong.status.missing");
    for (const [locale, dict] of Object.entries(DICTIONARIES)) {
      for (const key of KEYS) {
        expect((dict as Record<string, string>)[key]?.trim(), `${locale} ${key}`).toBeTruthy();
      }
    }
  });

  it("keeps each button's {title} and the speed's {rate} in every language", () => {
    for (const [locale, dict] of Object.entries(DICTIONARIES)) {
      const d = dict as Record<string, string>;
      for (const key of ["play", "pause", "resume", "stop", "preparing"]) {
        expect(d[`prayAlong.${key}`], `${locale} ${key}`).toContain("{title}");
      }
      expect(d["prayAlong.speed"], locale).toContain("{rate}");
    }
  });

  it("says a line that can never be said apart from 'not ready yet', in the reader's language", () => {
    for (const [locale, dict] of Object.entries(DICTIONARIES)) {
      const d = dict as Record<string, string>;
      const missing = d["prayAlong.status.missing"]!;
      expect(missing, locale).not.toBe(d["prayAlong.status.unavailable"]);
      expect(missing, locale).not.toBe(d["prayAlong.status.error"]);
      if (locale !== "en") expect(missing, locale).not.toBe(ENGLISH["prayAlong.status.missing"]);
      // One sentence or two, ended as a sentence, so VoiceOver reads it as a statement.
      expect(missing, locale).toMatch(/[.。]$/);
    }
  });
});
