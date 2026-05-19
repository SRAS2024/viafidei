/**
 * Cached public-content data wrapper tests (spec §19).
 *
 * The wrapper must:
 *   - degrade gracefully to a direct invocation when `next/cache`
 *     is unavailable (so the unit test suite still passes)
 *   - emit cache tags that match the revalidation layer's tag
 *     namespace (content-type:<Type>, tab:<key>, sitemap)
 */

import { describe, expect, it } from "vitest";
import { tagsForList, withCacheTags } from "@/lib/cache/cached-data";
import { SITEMAP_TAG, contentTypeTag, tabTag } from "@/lib/cache/tags";

describe("tagsForList()", () => {
  it("returns content-type, tab and sitemap tags by default", () => {
    const cfg = tagsForList({ contentType: "Prayer", tab: "prayers" });
    expect(cfg.tags).toContain(contentTypeTag("Prayer"));
    expect(cfg.tags).toContain(tabTag("prayers"));
    expect(cfg.tags).toContain(SITEMAP_TAG);
    expect(cfg.revalidateSeconds).toBeGreaterThan(0);
  });

  it("produces stable tag strings across calls", () => {
    const a = tagsForList({ contentType: "Saint", tab: "saints" });
    const b = tagsForList({ contentType: "Saint", tab: "saints" });
    expect(a.tags).toEqual(b.tags);
  });
});

describe("withCacheTags()", () => {
  it("falls through to the wrapped function when next/cache is unavailable", async () => {
    let callCount = 0;
    const fn = async (a: number, b: number) => {
      callCount += 1;
      return a + b;
    };
    const cached = await withCacheTags<[number, number], number>({
      keyParts: ["x"],
      tags: ["content-type:Prayer"],
      fn,
    });
    expect(await cached(1, 2)).toBe(3);
    expect(await cached(3, 4)).toBe(7);
    expect(callCount).toBe(2);
  });

  it("returns whatever the wrapped function returns (including null / undefined)", async () => {
    const cached = await withCacheTags<[], null>({
      keyParts: ["nullish"],
      tags: ["tab:prayers"],
      fn: async () => null,
    });
    expect(await cached()).toBeNull();
  });
});
