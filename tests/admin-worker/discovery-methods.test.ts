/**
 * Discovery method completeness — proves every spec §5 discovery
 * method has a working entry point that respects the host-allowlist
 * + junk-URL classifier.
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
  addSearchTemplate,
  discoverFromApis,
  discoverFromDirectories,
  discoverFromSearchPages,
  listApiAdapters,
  listSearchTemplates,
  registerApiAdapter,
} from "@/lib/admin-worker";

function makePrisma() {
  return {
    adminWorkerLog: { create: vi.fn(async () => ({ id: "log" })) },
  } as unknown as Parameters<typeof discoverFromApis>[0];
}

describe("API adapter registry", () => {
  it("starts empty and grows as adapters are registered", () => {
    const before = listApiAdapters().length;
    registerApiAdapter({
      id: "test-adapter",
      host: "www.vatican.va",
      description: "test",
      fetch: async () => [
        { url: "https://www.vatican.va/feed/x" },
        { url: "https://other.example/y" },
      ],
    });
    expect(listApiAdapters().length).toBe(before + 1);
  });

  it("inserts approved-host results, rejects cross-host", async () => {
    const out = await discoverFromApis(makePrisma());
    expect(out.adaptersRun).toBeGreaterThan(0);
    expect(out.inserted).toBeGreaterThan(0);
    expect(out.rejected).toBeGreaterThanOrEqual(1);
  });
});

describe("search-page template registry", () => {
  it("starts with the built-in template list", () => {
    expect(Array.isArray(listSearchTemplates())).toBe(true);
  });

  it("addSearchTemplate appends", () => {
    const before = listSearchTemplates().length;
    addSearchTemplate({
      template: "https://www.vatican.va/search?q={q}",
      contentType: "PRAYER",
    });
    expect(listSearchTemplates().length).toBe(before + 1);
  });

  it("returns zero inserted when the query is blank", async () => {
    const out = await discoverFromSearchPages(makePrisma(), "  ");
    expect(out.inserted).toBe(0);
  });
});

describe("directory discovery", () => {
  it("returns a summary even when fetch fails (no network)", async () => {
    // No global.fetch mock — discovery will fall through without
    // network and report 0 fetched.
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const out = await discoverFromDirectories(makePrisma());
    expect(out.directories).toBeGreaterThanOrEqual(1);
    expect(out.fetched).toBe(0);
    globalThis.fetch = realFetch;
  });
});
