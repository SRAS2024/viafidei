/**
 * Untranslated text is marked with its own language, so VoiceOver reads it in the right
 * voice: English as English, and a Latin title as Latin, never in an English voice.
 */
import { describe, expect, it } from "vitest";

import { englishWhereUntranslated } from "@/lib/translation/shown-language";

describe("englishWhereUntranslated", () => {
  it("marks untranslated English on a page in another language", () => {
    expect(englishWhereUntranslated("es", "The Holy Rosary", "The Holy Rosary")).toBe("en");
    expect(englishWhereUntranslated("es", "El Santo Rosario", "The Holy Rosary")).toBeUndefined();
    expect(englishWhereUntranslated("en", "The Holy Rosary", "The Holy Rosary")).toBeUndefined();
  });

  it("leaves a Latin title in the Latin site's own language, and marks it Latin elsewhere", () => {
    expect(englishWhereUntranslated("la", "Anima Christi", "Anima Christi")).toBeUndefined();
    expect(englishWhereUntranslated("la", "Salve Regina", "Salve Regina")).toBeUndefined();
    expect(englishWhereUntranslated("ko", "Salve Regina", "Salve Regina")).toBe("la");
    expect(englishWhereUntranslated("la", "The Holy Rosary", "The Holy Rosary")).toBe("en");
  });
});
