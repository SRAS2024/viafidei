/**
 * RSS feed discovery — proves the worker can extract candidate URLs
 * from RSS 2.0 and Atom feeds (spec §5).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/checklist", () => ({
  isApprovedAuthorityHost: (host: string) => host.includes("vatican.va"),
  isFetchableHost: (host: string) => host.includes("vatican.va"),
}));

vi.mock("@/lib/admin-worker/web-navigator", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin-worker/web-navigator")>(
    "@/lib/admin-worker/web-navigator",
  );
  return {
    ...actual,
    discoverCandidate: vi.fn(async (_: unknown, input: { url: string }) => ({
      id: `c-${input.url}`,
      status: "DISCOVERED" as const,
    })),
  };
});

import { discoverFromFeed, extractFeedUrls } from "@/lib/admin-worker/rss-discovery";

function makePrisma() {
  return {
    adminWorkerLog: { create: vi.fn(async () => ({ id: "log" })) },
  } as unknown as Parameters<typeof discoverFromFeed>[0];
}

describe("extractFeedUrls", () => {
  it("parses RSS 2.0 <link> tags", () => {
    const xml = `<?xml version="1.0"?>
<rss>
  <channel>
    <item><link>https://www.vatican.va/x/1</link></item>
    <item><link>https://www.vatican.va/x/2</link></item>
  </channel>
</rss>`;
    expect(extractFeedUrls(xml)).toEqual([
      "https://www.vatican.va/x/1",
      "https://www.vatican.va/x/2",
    ]);
  });

  it('parses Atom <link href="" /> tags', () => {
    const xml = `<feed>
  <entry><link href="https://www.vatican.va/a/1" /></entry>
  <entry><link href="https://www.vatican.va/a/2" rel="alternate" /></entry>
</feed>`;
    const out = extractFeedUrls(xml);
    expect(out).toContain("https://www.vatican.va/a/1");
    expect(out).toContain("https://www.vatican.va/a/2");
  });
});

describe("discoverFromFeed", () => {
  it("rejects feeds on unapproved hosts", async () => {
    const out = await discoverFromFeed(makePrisma(), "https://evil.example/feed.xml");
    expect(out.fetched).toBe(false);
    expect(out.reason).toBe("host not approved");
  });

  it("inserts approved-host items, rejects cross-host items + junk URLs", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "0" },
      text: async () => `<?xml version="1.0"?>
<rss>
  <channel>
    <item><link>https://www.vatican.va/prayers/a</link></item>
    <item><link>https://www.vatican.va/events/2025</link></item>
    <item><link>https://other.example/x</link></item>
  </channel>
</rss>`,
    })) as unknown as typeof fetch;
    const out = await discoverFromFeed(makePrisma(), "https://www.vatican.va/feed.xml");
    expect(out.fetched).toBe(true);
    expect(out.inserted).toBe(1); // prayers/a
    expect(out.rejected).toBeGreaterThanOrEqual(2); // events + cross-host
    globalThis.fetch = realFetch;
  });
});
