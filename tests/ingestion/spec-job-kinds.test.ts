/**
 * Active job kinds match the spec exactly.
 *
 * The spec lists the only job kinds allowed for active content work:
 *
 *   source_discovery
 *   source_fetch
 *   source_freshness
 *   content_build
 *   content_validate
 *   content_persist
 *   content_revalidate
 *   strict_cleanup
 *   dedupe_cleanup
 *   archive_cleanup
 *   sitemap_refresh
 *   report_generate
 *
 * This test pins JOB_KINDS to that list and fails if anything is
 * added or removed without an accompanying spec update.
 */

import { describe, expect, it } from "vitest";
import { JOB_KINDS, REMOVED_JOB_KINDS } from "@/lib/ingestion/queue/job-kinds";

const SPEC_KINDS = [
  "source_discovery",
  "source_fetch",
  "source_freshness",
  "content_build",
  "content_validate",
  "content_persist",
  "content_revalidate",
  "strict_cleanup",
  "dedupe_cleanup",
  "archive_cleanup",
  "sitemap_refresh",
  "report_generate",
] as const;

describe("JOB_KINDS matches the spec", () => {
  it("contains every kind the spec requires", () => {
    for (const kind of SPEC_KINDS) {
      expect(JOB_KINDS as readonly string[]).toContain(kind);
    }
  });

  it("contains no extra kinds beyond the spec set", () => {
    for (const kind of JOB_KINDS as readonly string[]) {
      expect(SPEC_KINDS as readonly string[]).toContain(kind);
    }
  });

  it("has exactly 12 active job kinds (matches the spec count)", () => {
    expect(JOB_KINDS).toHaveLength(SPEC_KINDS.length);
  });

  it("REMOVED_JOB_KINDS contains source_ingest (legacy executor)", () => {
    expect(REMOVED_JOB_KINDS as readonly string[]).toContain("source_ingest");
  });

  it("JOB_KINDS and REMOVED_JOB_KINDS are disjoint", () => {
    for (const removed of REMOVED_JOB_KINDS as readonly string[]) {
      expect(JOB_KINDS as readonly string[]).not.toContain(removed);
    }
  });
});
