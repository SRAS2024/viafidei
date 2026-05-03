import { describe, expect, it } from "vitest";
import { makeMockAdapter, makeMockFetch } from "../fixtures/mock-source";
import type { IngestedItem } from "@/lib/ingestion/types";

const item: IngestedItem = {
  kind: "prayer",
  slug: "test-prayer",
  defaultTitle: "Test Prayer",
  category: "test",
  body: "A scripted prayer body returned by the mock adapter.",
};

describe("makeMockAdapter", () => {
  it("returns the canned items without touching the network", async () => {
    const adapter = makeMockAdapter({ items: [item] });
    const result = await adapter.fetch({ sourceHost: "test.example", jobName: "test-job" });
    expect(result.items).toEqual([item]);
    expect(adapter.fetch).toHaveBeenCalledTimes(1);
  });

  it("infers entityKinds from the items when not provided", () => {
    const adapter = makeMockAdapter({ items: [item] });
    expect(adapter.entityKinds).toEqual(["prayer"]);
  });

  it("returns notModified when configured", async () => {
    const adapter = makeMockAdapter({ notModified: true });
    const result = await adapter.fetch({ sourceHost: "x", jobName: "x" });
    expect(result.notModified).toBe(true);
    expect(result.items).toEqual([]);
  });

  it("propagates the configured error", async () => {
    const adapter = makeMockAdapter({ throwError: new Error("upstream 503") });
    await expect(adapter.fetch({ sourceHost: "x", jobName: "x" })).rejects.toThrow("upstream 503");
  });
});

describe("makeMockFetch", () => {
  it("returns scripted bodies for known URLs and 404s for unknown URLs", async () => {
    const fetchFn = makeMockFetch({
      "https://api.example.test/prayers": { body: '{"prayers":[]}' },
      "https://api.example.test/saints": { status: 503, body: "service unavailable" },
    });

    const ok = await fetchFn("https://api.example.test/prayers");
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('{"prayers":[]}');

    const fail = await fetchFn("https://api.example.test/saints");
    expect(fail.status).toBe(503);

    const missing = await fetchFn("https://api.example.test/unknown");
    expect(missing.status).toBe(404);
  });
});
