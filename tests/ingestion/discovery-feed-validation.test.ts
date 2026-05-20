/**
 * Discovery-feed validator tests (spec §15).
 */

import { describe, expect, it } from "vitest";
import {
  validateFactoryHandler,
  validateFixedUrlList,
  validateOfficialApiResponse,
  validateRssFeed,
  validateSitemap,
} from "@/lib/ingestion/sources/discovery-feed-validation";

describe("validateSitemap()", () => {
  it("accepts a normal urlset with <loc> entries", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.org/a</loc></url>
  <url><loc>https://example.org/b</loc></url>
</urlset>`;
    const result = validateSitemap(xml);
    expect(result.ok).toBe(true);
    expect(result.entryCount).toBe(2);
  });

  it("accepts a sitemapindex", () => {
    const xml = `<?xml version="1.0"?>
<sitemapindex>
  <sitemap><loc>https://example.org/s1.xml</loc></sitemap>
</sitemapindex>`;
    const result = validateSitemap(xml);
    expect(result.ok).toBe(true);
  });

  it("rejects a sitemap without a <urlset> root", () => {
    const result = validateSitemap("<html><body>Not a sitemap</body></html>");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/urlset/);
  });

  it("rejects a sitemap with no <loc> entries", () => {
    const result = validateSitemap("<urlset></urlset>");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no <loc>/);
  });
});

describe("validateRssFeed()", () => {
  it("accepts a normal RSS feed with <item> entries", () => {
    const xml = `<rss version="2.0">
  <channel>
    <item><title>One</title></item>
    <item><title>Two</title></item>
  </channel>
</rss>`;
    const result = validateRssFeed(xml);
    expect(result.ok).toBe(true);
    expect(result.entryCount).toBe(2);
  });

  it("accepts an Atom feed with <entry> entries", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>One</title></entry>
</feed>`;
    const result = validateRssFeed(xml);
    expect(result.ok).toBe(true);
    expect(result.entryCount).toBe(1);
  });

  it("rejects a non-feed document", () => {
    const result = validateRssFeed("<html><body>Hi</body></html>");
    expect(result.ok).toBe(false);
  });
});

describe("validateFixedUrlList()", () => {
  it("accepts a JSON array of URLs", () => {
    const body = JSON.stringify([
      "https://example.org/a",
      "https://example.org/b",
      "https://example.org/c",
    ]);
    const result = validateFixedUrlList(body);
    expect(result.ok).toBe(true);
    expect(result.entryCount).toBe(3);
  });

  it("accepts a newline-separated URL list", () => {
    const body = `https://example.org/a
https://example.org/b
https://example.org/c`;
    const result = validateFixedUrlList(body);
    expect(result.ok).toBe(true);
    expect(result.entryCount).toBe(3);
  });

  it("rejects a list with no URLs", () => {
    const result = validateFixedUrlList("just some text, no urls");
    expect(result.ok).toBe(false);
    expect(result.entryCount).toBe(0);
  });

  it("rejects malformed JSON", () => {
    const result = validateFixedUrlList("[not, valid, json");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/JSON parse failed/);
  });
});

describe("validateOfficialApiResponse()", () => {
  it("accepts a JSON 200", () => {
    const result = validateOfficialApiResponse({
      body: '{"ok": true}',
      contentType: "application/json",
      status: 200,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts an XML 200", () => {
    const result = validateOfficialApiResponse({
      body: "<response><ok/></response>",
      contentType: "application/xml",
      status: 200,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a 4xx / 5xx status", () => {
    const result = validateOfficialApiResponse({
      body: "Server error",
      status: 500,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a plain-text response", () => {
    const result = validateOfficialApiResponse({
      body: "plain text response",
      contentType: "text/plain",
      status: 200,
    });
    expect(result.ok).toBe(false);
  });
});

describe("validateFactoryHandler()", () => {
  it("accepts a registered handler key", () => {
    expect(validateFactoryHandler("factory_native").ok).toBe(true);
    expect(validateFactoryHandler("factory_handler").ok).toBe(true);
  });

  it("rejects an unregistered handler key", () => {
    const result = validateFactoryHandler("bogus_handler");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not registered/);
  });

  it("rejects an empty handler key", () => {
    expect(validateFactoryHandler("").ok).toBe(false);
  });
});
