/**
 * /sitemap.xml (index) and /sitemaps/[type]/[chunk].xml.
 *
 * robots.txt has always named /sitemap.xml, so the URL must keep answering —
 * it now returns a sitemap INDEX rather than one `<urlset>` that would blow
 * past the 50,000-URL protocol limit as the directory grows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const listSitemapChunks = vi.fn();
const listSitemapUrls = vi.fn();

vi.mock("@/lib/data/sitemap", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/sitemap")>("@/lib/data/sitemap");
  return {
    ...actual,
    listSitemapChunks: (...args: unknown[]) => listSitemapChunks(...args),
    listSitemapUrls: (...args: unknown[]) => listSitemapUrls(...args),
  };
});

import { GET as chunkGet } from "@/app/sitemaps/[type]/[chunk]/route";
import { GET as indexGet } from "@/app/sitemap.xml/route";
import robots from "@/app/robots";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/sitemap.xml", () => {
  it("is a sitemap index that points at every chunk", async () => {
    listSitemapChunks.mockResolvedValue([
      { key: "pages", chunk: 0, lastModified: new Date("2026-09-01T00:00:00.000Z") },
      { key: "parish", chunk: 0, lastModified: new Date("2026-09-02T00:00:00.000Z") },
      { key: "parish", chunk: 1, lastModified: new Date("2026-09-02T00:00:00.000Z") },
    ]);
    const res = await indexGet();
    const xml = await res.text();

    expect(res.headers.get("content-type")).toContain("application/xml");
    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("/sitemaps/pages/0.xml");
    expect(xml).toContain("/sitemaps/parish/1.xml");
    expect(xml).toContain("<lastmod>2026-09-02T00:00:00.000Z</lastmod>");
    // An index must not carry URLs of its own.
    expect(xml).not.toContain("<urlset");
  });

  it("is the URL robots.txt advertises", () => {
    const sitemap = robots().sitemap;
    expect(String(sitemap)).toContain("/sitemap.xml");
  });
});

describe("/sitemaps/[type]/[chunk].xml", () => {
  it("emits a urlset for the requested chunk", async () => {
    listSitemapUrls.mockResolvedValue([
      {
        loc: "/saints/agnes-of-rome",
        lastModified: new Date("2026-01-01T00:00:00.000Z"),
        changeFrequency: "weekly",
        priority: 0.6,
      },
    ]);
    const res = await chunkGet(new Request("http://localhost/sitemaps/saint/0.xml"), {
      params: Promise.resolve({ type: "saint", chunk: "0.xml" }),
    });
    const xml = await res.text();
    expect(listSitemapUrls).toHaveBeenCalledWith("saint", 0);
    expect(xml).toContain("<urlset");
    expect(xml).toContain("/saints/agnes-of-rome");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
  });

  it("answers a guessed URL with an empty urlset, not a crash", async () => {
    listSitemapUrls.mockResolvedValue([]);
    const res = await chunkGet(new Request("http://localhost/sitemaps/nope/x"), {
      params: Promise.resolve({ type: "nope", chunk: "x" }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<urlset");
    // A non-numeric chunk falls back to the first chunk rather than NaN.
    expect(listSitemapUrls).toHaveBeenCalledWith("nope", 0);
  });

  it("escapes XML metacharacters in a URL", async () => {
    listSitemapUrls.mockResolvedValue([
      {
        loc: "/parishes/a&b",
        lastModified: new Date("2026-01-01T00:00:00.000Z"),
        changeFrequency: "weekly",
        priority: 0.6,
      },
    ]);
    const res = await chunkGet(new Request("http://localhost/sitemaps/parish/0.xml"), {
      params: Promise.resolve({ type: "parish", chunk: "0.xml" }),
    });
    const xml = await res.text();
    expect(xml).toContain("a&amp;b");
    expect(xml).not.toContain("a&b");
  });
});
