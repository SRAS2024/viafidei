/**
 * Sitemap discovery — proves the web navigator fetches approved hosts'
 * sitemaps, extracts <loc> URLs, classifies them, and inserts the
 * survivors as CandidateSourceUrl rows (spec section 5).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/worker", () => ({
  isApprovedAuthorityHost: (host: string) => host === "www.vatican.va" || host === "vatican.va",
  AUTHORITY_SOURCES: [{ host: "vatican.va" }],
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

import { discoverFromHost } from "@/lib/admin-worker/sitemap-discovery";
import { discoverCandidate } from "@/lib/admin-worker/web-navigator";

function makePrisma() {
  return {
    adminWorkerLog: { create: vi.fn(async () => ({ id: "log" })) },
  } as unknown as Parameters<typeof discoverFromHost>[0];
}

describe("discoverFromHost", () => {
  it("rejects an unapproved host before fetching", async () => {
    const out = await discoverFromHost(makePrisma(), "evil.example");
    expect(out.fetched).toBe(0);
    expect(out.reason).toBe("host not approved");
  });

  it("parses <loc> entries from the sitemap and skips junk + cross-host URLs", async () => {
    vi.mocked(discoverCandidate).mockClear();
    const realFetch = globalThis.fetch;
    let call = 0;
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      call += 1;
      const u = String(url);
      if (u.endsWith("/robots.txt")) {
        return {
          ok: true,
          status: 200,
          text: async () => "User-agent: *\nSitemap: https://www.vatican.va/sitemap.xml",
          headers: { get: () => "0" },
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => `<?xml version="1.0"?>
<urlset>
  <url><loc>https://www.vatican.va/content/prayers/our-father.html</loc></url>
  <url><loc>https://www.vatican.va/events/2025-05-01</loc></url>
  <url><loc>https://other.example/prayer/x</loc></url>
  <url><loc>https://www.vatican.va/saints/teresa.html</loc></url>
</urlset>`,
        headers: { get: () => "0" },
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const out = await discoverFromHost(makePrisma(), "vatican.va");
    expect(out.fetched).toBeGreaterThan(0);
    expect(out.inserted).toBe(2); // prayer + saint
    expect(out.rejected).toBeGreaterThanOrEqual(2); // events + cross-host

    // Verify the navigator was called with the right metadata.
    const insertedUrls = vi.mocked(discoverCandidate).mock.calls.map((c) => c[1].url);
    expect(insertedUrls).toContain("https://www.vatican.va/content/prayers/our-father.html");
    expect(insertedUrls).toContain("https://www.vatican.va/saints/teresa.html");
    expect(call).toBeGreaterThan(0);

    globalThis.fetch = realFetch;
  });
});
