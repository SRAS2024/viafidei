import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.resolve(__dirname, "..", "..", "public");

describe("Google Search Console verification file", () => {
  it("public/google0292583cfdf40074.html exists", () => {
    const file = path.join(PUBLIC_DIR, "google0292583cfdf40074.html");
    expect(fs.existsSync(file)).toBe(true);
  });

  it("the verification file body matches its filename (Google's verification rule)", () => {
    const filename = "google0292583cfdf40074.html";
    const body = fs.readFileSync(path.join(PUBLIC_DIR, filename), "utf8").trim();
    // Google's required body is exactly: `google-site-verification: <filename>`
    expect(body).toBe(`google-site-verification: ${filename}`);
  });
});

describe("sitemap is served from a single source", () => {
  const APP_DIR = path.resolve(__dirname, "..", "..", "src", "app");

  it("there is no static public/sitemap.xml — the app route is authoritative", () => {
    const staticSitemap = path.join(PUBLIC_DIR, "sitemap.xml");
    expect(fs.existsSync(staticSitemap)).toBe(false);
  });

  it("/sitemap.xml is served by the sitemap-index route", () => {
    expect(fs.existsSync(path.join(APP_DIR, "sitemap.xml", "route.ts"))).toBe(true);
  });

  it("the chunked sitemaps exist alongside it", () => {
    expect(fs.existsSync(path.join(APP_DIR, "sitemaps", "[type]", "[chunk]", "route.ts"))).toBe(
      true,
    );
  });

  it("the old single-file src/app/sitemap.ts is gone — two routes cannot own /sitemap.xml", () => {
    // Next.js would refuse to build with both a `sitemap.ts` metadata file and
    // a `sitemap.xml/route.ts` handler; the index route replaced it.
    expect(fs.existsSync(path.join(APP_DIR, "sitemap.ts"))).toBe(false);
  });
});
