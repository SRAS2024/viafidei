import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";

/**
 * Guards against the "raw key on screen" bug: a `t("some.key")` call whose key
 * is missing from the dictionary renders the literal key string to the user.
 * (This was happening on the Sacraments and Today's-Feast-Day-Saints heroes.)
 *
 * We scan the UI for standalone `t("dotted.key")` calls — the `\bt(` boundary
 * excludes `.get(` / `.set(` / `format(` etc., and the lowercase-first dotted
 * shape targets real i18n keys — and assert every one is defined in the
 * default dictionary.
 */
const ROOT = process.cwd();
const DEFAULT_DICT = DICTIONARIES[DEFAULT_LOCALE] as Record<string, string>;
const KEY_RE = /\bt\(\s*"([a-z][a-zA-Z]*\.[a-zA-Z0-9_.]+)"/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe("i18n: every translation key used in the UI is defined", () => {
  it("has no undefined t() keys that would render as raw text", () => {
    const files = [...walk(join(ROOT, "src", "app")), ...walk(join(ROOT, "src", "components"))];
    const missing = new Set<string>();
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const match of src.matchAll(KEY_RE)) {
        const key = match[1]!;
        if (!(key in DEFAULT_DICT)) missing.add(`${key} (${file.replace(ROOT, "")})`);
      }
    }
    expect([...missing].sort()).toEqual([]);
  });
});
