/**
 * #1 (spec): "Remove any old process that moves automatic failures
 * into review. Review should exist only when the admin manually
 * chooses to inspect or edit something."
 *
 * The active factory pipeline (content-factory/*, content-qa/*,
 * worker dispatch, builder modules) MUST NOT write
 * `status: "REVIEW"` on a content row. Admin manual review remains
 * allowed via `src/lib/content/review.ts` + the admin route, which
 * are explicit human actions.
 *
 * Automatic failures must instead become:
 *   - build failure  → ContentPackageBuildLog row
 *   - QA rejection   → RejectedContentLog row + deletion
 *   - duplicate skip → persist returns "skipped" without writing
 *   - source not configured / not allowed → repair job marks the source
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const FILES = walk(SRC);

/**
 * Active path scopes — these are the only modules that can write
 * to the public catalog during automatic content creation. None of
 * them is allowed to set `status: "REVIEW"`.
 *
 * The legacy `lib/ingestion/runner.ts` + `enrich-decision.ts` +
 * `source-tier.ts` chain still has the old auto-review behaviour
 * baked in, but it is NOT reachable from the active worker (the
 * dispatch surface no longer imports `runAdapter`, enforced by
 * `tests/ingestion/new-system-enforcement.test.ts` and
 * `worker-no-runadapter-runtime.test.ts`). The cleanup test below
 * therefore scans the active surface only.
 */
const ACTIVE_PATH_PREFIXES = [
  "src/lib/content-factory/",
  "src/lib/content-qa/",
  "src/lib/ingestion/queue/",
  "src/lib/ingestion/persist/",
  "src/lib/data/",
  "src/lib/startup/",
  "src/app/api/cron/",
  "src/app/api/internal/",
];

/**
 * The only files allowed to write `status: "REVIEW"` are paths
 * gated by an explicit human admin action.
 */
const REVIEW_WRITE_ALLOWLIST = [
  "src/lib/content/review.ts", // admin moveToReview()
  "src/lib/content/status-update.ts", // generic setEntityStatus (admin-gated callers)
  "src/lib/data/publish-list.ts", // admin publish list helper
  // promote-ingested is a startup cleanup that PROMOTES stuck-in-REVIEW
  // rows to PUBLISHED — it reads REVIEW but never writes it.
  "src/lib/startup/promote-ingested.ts",
];

function withinAllowlist(path: string): boolean {
  const rel = path.replace(process.cwd() + "/", "");
  return REVIEW_WRITE_ALLOWLIST.includes(rel);
}

function inActiveSurface(path: string): boolean {
  const rel = path.replace(process.cwd() + "/", "");
  return ACTIVE_PATH_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

describe("no automatic path writes status='REVIEW'", () => {
  it("active factory + worker code never sets status='REVIEW' as a DB write", () => {
    const offenders: Array<{ path: string; line: number; text: string }> = [];
    for (const path of FILES) {
      if (withinAllowlist(path)) continue;
      if (path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
      if (!inActiveSurface(path)) continue;
      const rel = path.replace(process.cwd() + "/", "");
      const src = readFileSync(path, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
        if (!/status\s*:\s*["']REVIEW["']/.test(line)) continue;
        // Skip query filters (`where: { status: "REVIEW" }`) — those
        // are reads, not writes.
        if (/\bwhere\s*:\s*\{[^{}]*status\s*:\s*["']REVIEW["']/.test(line)) continue;
        // Look back for a multi-line where filter.
        const back = lines.slice(Math.max(0, i - 12), i).join("\n");
        if (/\bwhere\s*:\s*\{[^}]*$/m.test(back)) continue;
        offenders.push({
          path: rel,
          line: i + 1,
          text: line.trim(),
        });
      }
    }
    if (offenders.length > 0) {
      const summary = offenders
        .map((o) => `${o.path}:${o.line}  ${o.text}`)
        .join("\n");
      throw new Error(
        "Automatic path writes status='REVIEW' — REVIEW must only come from an explicit admin action:\n" +
          summary,
      );
    }
  });

  it("the content factory never imports or calls the deleted catalog-janitor", () => {
    const offenders: string[] = [];
    for (const path of FILES) {
      const src = readFileSync(path, "utf8");
      if (/from\s+["'][^"']*data\/catalog-janitor["']/.test(src)) {
        offenders.push(path.replace(process.cwd() + "/", ""));
      }
      if (/\brunCatalogJanitor\s*\(/.test(src)) {
        offenders.push(path.replace(process.cwd() + "/", ""));
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        "The legacy catalog-janitor must remain deleted — these files still reference it:\n" +
          offenders.join("\n"),
      );
    }
  });
});
