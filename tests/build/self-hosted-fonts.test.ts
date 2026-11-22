import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// The site's fonts live in src/app/_fonts and are loaded with next/font/local,
// because next/font/google downloads them during `next build` and that download
// failed now and then on Railway, failing the deploy with it.

const ROOT = process.cwd();
const FONTS = path.join(ROOT, "src", "app", "_fonts");
const MODULE = readFileSync(path.join(FONTS, "index.ts"), "utf8");

const FAMILIES = {
  "cormorant-garamond": {
    family: "Cormorant Garamond",
    variable: "--font-serif-loaded",
    fallback: "Cormorant Garamond Fallback",
  },
  inter: { family: "Inter", variable: "--font-sans-loaded", fallback: "Inter Fallback" },
} as const;
type Folder = keyof typeof FAMILIES;

/** Every script source under src/, so an import anywhere is caught. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [full] : [];
  });
}

/** "inter/latin-ext.woff2" → ["inter", "latin-ext"]; italics share their roman's script. */
function partsOf(file: string): [Folder, string] {
  const match = file.match(/^([a-z-]+)\/([a-z-]+?)(?:-italic)?\.woff2$/);
  if (!match) throw new Error(`Unexpected font path: ${file}`);
  return [match[1] as Folder, match[2]!];
}

/** One entry per localFont() call in src/app/_fonts/index.ts. */
const calls = MODULE.split("localFont({")
  .slice(1)
  .map((body) => {
    const files = [...body.matchAll(/path: "\.\/([^"]+)"/g)].map((match) => match[1]!);
    return {
      body,
      files,
      folder: partsOf(files[0]!)[0],
      scripts: new Set(files.map((file) => partsOf(file)[1])),
      range: body.match(/prop: "unicode-range",\s*value:\s*"([^"]+)"/)?.[1],
      preload: body.match(/preload: (true|false)/)?.[1],
    };
  });

describe("the site's fonts", () => {
  it("are never fetched from Google Fonts by the build", () => {
    const importers = sourceFiles(path.join(ROOT, "src")).filter((file) =>
      /["']next\/font\/google["']/.test(readFileSync(file, "utf8")),
    );
    expect(importers).toEqual([]);
  });

  it("come with their licence beside them", () => {
    const folders = readdirSync(FONTS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(folders.sort()).toEqual(Object.keys(FAMILIES).sort());
    for (const folder of folders) {
      const licence = readFileSync(path.join(FONTS, folder, "OFL.txt"), "utf8");
      expect(licence).toContain("SIL Open Font License, Version 1.1");
    }
  });

  it("are all declared, and every declared file is there", () => {
    const onDisk = Object.keys(FAMILIES).flatMap((folder) =>
      readdirSync(path.join(FONTS, folder))
        .filter((file) => file.endsWith(".woff2"))
        .map((file) => `${folder}/${file}`),
    );
    const declared = new Set(calls.flatMap((call) => call.files));
    expect([...declared].sort()).toEqual(onDisk.sort());
  });

  it("give each call one script's files and that script's range, the same in both families", () => {
    const rangeOf = new Map<string, string>();
    for (const call of calls) {
      expect(call.scripts.size).toBe(1);
      const [script] = [...call.scripts];
      expect(call.range).toBeTruthy();
      expect(call.range).toBe(rangeOf.get(script!) ?? call.range);
      rangeOf.set(script!, call.range!);
    }
    expect([...rangeOf.keys()].sort()).toEqual([
      "cyrillic",
      "cyrillic-ext",
      "greek",
      "greek-ext",
      "latin",
      "latin-ext",
      "vietnamese",
    ]);
  });

  it("name one family, one variable and one fallback in every call of a typeface", () => {
    // Every call's class goes on <html> and sets the same variable, so the values must agree.
    for (const call of calls) {
      const { family, variable, fallback } = FAMILIES[call.folder];
      expect(call.body).toContain(`{ prop: "font-family", value: "${family}" }`);
      expect(call.body).toContain(`variable: "${variable}"`);
      expect(call.body).toContain(`fallback: ["'${fallback}'"]`);
      expect(call.body).toContain("adjustFontFallback: false");
    }
    const css = readFileSync(path.join(ROOT, "src", "app", "globals.css"), "utf8");
    for (const { fallback } of Object.values(FAMILIES)) {
      expect(css).toContain(`font-family: "${fallback}";`);
    }
  });

  it("preload only the Latin files, and list Latin last so it keeps the marks it shares", () => {
    expect(calls.filter((call) => call.preload === "true").map((call) => call.files[0])).toEqual([
      "cormorant-garamond/latin-italic.woff2",
      "inter/latin.woff2",
    ]);
    expect(calls.every((call) => call.preload !== undefined)).toBe(true);
    for (const folder of Object.keys(FAMILIES)) {
      const order = calls
        .filter((call) => call.folder === folder)
        .map((call) => [...call.scripts][0]);
      expect(order.slice(-2)).toEqual(["latin-ext", "latin"]);
    }
  });
});
