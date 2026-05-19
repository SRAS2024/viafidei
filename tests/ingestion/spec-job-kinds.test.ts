/**
 * Active job kinds match the spec exactly.
 *
 * Stage model: a single combined `content_build` job runs the entire
 * factory pipeline (build → normalize → enrich → strict QA → persist)
 * in one worker tick. The previous split stages `content_validate`
 * and `content_persist` only called the same factory entry point, so
 * they have been removed from the active set and live in
 * REMOVED_JOB_KINDS.
 *
 * The spec lists the only job kinds allowed for active content work:
 *
 *   source_discovery
 *   source_fetch
 *   source_freshness
 *   source_config_repair
 *   content_build
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
  "source_config_repair",
  "content_build",
  "content_revalidate",
  "strict_cleanup",
  "dedupe_cleanup",
  "archive_cleanup",
  "sitemap_refresh",
  "report_generate",
] as const;

const SPEC_REMOVED_KINDS = ["source_ingest", "content_validate", "content_persist"] as const;

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

  it(`has exactly ${SPEC_KINDS.length} active job kinds (matches the spec count)`, () => {
    expect(JOB_KINDS).toHaveLength(SPEC_KINDS.length);
  });

  it("REMOVED_JOB_KINDS contains every spec-removed kind", () => {
    for (const removed of SPEC_REMOVED_KINDS) {
      expect(REMOVED_JOB_KINDS as readonly string[]).toContain(removed);
    }
  });

  it("content_validate and content_persist are removed (collapsed into content_build)", () => {
    expect(JOB_KINDS as readonly string[]).not.toContain("content_validate");
    expect(JOB_KINDS as readonly string[]).not.toContain("content_persist");
    expect(REMOVED_JOB_KINDS as readonly string[]).toContain("content_validate");
    expect(REMOVED_JOB_KINDS as readonly string[]).toContain("content_persist");
  });

  it("JOB_KINDS and REMOVED_JOB_KINDS are disjoint", () => {
    for (const removed of REMOVED_JOB_KINDS as readonly string[]) {
      expect(JOB_KINDS as readonly string[]).not.toContain(removed);
    }
  });
});
