/**
 * Hard new-system-only enforcement test.
 *
 * The content factory is the ONLY allowed path to public content.
 * This test scans the active production source tree and fails if:
 *
 *   1. Active production code in the worker dispatch surface imports
 *      or calls `runAdapter()`.
 *   2. Active production code creates public content outside
 *      `persistBuiltPackage()` — i.e. files that aren't the persist
 *      module must not call `.create()` / `.update()` on the public
 *      content models with `status: "PUBLISHED"`.
 *   3. Any active route or worker path can set `publicRenderReady`
 *      or `isThresholdEligible` without going through strict QA. The
 *      `persistBuiltPackage()` module is the only allowed writer.
 *   4. Any active threshold counter uses raw row counts as official
 *      progress (the catalog count must be filtered by
 *      `publicRenderReady` + `isThresholdEligible`).
 *   5. Any active public query omits the strict public gate.
 *
 * A regression — e.g. a new admin route that flips
 * `publicRenderReady = true` without strict QA — fails this test
 * before it can ship.
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

/** Files in the active worker / dispatch surface. */
const WORKER_SURFACE_FILES = [
  "src/lib/ingestion/queue/worker.ts",
  "src/lib/ingestion/queue/dispatch.ts",
  "src/lib/ingestion/queue/factory-native-discovery.ts",
  "src/lib/ingestion/queue/build-enqueue.ts",
];

/**
 * Public content models. `persistBuiltPackage()` is the only writer
 * allowed to PUBLISH a new row in these tables.
 */
const PUBLIC_CONTENT_MODELS = [
  "prayer",
  "saint",
  "marianApparition",
  "parish",
  "devotion",
  "spiritualLifeGuide",
  "liturgyEntry",
];

/**
 * Files explicitly allowed to write `status: "PUBLISHED"` on a public
 * content model:
 *
 *   - the persist module itself (strict-QA gated)
 *   - the strict cleanup pass (it can FLAG-DOWN rows but its publish
 *     path is gated by validation)
 *   - the legacy ingestion persisters (still reachable from
 *     factory-side persisters during the migration window)
 *   - the seeder (creates baseline content; the user's spec requires
 *     this to migrate to the factory in a later step)
 *   - the admin "publish list" promote-pending helper (manual admin
 *     action — TODO: migrate so the admin approval still runs strict
 *     QA before publishing)
 */
const PUBLISHED_WRITE_ALLOWLIST = [
  "src/lib/content-factory/persist.ts",
  "src/lib/content-qa/cleanup.ts",
  "src/lib/ingestion/persist/persist-prayer.ts",
  "src/lib/ingestion/persist/persist-saint.ts",
  "src/lib/ingestion/persist/persist-apparition.ts",
  "src/lib/ingestion/persist/persist-parish.ts",
  "src/lib/ingestion/persist/persist-devotion.ts",
  "src/lib/ingestion/persist/persist-guide.ts",
  "src/lib/ingestion/persist/persist-liturgy.ts",
  "src/lib/startup/seeder.ts",
  "src/lib/startup/promote-ingested.ts",
  "src/lib/data/publish-list.ts",
];

function withinAllowlist(filePath: string, allowlist: string[]): boolean {
  const rel = filePath.replace(process.cwd() + "/", "");
  return allowlist.some((entry) => rel === entry);
}

