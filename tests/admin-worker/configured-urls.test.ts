/**
 * Configured fixed URL list discovery (spec §5 — discovery method
 * CONFIGURED_URL).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/checklist", () => ({
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
  BUILTIN_CONFIGURED_URLS,
  addConfiguredUrl,
  discoverFromConfiguredUrls,
  listConfiguredUrls,
} from "@/lib/admin-worker/configured-urls";
import { discoverCandidate } from "@/lib/admin-worker/web-navigator";

function makePrisma() {
  return {
    adminWorkerLog: { create: vi.fn(async () => ({ id: "log" })) },
  } as unknown as Parameters<typeof discoverFromConfiguredUrls>[0];
}

describe("Configured URL discovery", () => {
  it("ships a non-empty built-in catalogue", () => {
    expect(BUILTIN_CONFIGURED_URLS.length).toBeGreaterThan(0);
  });

  it("addConfiguredUrl appends to the runtime catalogue", () => {
    const before = listConfiguredUrls().length;
    addConfiguredUrl({ url: "https://www.vatican.va/extra", predictedContentType: "PRAYER" });
    expect(listConfiguredUrls().length).toBe(before + 1);
  });

  it("inserts only approved-host URLs and skips junk patterns", async () => {
    vi.mocked(discoverCandidate).mockClear();
    addConfiguredUrl({
      url: "https://www.vatican.va/livestream/x",
      predictedContentType: "PRAYER",
    });
    addConfiguredUrl({ url: "https://other.example/prayer", predictedContentType: "PRAYER" });
    const out = await discoverFromConfiguredUrls(makePrisma());
    expect(out.inserted).toBeGreaterThan(0);
    // The livestream + cross-host URLs were rejected.
    const inserted = vi.mocked(discoverCandidate).mock.calls.map((c) => c[1].url);
    for (const url of inserted) {
      expect(url).toContain("vatican.va");
      expect(url).not.toContain("/livestream/");
    }
  });
});
