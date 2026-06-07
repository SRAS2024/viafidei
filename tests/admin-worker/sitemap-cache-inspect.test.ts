/**
 * Generated-sitemap inspection + cache-freshness checksum helpers.
 */

import { describe, expect, it, vi } from "vitest";

import {
  expectedSitemapUrl,
  normalizeUrl,
  parseSitemapXml,
  fetchLiveSitemapUrls,
} from "@/lib/admin-worker/sitemap-inspect";
import {
  computeContentChecksum,
  fetchPublicRouteFreshness,
} from "@/lib/admin-worker/cache-freshness";

describe("sitemap-inspect", () => {
  it("builds an absolute public URL with the route builder", () => {
    const url = expectedSitemapUrl("https://viafidei.app/", "PRAYER", "our-father");
    expect(url).toBe("https://viafidei.app/prayers/our-father");
  });

  it("normalizes trailing slashes", () => {
    expect(normalizeUrl("https://x.app/prayers/our-father/")).toBe(
      "https://x.app/prayers/our-father",
    );
  });

  it("parses <loc> URLs out of sitemap XML", () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://x.app/</loc></url>
      <url><loc>https://x.app/prayers/our-father</loc></url>
    </urlset>`;
    const urls = parseSitemapXml(xml);
    expect(urls.has("https://x.app/prayers/our-father")).toBe(true);
    expect(urls.size).toBe(2);
  });

  it("returns null from the live probe when the fetch fails", async () => {
    const failing = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await fetchLiveSitemapUrls("https://x.app", failing)).toBeNull();
  });

  it("parses the live sitemap when reachable", async () => {
    const ok = vi.fn(async () => ({
      ok: true,
      text: async () => "<urlset><url><loc>https://x.app/saints/st-francis</loc></url></urlset>",
    })) as unknown as typeof fetch;
    const urls = await fetchLiveSitemapUrls("https://x.app", ok);
    expect(urls?.has("https://x.app/saints/st-francis")).toBe(true);
  });
});

describe("cache-freshness checksum", () => {
  it("is deterministic and order-independent for payloads", () => {
    const a = computeContentChecksum("Our Father", { b: 2, a: 1 });
    const b = computeContentChecksum("Our Father", { a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("changes when the title or payload changes", () => {
    const base = computeContentChecksum("Our Father", { text: "Amen" });
    expect(computeContentChecksum("Hail Mary", { text: "Amen" })).not.toBe(base);
    expect(computeContentChecksum("Our Father", { text: "changed" })).not.toBe(base);
  });

  it("reports fresh when the served HTML contains the latest title", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () => "<html><h1>Our Father</h1></html>",
    })) as unknown as typeof fetch;
    const res = await fetchPublicRouteFreshness({
      url: "https://x.app/prayers/our-father",
      expectedTitle: "Our Father",
      fetchImpl,
    });
    expect(res.reachable).toBe(true);
    expect(res.fresh).toBe(true);
  });

  it("reports stale when the served HTML lacks the latest title/checksum", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () => "<html><h1>Old cached page</h1></html>",
    })) as unknown as typeof fetch;
    const res = await fetchPublicRouteFreshness({
      url: "https://x.app/prayers/our-father",
      expectedTitle: "Our Father",
      checksum: "deadbeef",
      fetchImpl,
    });
    expect(res.reachable).toBe(true);
    expect(res.fresh).toBe(false);
  });

  it("reports unreachable when the fetch throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const res = await fetchPublicRouteFreshness({
      url: "https://x.app/prayers/our-father",
      expectedTitle: "Our Father",
      fetchImpl,
    });
    expect(res.reachable).toBe(false);
  });
});
