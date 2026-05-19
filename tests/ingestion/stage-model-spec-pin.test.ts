/**
 * Stage model spec-pin (#26.2): the factory uses ONE combined
 * `content_build` job that runs build + normalize + enrich + strict
 * QA + persist in a single worker tick. The previous split stages
 * (`content_validate`, `content_persist`) are removed.
 *
 * Cross-cutting check:
 *   1. JOB_KINDS has `content_build` but neither split stage.
 *   2. dispatch.ts has a single case for `content_build` and no
 *      cases for the removed kinds.
 *   3. The factory entry point that `content_build` calls
 *      (`runContentFactory`) is the same function that powers the
 *      whole pipeline — there is no separate validate/persist
 *      worker function.
 *   4. The build-enqueue helper only enqueues `content_build`.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  JOB_KINDS,
  REMOVED_JOB_KINDS,
  validatePayload,
} from "@/lib/ingestion/queue/job-kinds";

const SRC = process.cwd();

describe("single combined content_build stage", () => {
  it("JOB_KINDS contains content_build", () => {
    expect(JOB_KINDS as readonly string[]).toContain("content_build");
  });

  it("JOB_KINDS contains neither content_validate nor content_persist", () => {
    expect(JOB_KINDS as readonly string[]).not.toContain("content_validate");
    expect(JOB_KINDS as readonly string[]).not.toContain("content_persist");
  });

  it("REMOVED_JOB_KINDS contains both split stages", () => {
    expect(REMOVED_JOB_KINDS as readonly string[]).toContain("content_validate");
    expect(REMOVED_JOB_KINDS as readonly string[]).toContain("content_persist");
  });

  it("validatePayload rejects content_validate / content_persist", () => {
    const v = validatePayload("content_validate", {});
    expect(v.ok).toBe(false);
    const p = validatePayload("content_persist", {});
    expect(p.ok).toBe(false);
  });

  it("dispatch.ts has a content_build case and no separate validate/persist cases", () => {
    const src = readFileSync(join(SRC, "src/lib/ingestion/queue/dispatch.ts"), "utf8");
    // The active code-path uses a single combined stage.
    expect(src).toMatch(/case\s+["']content_build["']/);
    // No active case branches for the removed kinds (matches at the
    // top of a switch arm only — comments may still mention them).
    const lines = src.split("\n");
    const codeLines = lines.filter((l) => {
      const t = l.trim();
      return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
    });
    const code = codeLines.join("\n");
    expect(code).not.toMatch(/case\s+["']content_validate["']/);
    expect(code).not.toMatch(/case\s+["']content_persist["']/);
  });

  it("build-enqueue only enqueues content_build", () => {
    const src = readFileSync(join(SRC, "src/lib/ingestion/queue/build-enqueue.ts"), "utf8");
    // The helper must enqueue `content_build` and never the split stages.
    expect(src).toMatch(/jobKind:\s*["']content_build["']/);
    expect(src).not.toMatch(/jobKind:\s*["']content_validate["']/);
    expect(src).not.toMatch(/jobKind:\s*["']content_persist["']/);
  });

  it("runContentFactory is reachable from the content_build dispatch case", async () => {
    const src = readFileSync(join(SRC, "src/lib/ingestion/queue/dispatch.ts"), "utf8");
    expect(src).toMatch(/runContentFactory/);
    // And the factory's run module exists.
    const factory = await import("@/lib/content-factory");
    expect(typeof factory.runContentFactory).toBe("function");
  });
});
