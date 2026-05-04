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
  it("there is no static public/sitemap.xml — src/app/sitemap.ts is authoritative", () => {
    const staticSitemap = path.join(PUBLIC_DIR, "sitemap.xml");
    expect(fs.existsSync(staticSitemap)).toBe(false);
  });

  it("src/app/sitemap.ts is the single source of truth", () => {
    const dynamicSitemap = path.resolve(__dirname, "..", "..", "src", "app", "sitemap.ts");
    expect(fs.existsSync(dynamicSitemap)).toBe(true);
  });
});
