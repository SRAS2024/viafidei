/**
 * Structural audit: old ingestion paths are gone.
 *
 * The spec requires:
 *   * source_ingest is removed as an active execution path.
 *   * Active code only enqueues the documented job kinds.
 *   * No new code paths run adapters directly outside the worker
 *     dispatch.
 *   * Manual "send-to-review" routing for failed content is removed
 *     (failed content gets deleted + logged, not sent to review).
 *
 * This audit scans the source tree and asserts those invariants
 * hold. A regression — e.g. a new route that enqueues source_ingest,
 * or a manual edit that flips status="REVIEW" on a failed package —
 * will fail this test before it ships.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = join(process.cwd(), "src");

function walkSrc(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...walkSrc(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const FILES = walkSrc(SRC_DIR);

describe("old ingestion paths are gone", () => {
  it("no code enqueues a job with jobKind: 'source_ingest'", () => {
    const offenders: Array<{ path: string; line: number; text: string }> = [];
    for (const path of FILES) {
      const src = readFileSync(path, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Match `jobKind: "source_ingest"` in any enqueue / data block.
        if (/jobKind\s*:\s*["']source_ingest["']/.test(line)) {
          offenders.push({
            path: path.replace(process.cwd(), ""),
            line: i + 1,
            text: line.trim(),
          });
        }
      }
    }
    if (offenders.length > 0) {
      const summary = offenders.map((o) => `${o.path}:${o.line}  ${o.text}`).join("\n");
      throw new Error(
        `source_ingest is enqueued from the following locations — replace with explicit factory stages:\n${summary}`,
      );
    }
  });

  it("source_ingest is in REMOVED_JOB_KINDS, not JOB_KINDS", () => {
    const src = readFileSync(join(SRC_DIR, "lib", "ingestion", "queue", "job-kinds.ts"), "utf8");
    // The string "source_ingest" must appear ONLY inside the
    // REMOVED_JOB_KINDS literal and in code comments — never as a
    // member of JOB_KINDS or PRIORITY_DEFAULTS.
    const jobKindsBlock = src.match(/export const JOB_KINDS = \[([\s\S]*?)\] as const/);
    expect(jobKindsBlock).not.toBeNull();
    if (jobKindsBlock) {
      expect(jobKindsBlock[1]).not.toMatch(/["']source_ingest["']/);
    }
    // REMOVED_JOB_KINDS now also contains the collapsed stages
    // content_validate and content_persist — match the literal that
    // contains "source_ingest" anywhere in the list.
    const removedBlock = src.match(/export const REMOVED_JOB_KINDS = \[([\s\S]*?)\] as const/);
    expect(removedBlock).not.toBeNull();
    if (removedBlock) {
      expect(removedBlock[1]).toMatch(/["']source_ingest["']/);
    }
  });

  it("validatePayload rejects source_ingest with the 'Removed job kind' error", async () => {
    const { validatePayload } = await import("@/lib/ingestion/queue/job-kinds");
    const result = validatePayload("source_ingest", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Removed job kind/);
    }
  });

  it("the planner enqueues source_discovery (not source_ingest) in constant mode", () => {
    const src = readFileSync(join(SRC_DIR, "lib", "ingestion", "queue", "planner.ts"), "utf8");
    // The planner must contain a literal "source_discovery" enqueue.
    expect(src).toMatch(/jobKind\s*:\s*[^,]*["']source_discovery["']/);
    // It must NOT enqueue source_ingest.
    expect(src).not.toMatch(/jobKind\s*:\s*[^,]*["']source_ingest["']/);
  });

  it("no admin route enqueues source_ingest", () => {
    const adminApiDir = join(SRC_DIR, "app", "api", "admin");
    const adminFiles = walkSrc(adminApiDir);
    for (const path of adminFiles) {
      const src = readFileSync(path, "utf8");
      if (/jobKind\s*:\s*["']source_ingest["']/.test(src)) {
        throw new Error(`${path.replace(process.cwd(), "")} still enqueues source_ingest`);
      }
    }
  });
});

describe("no automatic process saves failed content as review", () => {
  it("the runner's status routing does NOT default REJECTED items to REVIEW", () => {
    const runner = readFileSync(join(SRC_DIR, "lib", "ingestion", "runner.ts"), "utf8");
    // The spec: "Do not allow any automatic process to save failed
    // content as review." The new factory deletes failed builds; the
    // runner must not insert REVIEW rows automatically.
    //
    // Concretely: when content fails validation, the new runner
    // hard-rejects or sends to RejectedContentLog. It does NOT set
    // status: "REVIEW" as an automatic side effect of a failed item.
    //
    // This audit checks that there is no automatic "soft-fail goes
    // to review" branch — only explicit admin-decision moves can set
    // a row to REVIEW.
    //
    // We allow the file to mention REVIEW in comments + in the
    // "manual admin review" code path; we just refuse automatic
    // routing.
    const lines = runner.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      // Match any automatic write that sets status to REVIEW.
      // Specifically catch "status: 'REVIEW'" inside a prisma
      // create/update where there's no preceding `manual` indicator.
      if (/status\s*:\s*["']REVIEW["']/.test(line)) {
        // Found a REVIEW write — check the surrounding 10 lines for
        // "manual" / "admin" / "reviewer" justification.
        const window = lines.slice(Math.max(0, i - 10), Math.min(lines.length, i + 5)).join(" ");
        const isManual =
          /manual\b|adminReview|reviewer|moveToReview|approveContent|requestRevision/.test(window);
        if (!isManual) {
          throw new Error(
            `${"runner.ts"}:${i + 1} writes status="REVIEW" without an explicit manual-route marker. Failed content must be deleted, not auto-routed to review.`,
          );
        }
      }
    }
  });
});

describe("cleanup deletes invalid content (does not hide it)", () => {
  it("strict cleanup logs to RejectedContentLog and hard-deletes", () => {
    const cleanup = readFileSync(join(SRC_DIR, "lib", "content-qa", "cleanup.ts"), "utf8");
    expect(cleanup).toMatch(/RejectedContentLog|rejectedContentLog/);
    // Must reference a deletion operation, not "hide" or "soft-archive".
    expect(cleanup).toMatch(/delete|deleteMany/);
  });
});
