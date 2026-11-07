/**
 * The words a how-to adds around its own: what a screen reader calls a step's number and
 * a named part's, and the mark on today's set of mysteries. Each language writes its own.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

const KEYS = ["steps.step", "steps.part", "rosary.todayChip"];

describe("the words around a how-to", () => {
  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== "en"))("%s writes its own", (locale) => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/i18n/dictionaries", `${locale}.ts`),
      "utf8",
    );
    for (const key of KEYS) expect(source.includes(`"${key}":`), key).toBe(true);
  });

  it.each(SUPPORTED_LOCALES)("%s fills in the number and the name", (locale) => {
    const t = createTranslator(locale);
    expect(t("steps.step", { n: 3 })).toMatch(/3/);
    expect(t("steps.part", { n: 3 })).toMatch(/3/);
    expect(t("steps.step", { n: 3 })).not.toBe(t("steps.part", { n: 3 }));
    expect(t("rosary.todayChip")).toContain("{label}");
  });
});
