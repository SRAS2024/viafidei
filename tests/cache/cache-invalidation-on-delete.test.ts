/**
 * Cache invalidation on delete acceptance (spec §19, §23).
 *
 * Spec rule: "Add tests proving deleted invalid content disappears
 * from cached public pages." We exercise the package_deleted
 * revalidation path and confirm the right tags are emitted so the
 * cached list + slug pages both drop on the next request.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCacheRevalidationLog,
  getCacheRevalidationLog,
  revalidateForRow,
} from "@/lib/cache/revalidate";
import { contentSlugTag, tabTag, contentTypeTag } from "@/lib/cache/tags";

beforeEach(() => {
  clearCacheRevalidationLog();
});

describe("Cache invalidation on delete (spec §19, §23)", () => {
  it("revalidates content-slug + content-type + tab + sitemap + search on delete", async () => {
    await revalidateForRow({
      reason: "package_deleted",
      contentType: "Prayer",
      slug: "stale-prayer",
    });
    const log = getCacheRevalidationLog();
    expect(log.length).toBe(1);
    expect(log[0].reason).toBe("package_deleted");
    expect(log[0].tags).toContain(contentSlugTag("Prayer", "stale-prayer"));
    expect(log[0].tags).toContain(contentTypeTag("Prayer"));
    expect(log[0].tags).toContain(tabTag("prayers"));
    expect(log[0].tags).toContain("sitemap");
    expect(log[0].tags).toContain("search-index");
  });

  it("deleting many rows produces one log entry per row", async () => {
    await revalidateForRow({
      reason: "package_deleted",
      contentType: "Prayer",
      slug: "a",
    });
    await revalidateForRow({
      reason: "package_deleted",
      contentType: "Prayer",
      slug: "b",
    });
    await revalidateForRow({
      reason: "package_deleted",
      contentType: "Saint",
      slug: "c",
    });
    expect(getCacheRevalidationLog().length).toBe(3);
  });

  it("deleted content's per-slug tag does not overlap a different slug's tag", async () => {
    await revalidateForRow({
      reason: "package_deleted",
      contentType: "Prayer",
      slug: "deleted",
    });
    const log = getCacheRevalidationLog();
    expect(log[0].tags).toContain(contentSlugTag("Prayer", "deleted"));
    expect(log[0].tags).not.toContain(contentSlugTag("Prayer", "kept"));
  });
});
