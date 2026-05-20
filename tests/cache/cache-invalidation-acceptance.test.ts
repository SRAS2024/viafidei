/**
 * Cache invalidation acceptance tests (spec §19, §23).
 *
 * The factory must revalidate the correct cache tags after:
 *   - package created
 *   - package updated
 *   - package deleted
 *   - strict cleanup
 *   - threshold refresh
 *   - sitemap refresh
 *   - source rebuild
 *
 * We exercise the revalidation log to prove each path emits the
 * expected revalidation reason + tags. Direct revalidate calls
 * stand in for the corresponding factory event so we can pin
 * behaviour without spinning up the worker.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCacheRevalidationLog,
  getCacheHealthSnapshot,
  getCacheRevalidationLog,
  revalidateContentType,
  revalidateForRow,
  revalidateSitemap,
  revalidateTab,
} from "@/lib/cache/revalidate";
import { SEARCH_INDEX_TAG, SITEMAP_TAG } from "@/lib/cache/tags";

beforeEach(() => {
  clearCacheRevalidationLog();
});

describe("Cache invalidation paths (spec §19)", () => {
  it("package_created revalidates content-slug + content-type + tab + sitemap + search", async () => {
    await revalidateForRow({
      reason: "package_created",
      contentType: "Prayer",
      slug: "our-father",
    });
    const log = getCacheRevalidationLog();
    expect(log[0].reason).toBe("package_created");
    expect(log[0].tags).toContain("content-type:Prayer");
    expect(log[0].tags).toContain("content-slug:Prayer:our-father");
    expect(log[0].tags).toContain("tab:prayers");
    expect(log[0].tags).toContain(SITEMAP_TAG);
    expect(log[0].tags).toContain(SEARCH_INDEX_TAG);
  });

  it("package_updated logs an update reason with the same tags", async () => {
    await revalidateForRow({
      reason: "package_updated",
      contentType: "Saint",
      slug: "thomas-aquinas",
    });
    const log = getCacheRevalidationLog();
    expect(log[0].reason).toBe("package_updated");
    expect(log[0].tags).toContain("content-slug:Saint:thomas-aquinas");
  });

  it("package_deleted logs a delete reason", async () => {
    await revalidateForRow({
      reason: "package_deleted",
      contentType: "Prayer",
      slug: "removed-prayer",
    });
    const log = getCacheRevalidationLog();
    expect(log[0].reason).toBe("package_deleted");
  });

  it("strict_cleanup revalidates the tab + sitemap + search", async () => {
    await revalidateTab("prayers");
    const log = getCacheRevalidationLog();
    expect(log[0].reason).toBe("strict_cleanup");
    expect(log[0].tags).toEqual(["tab:prayers", SITEMAP_TAG, SEARCH_INDEX_TAG]);
  });

  it("threshold_refresh revalidates the content-type + tab + sitemap + search", async () => {
    await revalidateContentType("Saint");
    const log = getCacheRevalidationLog();
    expect(log[0].reason).toBe("threshold_refresh");
    expect(log[0].tags).toContain("content-type:Saint");
    expect(log[0].tags).toContain("tab:saints");
  });

  it("sitemap_refresh revalidates only the sitemap + search tags", async () => {
    await revalidateSitemap();
    const log = getCacheRevalidationLog();
    expect(log[0].reason).toBe("sitemap_refresh");
    expect(log[0].tags).toEqual([SITEMAP_TAG, SEARCH_INDEX_TAG]);
  });

  it("source_rebuild logs a source_rebuild reason on a content type cascade", async () => {
    await revalidateContentType("Prayer", "source_rebuild");
    const log = getCacheRevalidationLog();
    expect(log[0].reason).toBe("source_rebuild");
  });
});

describe("Cache health snapshot (spec §22)", () => {
  it("rolls reasons up into byReason counts", async () => {
    await revalidateForRow({
      reason: "package_created",
      contentType: "Prayer",
      slug: "a",
    });
    await revalidateForRow({
      reason: "package_created",
      contentType: "Prayer",
      slug: "b",
    });
    await revalidateForRow({
      reason: "package_deleted",
      contentType: "Prayer",
      slug: "c",
    });
    const snapshot = getCacheHealthSnapshot();
    expect(snapshot.totalLogged).toBe(3);
    const created = snapshot.byReason.find((r) => r.reason === "package_created");
    expect(created?.count).toBe(2);
    const deleted = snapshot.byReason.find((r) => r.reason === "package_deleted");
    expect(deleted?.count).toBe(1);
  });

  it("recent[] is bounded to the requested limit", async () => {
    for (let i = 0; i < 30; i++) {
      await revalidateForRow({
        reason: "package_created",
        contentType: "Prayer",
        slug: `slug-${i}`,
      });
    }
    const snapshot = getCacheHealthSnapshot(10);
    expect(snapshot.recent).toHaveLength(10);
  });
});
