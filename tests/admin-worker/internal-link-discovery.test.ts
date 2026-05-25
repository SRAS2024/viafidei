/**
 * Internal-link discovery — proves the worker can extract <a href>
 * URLs from an already-fetched approved page and insert the
 * survivors as CandidateSourceUrl rows.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/worker", () => ({
  isApprovedAuthorityHost: (host: string) => host.includes("vatican.va"),
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

import {
  discoverFromInternalLinks,
  extractInternalLinks,
} from "@/lib/admin-worker/internal-link-discovery";
import { discoverCandidate } from "@/lib/admin-worker/web-navigator";

function makePrisma() {
  return {
    adminWorkerLog: { create: vi.fn(async () => ({ id: "log" })) },
  } as unknown as Parameters<typeof discoverFromInternalLinks>[0];
}

describe("extractInternalLinks", () => {
  const base = "https://www.vatican.va/index.html";
  it("extracts absolute and relative hrefs", () => {
    const html = `<a href="https://www.vatican.va/prayers/our-father">x</a>
<a href="/saints/teresa">y</a>
<a href="https://other.example/x">z</a>`;
    const out = extractInternalLinks(html, base);
    expect(out).toContain("https://www.vatican.va/prayers/our-father");
    expect(out).toContain("https://www.vatican.va/saints/teresa");
    expect(out).toContain("https://other.example/x");
  });

  it("skips javascript:, mailto:, tel:, fragment-only hrefs", () => {
    const html = `<a href="javascript:void(0)">a</a>
<a href="mailto:x@example.org">b</a>
<a href="tel:+1234">c</a>
<a href="#section-2">d</a>`;
    expect(extractInternalLinks(html, base)).toEqual([]);
  });

  it("strips URL fragments to avoid duplicate entries", () => {
    const html = `<a href="/prayers/our-father">a</a>
<a href="/prayers/our-father#latin">b</a>`;
    const out = extractInternalLinks(html, base);
    expect(out.filter((u) => u.endsWith("/prayers/our-father")).length).toBe(1);
  });
});

describe("discoverFromInternalLinks", () => {
  it("rejects an unapproved seed host", async () => {
    const out = await discoverFromInternalLinks(makePrisma(), "https://evil.example/x");
    expect(out.fetched).toBe(false);
    expect(out.reason).toBe("seed host not approved");
  });

  it("fetches the seed page, extracts links, filters junk + cross-host", async () => {
    vi.mocked(discoverCandidate).mockClear();
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "0" },
      text: async () => `<html><body>
<a href="https://www.vatican.va/saints/x">saint</a>
<a href="https://www.vatican.va/events/2025">event</a>
<a href="https://other.example/prayer">cross-host</a>
</body></html>`,
    })) as unknown as typeof fetch;

    const out = await discoverFromInternalLinks(makePrisma(), "https://www.vatican.va/seed");
    expect(out.fetched).toBe(true);
    expect(out.inserted).toBe(1); // only saints/x
    expect(out.rejected).toBeGreaterThanOrEqual(2); // events + cross-host
    globalThis.fetch = realFetch;
  });
});