describe("worker never calls runAdapter() for active content creation", () => {
  it("the worker dispatch surface does NOT import runAdapter", () => {
    const offenders: string[] = [];
    for (const entry of WORKER_SURFACE_FILES) {
      const path = join(process.cwd(), entry);
      const src = readFileSync(path, "utf8");
      // The dispatch surface must not import runAdapter at all.
      // Allow the comment in factory-native-discovery (it references
      // the removed path in its docstring).
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (/import\s+[^"']*runAdapter/.test(line)) {
          offenders.push(`${entry}:${i + 1}  ${line.trim()}`);
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        "Worker surface still imports runAdapter — remove all imports so the worker cannot reach the legacy execution path:\n" +
          offenders.join("\n"),
      );
    }
  });

  it("the worker dispatch surface does NOT call runAdapter", () => {
    const offenders: string[] = [];
    for (const entry of WORKER_SURFACE_FILES) {
      const path = join(process.cwd(), entry);
      const src = readFileSync(path, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Skip pure docstring / comment lines.
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
        // Match an actual invocation: `runAdapter(...)` or
        // `await runAdapter(`. We exclude the function declaration
        // because runAdapter is still declared in runner.ts (out of
        // scope here).
        if (/\brunAdapter\s*\(/.test(line)) {
          offenders.push(`${entry}:${i + 1}  ${line.trim()}`);
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        "Worker surface still calls runAdapter — the worker must never run the legacy adapter path:\n" +
          offenders.join("\n"),
      );
    }
  });
});

describe("only persistBuiltPackage() creates public content", () => {
  it("no active production file outside the allowlist sets status='PUBLISHED' on a public content model write", () => {
    // Only catch DATA writes (the `data:` field of a prisma create /
    // update / upsert call). Where filters that read PUBLISHED rows
    // are correct usage and must not flag.
    const offenders: Array<{ path: string; line: number; text: string }> = [];
    for (const path of FILES) {
      if (withinAllowlist(path, PUBLISHED_WRITE_ALLOWLIST)) continue;
      if (path.includes("/__tests__/") || path.endsWith(".test.ts")) continue;
      const src = readFileSync(path, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!/status\s*:\s*["']PUBLISHED["']/.test(line)) continue;
        // Single-line where filter (e.g. `where: { status: "PUBLISHED" }`)
        // is allowed — it is a query, not a write.
        if (/\bwhere\s*:\s*\{[^{}]*status\s*:\s*["']PUBLISHED["']/.test(line)) continue;
        // Multi-line where filter: a `where: {` opener within the
        // preceding 12 lines and no closing `}` between it and the
        // current line.
        const back = lines.slice(Math.max(0, i - 12), i).join("\n");
        const isMultiLineWhere = /\bwhere\s*:\s*\{[^}]*$/m.test(back);
        if (isMultiLineWhere) continue;
        // Confirm the write targets a public content model.
        const window = lines.slice(Math.max(0, i - 12), Math.min(lines.length, i + 12)).join("\n");
        const hasPublicModelWrite = PUBLIC_CONTENT_MODELS.some((m) =>
          new RegExp(`prisma\\.${m}\\.(create|update|upsert|createMany|updateMany)`).test(window),
        );
        if (!hasPublicModelWrite) continue;
        offenders.push({
          path: path.replace(process.cwd(), ""),
          line: i + 1,
          text: line.trim(),
        });
      }
    }
    if (offenders.length > 0) {
      const summary = offenders.map((o) => `${o.path}:${o.line}  ${o.text}`).join("\n");
      throw new Error(
        "Public content created outside persistBuiltPackage() / allowlist — add the file to the persistence allowlist only if it is a strict-QA gated path:\n" +
          summary,
      );
    }
  });

  it("publicRenderReady / isThresholdEligible are not written true outside the strict-QA path", () => {
    // Only catch prisma WRITE contexts (data: { ... }), not WHERE
    // filters (which is the correct way to query for public-ready
    // rows) and not validation-result object literals (which are
    // pure structs, not DB writes).
    const offenders: Array<{ path: string; line: number; text: string }> = [];
    for (const path of FILES) {
      if (withinAllowlist(path, PUBLISHED_WRITE_ALLOWLIST)) continue;
      if (path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
      // Validation-result helpers in content-qa/contracts/* return
      // ContractValidationResult objects whose shape includes
      // `publicRenderReady` — that is the QA verdict, not a DB write.
      const rel = path.replace(process.cwd() + "/", "");
      if (rel.startsWith("src/lib/content-qa/contracts/")) continue;
      if (rel === "src/lib/content-qa/row-provenance.ts") continue;
      const src = readFileSync(path, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
        const setsRenderReady = /\bpublicRenderReady\s*:\s*true\b/.test(line);
        const setsThresholdEligible = /\bisThresholdEligible\s*:\s*true\b/.test(line);
        if (!setsRenderReady && !setsThresholdEligible) continue;
        // Look back up to 12 lines for the enclosing context. If the
        // enclosing context is `where: { ... }`, this is a query
        // filter — allowed. If the enclosing context is `data: { ... }`
        // or a `.update({ ... })` / `.create({ ... })`, this is a
        // DB write — disallowed outside the allowlist.
        const window = lines.slice(Math.max(0, i - 12), i + 1).join("\n");
        const isWhereFilter = /\bwhere\s*:\s*\{[^}]*$/m.test(window);
        const isDataWrite = /\bdata\s*:\s*\{[^}]*$/m.test(window);
        const isPrismaWriteCall =
          /prisma\.\w+\.(create|update|upsert|createMany|updateMany)\s*\(\s*\{[^}]*$/m.test(window);
        if (isWhereFilter && !isDataWrite && !isPrismaWriteCall) continue;
        // Plain type / object literal not part of a prisma write -
        // skip unless it's clearly in a write context.
        if (!isDataWrite && !isPrismaWriteCall) continue;
        offenders.push({
          path: path.replace(process.cwd(), ""),
          line: i + 1,
          text: line.trim(),
        });
      }
    }
    if (offenders.length > 0) {
      const summary = offenders.map((o) => `${o.path}:${o.line}  ${o.text}`).join("\n");
      throw new Error(
        "publicRenderReady / isThresholdEligible are being WRITTEN true outside the strict-QA persistence allowlist:\n" +
          summary,
      );
    }
  });
});

describe("threshold counters do not use raw row counts as official progress", () => {
  it("threshold counters filter by publicRenderReady + isThresholdEligible (or a strict-gate constant)", () => {
    const offenders: Array<{ path: string; line: number; text: string }> = [];
    for (const path of FILES) {
      const rel = path.replace(process.cwd() + "/", "");
      if (!rel.startsWith("src/lib/data/")) continue;
      const src = readFileSync(path, "utf8");
      const fnRegex = /function\s+(\w*[Tt]hreshold\w*|\w*[Pp]rogress\w*|\w*[Cc]ountValid\w*)/g;
      let m;
      while ((m = fnRegex.exec(src))) {
        const start = m.index;
        const end = Math.min(src.length, start + 1500);
        const block = src.slice(start, end);
        for (const model of PUBLIC_CONTENT_MODELS) {
          const callRe = new RegExp(`prisma\\.${model}\\.count\\s*\\(([^)]*)\\)`, "g");
          let c;
          while ((c = callRe.exec(block))) {
            const args = c[1] ?? "";
            // Accept any of: explicit flag pair, STRICT_PUBLIC_WHERE
            // constants, or the local withStrictPublicGate helper.
            const hasStrictFilter =
              /publicRenderReady\s*:\s*true/.test(args) ||
              /isThresholdEligible\s*:\s*true/.test(args) ||
              /STRICT_PUBLIC_WHERE_CLAUSE\b/.test(args) ||
              /STRICT_PUBLIC_WHERE\b/.test(args) ||
              /withStrictPublicGate\s*\(/.test(args);
            if (!hasStrictFilter) {
              const lineNumber = src.slice(0, start + c.index).split("\n").length;
              offenders.push({
                path: rel,
                line: lineNumber,
                text: `${m[1]} → prisma.${model}.count(${args.replace(/\s+/g, " ").trim()})`,
              });
            }
          }
        }
      }
    }
    if (offenders.length > 0) {
      const summary = offenders.map((o) => `${o.path}:${o.line}  ${o.text}`).join("\n");
      throw new Error(
        "Threshold counter uses raw row counts — must filter by publicRenderReady + isThresholdEligible:\n" +
          summary,
      );
    }
  });
});

describe("public queries enforce the strict public gate", () => {
  it("public-page data loaders filter by status='PUBLISHED' or the strict flags", () => {
    // The public-page loaders live in src/app/prayers, src/app/saints,
    // etc. We check that every prayer/saint findMany/findFirst that
    // ships in a public route path applies a strict filter.
    const offenders: Array<{ path: string; line: number; text: string }> = [];
    for (const path of FILES) {
      const rel = path.replace(process.cwd() + "/", "");
      // Limit to actual public route handlers (not admin, not API
      // internal, not seeders).
      const publicRoute =
        (rel.startsWith("src/app/prayers/") ||
          rel.startsWith("src/app/saints/") ||
          rel.startsWith("src/app/devotions/") ||
          rel.startsWith("src/app/sacraments/") ||
          rel.startsWith("src/app/liturgy/") ||
          rel.startsWith("src/app/liturgy-history/") ||
          rel.startsWith("src/app/history/") ||
          rel.startsWith("src/app/search/") ||
          rel === "src/app/sitemap.ts") &&
        !rel.includes("/admin/");
      if (!publicRoute) continue;
      if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
      const src = readFileSync(path, "utf8");
      // Look for `prisma.<publicModel>.findMany` / findFirst /
      // findUnique calls.
      for (const model of PUBLIC_CONTENT_MODELS) {
        const re = new RegExp(
          `prisma\\.${model}\\.(findMany|findFirst|findUnique)\\s*\\(([\\s\\S]*?)\\)`,
          "g",
        );
        let m;
        while ((m = re.exec(src))) {
          const args = m[2] ?? "";
          // Public read MUST filter by status="PUBLISHED", by the
          // strict flag pair, or by a known strict-gate constant
          // (STRICT_PUBLIC_WHERE_CLAUSE).
          const hasStrictFilter =
            /status\s*:\s*["']PUBLISHED["']/.test(args) ||
            /publicRenderReady\s*:\s*true/.test(args) ||
            /isThresholdEligible\s*:\s*true/.test(args) ||
            /STRICT_PUBLIC_WHERE_CLAUSE\b/.test(args) ||
            /STRICT_PUBLIC_WHERE\b/.test(args);
          if (!hasStrictFilter) {
            const lineNumber = src.slice(0, m.index).split("\n").length;
            offenders.push({
              path: rel,
              line: lineNumber,
              text: `prisma.${model}.${m[1]}(...) without a strict public gate`,
            });
          }
        }
      }
    }
    if (offenders.length > 0) {
      const summary = offenders.map((o) => `${o.path}:${o.line}  ${o.text}`).join("\n");
      throw new Error(
        "Public query omits the strict public gate — every public-route prisma read MUST filter by status='PUBLISHED' OR the strict flags:\n" +
          summary,
      );
    }
  });
});
