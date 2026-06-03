import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PRIMARY_NAV } from "@/components/layout/HeaderNav";
import { QUICK_LINKS } from "@/app/_sections/HomeQuickLinks";

// Walk src/app and collect every Next.js page.tsx route. The path of a
// page.tsx file (minus app/ prefix and trailing /page.tsx) is the public
// URL pattern Next serves. This lets us assert that every navigation link
// actually has a backing page.

const APP_ROOT = path.resolve(__dirname, "..", "..", "src", "app");

function collectPages(dir: string, base: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) continue; // _components, _sections, etc.
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Route groups are wrapped in (parens) and don't appear in URLs.
      const segment = entry.name.startsWith("(") && entry.name.endsWith(")") ? "" : entry.name;
      const nextBase = segment ? `${base}/${segment}` : base;
      collectPages(full, nextBase, out);
    } else if (entry.isFile() && entry.name === "page.tsx") {
      out.push(base || "/");
    }
  }
}

const PAGE_ROUTES = (() => {
  const out: string[] = [];
  collectPages(APP_ROOT, "", out);
  return out;
})();

function staticFromPattern(pattern: string): string | null {
  // Skip dynamic patterns ([slug], [id], [...rest]) — those aren't directly
  // testable as static URLs.
  if (pattern.includes("[")) return null;
  return pattern;
}

const STATIC_ROUTES = new Set(
  PAGE_ROUTES.map(staticFromPattern).filter((r): r is string => r !== null),
);

describe("route coverage", () => {
  it("discovers a non-trivial set of pages (smoke check)", () => {
    expect(PAGE_ROUTES.length).toBeGreaterThan(15);
  });

  it.each(PRIMARY_NAV)("primary nav link $href has a backing page.tsx", ({ href }) => {
    expect(STATIC_ROUTES.has(href)).toBe(true);
  });

  // A concrete href resolves if it's a static route or its parent has a [slug] page.
  function hrefResolves(href: string): boolean {
    const clean = href.split("#")[0]!.split("?")[0]!;
    if (STATIC_ROUTES.has(clean)) return true;
    const parent = clean.split("/").slice(0, -1).join("/");
    return PAGE_ROUTES.includes(`${parent}/[slug]`);
  }

  it.each(QUICK_LINKS)("homepage quick link $href resolves to a real route", ({ href }) => {
    expect(hrefResolves(href)).toBe(true);
  });

  const REQUIRED_STATIC_ROUTES = [
    "/",
    "/login",
    "/register",
    "/profile",
    "/profile/settings",
    "/search",
    "/prayers",
    "/saints",
    "/devotions",
    "/spiritual-life",
    "/our-lady",
    "/liturgy-history",
    "/admin",
    "/admin/users",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/privacy",
  ];

  it.each(REQUIRED_STATIC_ROUTES)("required static route %s exists as a page", (route) => {
    expect(STATIC_ROUTES.has(route)).toBe(true);
  });

  it("every dynamic content type has a [slug] detail page", () => {
    const detailPatterns = PAGE_ROUTES.filter((r) => r.includes("[slug]"));
    const expected = [
      "/prayers/[slug]",
      "/saints/[slug]",
      "/devotions/[slug]",
      "/spiritual-life/[slug]",
      "/our-lady/[slug]",
      "/liturgy-history/[slug]",
    ];
    for (const pattern of expected) {
      expect(detailPatterns).toContain(pattern);
    }
  });
});
