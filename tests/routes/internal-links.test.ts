import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Comprehensive broken-link guard. Every static `href` in the app (pages and
 * components) must resolve to a real Next.js route — a page route for normal
 * links, an API route for endpoint links (downloads, form posts). This is the
 * net that catches regressions like the homepage quick links pointing at
 * moved `/spiritual-life#…` anchors or `/spiritual-guidance`.
 */
const ROOT = path.resolve(__dirname, "..", "..");
const APP = path.join(ROOT, "src", "app");

function collectRoutePatterns(dir: string, base: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const seg = entry.name.startsWith("(") && entry.name.endsWith(")") ? "" : entry.name;
      collectRoutePatterns(full, seg ? `${base}/${seg}` : base, out);
    } else if (entry.name === "page.tsx" || entry.name === "route.ts") {
      out.push(base || "/");
    }
  }
}

const PATTERNS = (() => {
  const out: string[] = [];
  collectRoutePatterns(APP, "", out);
  return out;
})();

// Turn a route pattern into a matcher regex; [slug]/[id]/[...rest] → one segment.
const MATCHERS = PATTERNS.map(
  (p) => new RegExp(`^${p.replace(/\[\.\.\.[^\]]+\]/g, ".+").replace(/\[[^\]]+\]/g, "[^/]+")}$`),
);

function resolves(href: string, hadTemplate: boolean): boolean {
  if (MATCHERS.some((re) => re.test(href))) return true;
  // A templated href like `/admin/checklist/item/${id}` strips to a prefix; it
  // resolves if some route continues from there (e.g. /admin/checklist/item/[id]).
  if (hadTemplate && PATTERNS.some((p) => p === href || p.startsWith(`${href}/`))) return true;
  return false;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name) && !full.includes("test")) out.push(full);
  }
}

const HREF_RE = /href=(?:"|\{`)(\/[A-Za-z0-9/_$.{}#?=-]*)/g;

describe("internal links resolve to real routes", () => {
  it("has no href pointing at a nonexistent page or API route", () => {
    const files: string[] = [];
    walk(path.join(ROOT, "src", "app"), files);
    walk(path.join(ROOT, "src", "components"), files);

    const broken = new Set<string>();
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(HREF_RE)) {
        const raw = m[1]!;
        const hadTemplate = raw.includes("${");
        // Strip any template-expression tail, hash, query, and trailing slash.
        let href = raw.split("${")[0]!.split("#")[0]!.split("?")[0]!;
        href = href.replace(/\/$/, "") || "/";
        if (!resolves(href, hadTemplate)) broken.add(`${href} (${file.replace(ROOT, "")})`);
      }
    }
    expect([...broken].sort()).toEqual([]);
  });
});
