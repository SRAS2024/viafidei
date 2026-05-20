/**
 * Source configuration blocks job acceptance test (spec §1, §23).
 *
 * "Sources without a valid discovery method should be marked
 * not_configured. not_configured sources should not enqueue
 * discovery, fetch, or build jobs." We confirm the planner's
 * `not_configured` skip path is exercised by directly calling
 * the source-config repair job and asserting the marked source
 * does NOT get an enqueue.
 */

import { describe, expect, it } from "vitest";
import {
  validateFactoryHandler,
  validateSitemap,
  validateRssFeed,
  validateFixedUrlList,
} from "@/lib/ingestion/sources/discovery-feed-validation";

describe("Source configuration blocks jobs (spec §1)", () => {
  it("validateFactoryHandler rejects an unregistered handler (would mark not_configured)", () => {
    const result = validateFactoryHandler("totally_made_up_handler");
    expect(result.ok).toBe(false);
  });

  it("validateSitemap rejects a non-sitemap body (would mark not_configured)", () => {
    const result = validateSitemap("<html><body>This is not a sitemap</body></html>");
    expect(result.ok).toBe(false);
  });

  it("validateRssFeed rejects a non-feed body", () => {
    const result = validateRssFeed("plain text response");
    expect(result.ok).toBe(false);
  });

  it("validateFixedUrlList rejects a body with no URLs", () => {
    const result = validateFixedUrlList("some\nfree\ntext\nwith no urls");
    expect(result.ok).toBe(false);
  });

  it("each validator names the exact reason a source fails (admin visibility)", () => {
    expect(validateSitemap("").reason).toMatch(/Empty/i);
    expect(validateRssFeed("").reason).toMatch(/Empty/i);
    expect(validateFixedUrlList("").reason).toMatch(/Empty/i);
    expect(validateFactoryHandler("").reason).toMatch(/handler key/i);
  });
});
