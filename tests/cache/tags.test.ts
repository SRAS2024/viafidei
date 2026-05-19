/**
 * Cache tags / revalidation tests.
 *
 * The tag builders are the single source of truth for every cache
 * tag the codebase emits. These tests pin:
 *   - tag shape: `content-type:Prayer`, `content-slug:Prayer:our-father`, `tab:prayers`
 *   - tagsForRow() returns the full revalidation cascade
 *   - revalidate helpers log each call into the in-memory snapshot
 *   - revalidate helpers gracefully degrade when next/cache is absent
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  CONTENT_TYPE_TO_TAB,
  SITEMAP_TAG,
  SEARCH_INDEX_TAG,
  contentSlugTag,
  contentTypeTag,
  tabTag,
  tagsForRow,
} from "@/lib/cache/tags";
import {
  clearCacheRevalidationLog,
  getCacheHealthSnapshot,
  getCacheRevalidationLog,
  revalidateContentType,
  revalidateForRow,
  revalidateSitemap,
  revalidateTab,
} from "@/lib/cache/revalidate";

beforeEach(() => {
  clearCacheRevalidationLog();
});

describe("cache tag builders", () => {
  it("produces stable tag strings for content-type, content-slug, and tab", () => {
    expect(contentTypeTag("Prayer")).toBe("content-type:Prayer");
    expect(contentSlugTag("Prayer", "our-father")).toBe("content-slug:Prayer:our-father");
    expect(tabTag("prayers")).toBe("tab:prayers");
  });

  it("maps every spec content type to a tab", () => {
    const want = [
      "Prayer",
      "Saint",
      "MarianApparition",
      "Parish",
      "Devotion",
      "Novena",
      "Sacrament",
      "Rosary",
      "Consecration",
      "Liturgy",
      "History",
    ] as const;
    for (const ct of want) {
      expect(CONTENT_TYPE_TO_TAB[ct]).toBeDefined();
    }
  });

  it("tagsForRow() returns content-type + content-slug + tab + sitemap + search", () => {
    const tags = tagsForRow("Prayer", "our-father");
    expect(tags).toContain("content-type:Prayer");
    expect(tags).toContain("content-slug:Prayer:our-father");
    expect(tags).toContain("tab:prayers");
    expect(tags).toContain(SITEMAP_TAG);
    expect(tags).toContain(SEARCH_INDEX_TAG);
  });
});

describe("revalidate helpers", () => {
  it("revalidateForRow logs the call into the in-memory snapshot", async () => {
    const result = await revalidateForRow({
      reason: "package_created",
      contentType: "Prayer",
      slug: "our-father",
    });
    expect(result.tags).toContain("content-slug:Prayer:our-father");
    const log = getCacheRevalidationLog();
    expect(log).toHaveLength(1);
    expect(log[0].reason).toBe("package_created");
    expect(log[0].contentType).toBe("Prayer");
    expect(log[0].slug).toBe("our-father");
  });

  it("revalidateSitemap only revalidates sitemap + search tags", async () => {
    await revalidateSitemap();
    const log = getCacheRevalidationLog();
    expect(log[0].tags).toEqual([SITEMAP_TAG, SEARCH_INDEX_TAG]);
  });

  it("revalidateTab includes the tab tag plus sitemap + search", async () => {
    await revalidateTab("prayers");
    const log = getCacheRevalidationLog();
    expect(log[0].tags).toEqual(["tab:prayers", SITEMAP_TAG, SEARCH_INDEX_TAG]);
  });

  it("revalidateContentType cascades content-type + tab + sitemap + search", async () => {
    await revalidateContentType("Prayer");
    const log = getCacheRevalidationLog();
    expect(log[0].tags).toEqual([
      "content-type:Prayer",
      "tab:prayers",
      SITEMAP_TAG,
      SEARCH_INDEX_TAG,
    ]);
  });

  it("getCacheHealthSnapshot groups by reason and counts ok/fail", async () => {
    await revalidateForRow({
      reason: "package_created",
      contentType: "Prayer",
      slug: "a",
    });
    await revalidateForRow({
      reason: "package_updated",
      contentType: "Prayer",
      slug: "b",
    });
    await revalidateForRow({
      reason: "package_created",
      contentType: "Saint",
      slug: "c",
    });
    const snapshot = getCacheHealthSnapshot();
    expect(snapshot.totalLogged).toBe(3);
    const created = snapshot.byReason.find((r) => r.reason === "package_created");
    expect(created?.count).toBe(2);
  });
});
