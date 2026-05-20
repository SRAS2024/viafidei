/**
 * Runtime proof: the worker-side dispatch can NEVER reach
 * `runAdapter()` for any active job kind, because the only module
 * that exports `runAdapter` is the legacy `runner.ts` and the
 * dispatch surface no longer imports it.
 *
 * This test complements the static `new-system-enforcement.test.ts`
 * by inspecting the actual exported module graph at runtime — if a
 * regression accidentally re-exports `runAdapter` from the dispatch
 * surface, this test fails immediately.
 */

import { describe, expect, it } from "vitest";

describe("worker dispatch surface does not expose runAdapter at runtime", () => {
  it("dispatch module does not export runAdapter", async () => {
    const mod = await import("@/lib/ingestion/queue/dispatch");
    expect((mod as Record<string, unknown>).runAdapter).toBeUndefined();
  });

  it("worker module does not export runAdapter", async () => {
    const mod = await import("@/lib/ingestion/queue/worker");
    expect((mod as Record<string, unknown>).runAdapter).toBeUndefined();
  });

  it("build-enqueue module does not export runAdapter", async () => {
    const mod = await import("@/lib/ingestion/queue/build-enqueue");
    expect((mod as Record<string, unknown>).runAdapter).toBeUndefined();
  });

  it("factory-native-discovery does not export runAdapter", async () => {
    const mod = await import("@/lib/ingestion/queue/factory-native-discovery");
    expect((mod as Record<string, unknown>).runAdapter).toBeUndefined();
  });

  it("runJobByKind handles every active job kind without calling runAdapter", async () => {
    const { JOB_KINDS } = await import("@/lib/ingestion/queue/job-kinds");
    // The dispatch source must include a case branch for every active
    // kind so the worker is exhaustive without ever falling back to
    // `runAdapter`. We check by reading the dispatch source and
    // confirming every kind has a `case "<kind>":` clause.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/lib/ingestion/queue/dispatch.ts"), "utf8");
    for (const kind of JOB_KINDS) {
      const pattern = new RegExp(`case\\s+["']${kind}["']`);
      expect(
        pattern.test(src),
        `dispatch.ts must include a case clause for active job kind "${kind}"`,
      ).toBe(true);
    }
    // And the source must not import or call runAdapter anywhere
    // (skip docstring/comment lines).
    const nonCommentLines = src
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
      })
      .join("\n");
    expect(/import[^"']*runAdapter/.test(nonCommentLines)).toBe(false);
    expect(/\brunAdapter\s*\(/.test(nonCommentLines)).toBe(false);
  });
});
