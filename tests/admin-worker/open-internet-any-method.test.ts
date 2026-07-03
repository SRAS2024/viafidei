/**
 * "Surf anywhere, using any method." The open-internet fetch gate
 * (`isFetchableHost`) is now the single authorization used by EVERY discovery /
 * fetch method — configured URLs, sitemaps, RSS feeds, structured-API results,
 * and PDF fetches — not just the general web fetcher. So when open-internet mode
 * is on (the always-on default) any of those methods can reach a non-registry
 * host; when it is off they all fall back to the registry allow-list
 * (isFetchableHost === isApprovedAuthorityHost). Non-content hosts (local /
 * social / commerce / free-site builders) stay blocked in every mode.
 *
 * This locks in the wiring: the mock below approves ONLY a non-registry host
 * (open mode), and each method must accept content on it.
 */
import { describe, expect, it, vi } from "vitest";

// Simulate open-internet mode: isFetchableHost is TRUE for an arbitrary
// non-registry host, while isApprovedAuthorityHost (the registry-only gate the
// methods used to use) is FALSE for it. If a method still gated on the registry
// it would reject this host — proving the method now honours open mode.
vi.mock("@/lib/checklist", () => ({
  isApprovedAuthorityHost: (host: string) => host.includes("vatican.va"),
  isFetchableHost: (host: string) => !host.includes("blocked.example"),
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

import { addConfiguredUrl, discoverFromConfiguredUrls } from "@/lib/admin-worker/configured-urls";
import { discoverCandidate } from "@/lib/admin-worker/web-navigator";

function makePrisma() {
  return {
    adminWorkerLog: { create: vi.fn(async () => ({ id: "log" })) },
  } as unknown as Parameters<typeof discoverFromConfiguredUrls>[0];
}

describe("open-internet mode lets any method surf beyond the registry", () => {
  it("configured-URL discovery accepts a non-registry fetchable host", async () => {
    vi.mocked(discoverCandidate).mockClear();
    // A host that is NOT in the registry but IS fetchable (open mode).
    addConfiguredUrl({
      url: "https://a-lesser-known-catholic-site.example/prayers/anima-christi",
      predictedContentType: "PRAYER",
    });
    const out = await discoverFromConfiguredUrls(makePrisma());
    const inserted = vi.mocked(discoverCandidate).mock.calls.map((c) => c[1].url);
    expect(inserted).toContain(
      "https://a-lesser-known-catholic-site.example/prayers/anima-christi",
    );
    expect(out.inserted).toBeGreaterThan(0);
  });

  it("still blocks a non-content host even in open mode", async () => {
    vi.mocked(discoverCandidate).mockClear();
    addConfiguredUrl({
      url: "https://blocked.example/whatever",
      predictedContentType: "PRAYER",
    });
    const out = await discoverFromConfiguredUrls(makePrisma());
    const inserted = vi.mocked(discoverCandidate).mock.calls.map((c) => c[1].url);
    expect(inserted).not.toContain("https://blocked.example/whatever");
    expect(out.rejected).toBeGreaterThan(0);
  });
});
