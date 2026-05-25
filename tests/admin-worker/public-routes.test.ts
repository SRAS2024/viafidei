/**
 * Public route + cache-tag mapping. Sanity-check that every
 * ChecklistContentType maps to a known tab path.
 */

import { ChecklistContentType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { publicRouteFor, publicUrlFor } from "@/lib/admin-worker/public-routes";

describe("publicRouteFor", () => {
  it("maps PRAYER to /prayers/<slug>", () => {
    const route = publicRouteFor("PRAYER", "our-father");
    expect(route.tabPath).toBe("/prayers");
    expect(route.slugPath).toBe("/prayers/our-father");
    expect(route.cacheTags).toContain("content-type:Prayer");
    expect(route.cacheTags).toContain("content-slug:Prayer:our-father");
    expect(route.cacheTags).toContain("tab:prayers");
    expect(route.cacheTags).toContain("sitemap");
    expect(route.cacheTags).toContain("search-index");
  });

  it("maps SAINT to /saints/<slug>", () => {
    expect(publicRouteFor("SAINT", "teresa").slugPath).toBe("/saints/teresa");
  });

  it("URL-encodes the slug", () => {
    const route = publicRouteFor("PRAYER", "our father");
    expect(route.slugPath).toBe("/prayers/our%20father");
  });

  it("produces a defined route for every ChecklistContentType", () => {
    for (const ct of Object.values(ChecklistContentType)) {
      const route = publicRouteFor(ct, "x");
      expect(route.tab).toBeDefined();
      expect(route.tabPath.length).toBeGreaterThan(1);
    }
  });
});

describe("publicUrlFor", () => {
  it("builds an absolute URL using the configured origin", () => {
    const url = publicUrlFor("PRAYER", "our-father");
    expect(url).toMatch(/\/prayers\/our-father$/);
    expect(url.startsWith("http")).toBe(true);
  });
});
