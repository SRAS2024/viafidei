/**
 * Static audit: prove no code path outside the content factory
 * writes `publicRenderReady: true` or `isThresholdEligible: true`
 * through a Prisma write call (`create` / `update` / `upsert` /
 * `updateMany`).
 *
 * Why this audit exists:
 *
 *   * `persistBuiltPackage()` is the single place where these flags
 *     may be flipped to true, and it does so only after the strict
 *     QA pipeline has accepted the package.
 *   * The factory and strict-QA modules legitimately reference the
 *     fields in many other shapes — return types, decision objects,
 *     where filters, named constants. Those are not writes.
 *
 * The audit is intentionally narrow: it walks every .ts/.tsx file
 * outside the allow-listed factory directories, finds each Prisma
 * write call, and asserts none of them sets the gate flags. A new
 * write that bypasses the factory will fail this test and force the
 * author to route through `persistBuiltPackage()`.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = join(process.cwd(), "src");

// The factory + strict QA legitimately reference these fields in
// decision objects, where filters, and return types. Persistence
// itself lives under content-factory.
const FACTORY_ALLOWLIST_PREFIXES = ["/src/lib/content-factory/", "/src/lib/content-qa/"];

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

function isAllowlisted(absPath: string): boolean {
  const rel = absPath.replace(process.cwd(), "");
  return FACTORY_ALLOWLIST_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

/**
 * Find every Prisma write call in a file. A write call matches
 * `prisma.<model>.(create|update|upsert|updateMany)(` and we
 * capture the full call expression including its argument object so
 * we can scan the data: block for the gate flags.
 */
function findPrismaWriteCalls(src: string): Array<{ offset: number; body: string }> {
  const out: Array<{ offset: number; body: string }> = [];
  const re = /prisma\.[A-Za-z_][A-Za-z0-9_]*\.(create|update|upsert|updateMany)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const openParenAt = re.lastIndex - 1;
    // Walk forward to find the matching closing paren, tracking
    // nested braces/parens/quotes.
    const close = findMatchingClose(src, openParenAt);
    if (close === -1) continue;
    out.push({ offset: m.index, body: src.slice(openParenAt, close + 1) });
  }
  return out;
}

function findMatchingClose(src: string, openParenAt: number): number {
  let parenDepth = 0;
  let braceDepth = 0;
  let inString: '"' | "'" | "`" | null = null;
  for (let i = openParenAt; i < src.length; i++) {
    const ch = src[i]!;
    const prev = i > 0 ? src[i - 1] : "";
    if (inString) {
      if (ch === inString && prev !== "\\") inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch as '"' | "'" | "`";
      continue;
    }
    if (ch === "(") parenDepth += 1;
    else if (ch === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) return i;
    } else if (ch === "{") braceDepth += 1;
    else if (ch === "}") braceDepth -= 1;
  }
  return -1;
}

function bodyContainsFlagWrite(body: string, flag: string): boolean {
  // Match the flag inside what looks like an object-literal value
  // (followed by comma, newline, or closing brace). Skip type-literal
  // uses (followed by ;) and where/select keys.
  const re = new RegExp(`\\b${flag}\\s*:\\s*true\\s*[,}\\s]`);
  if (!re.test(body)) return false;
  // Exclude bodies whose only match is inside a where/select/orderBy
  // sub-object. Walk the body and check enclosing-key context for
  // each match.
  const matchRe = new RegExp(`\\b${flag}\\s*:\\s*true\\b`, "g");
  let m: RegExpExecArray | null;
  matchRe.lastIndex = 0;
  while ((m = matchRe.exec(body)) !== null) {
    const offset = m.index;
    if (!isInReadContext(body, offset)) return true;
  }
  return false;
}

function isInReadContext(src: string, offset: number): boolean {
  // Walk back through brace structure; if any enclosing object key
  // is where / select / include / orderBy, treat as read filter.
  let depth = 0;
  for (let i = offset; i >= 0; i--) {
    const ch = src[i]!;
    if (ch === "}") depth += 1;
    else if (ch === "{") {
      if (depth === 0) {
        const head = src.slice(Math.max(0, i - 80), i);
        const km = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/.exec(head);
        const key = km ? km[1]! : "";
        if (key === "where" || key === "select" || key === "include" || key === "orderBy") {
          return true;
        }
      } else {
        depth -= 1;
      }
    }
  }
  return false;
}

function findOffenders(flag: string): Array<{ path: string; line: number; snippet: string }> {
  const out: Array<{ path: string; line: number; snippet: string }> = [];
  for (const path of FILES) {
    if (isAllowlisted(path)) continue;
    const src = readFileSync(path, "utf8");
    for (const call of findPrismaWriteCalls(src)) {
      if (!bodyContainsFlagWrite(call.body, flag)) continue;
      const before = src.slice(0, call.offset);
      const line = before.split("\n").length;
      out.push({
        path: path.replace(process.cwd(), ""),
        line,
        snippet: call.body.slice(0, 120).replace(/\s+/g, " "),
      });
    }
  }
  return out;
}

describe("factory bypass audit — only persistBuiltPackage may set publicRenderReady = true", () => {
  it("at least one source file exists (sanity check)", () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it("the audit detects Prisma write calls (sanity — parser works)", () => {
    // The factory IS allow-listed, but we can prove the parser works
    // by scanning it directly: persist.ts contains many prisma write
    // calls that the parser must recognise.
    const persistPath = join(SRC_DIR, "lib/content-factory/persist.ts");
    const src = readFileSync(persistPath, "utf8");
    const calls = findPrismaWriteCalls(src);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("the audit's flag-detector recognises a literal flag write inside a synthetic call body", () => {
    // Sanity check: a synthetic prisma.create({ data: { publicRenderReady: true, ... } })
    // body is correctly classified as a write (not a read filter).
    const body =
      'prisma.prayer.create({ data: { slug: "x", publicRenderReady: true, isThresholdEligible: true } })';
    expect(bodyContainsFlagWrite(body, "publicRenderReady")).toBe(true);
    expect(bodyContainsFlagWrite(body, "isThresholdEligible")).toBe(true);
  });

  it("the audit's flag-detector does NOT flag a where-clause filter as a write", () => {
    const body =
      'prisma.prayer.count({ where: { publicRenderReady: true, isThresholdEligible: true, status: "PUBLISHED" } })';
    expect(bodyContainsFlagWrite(body, "publicRenderReady")).toBe(false);
    expect(bodyContainsFlagWrite(body, "isThresholdEligible")).toBe(false);
  });

  it("no source file outside content-factory / content-qa writes 'publicRenderReady: true' via Prisma", () => {
    const offenders = findOffenders("publicRenderReady");
    if (offenders.length > 0) {
      const summary = offenders.map((o) => `${o.path}:${o.line}  ${o.snippet}`).join("\n");
      throw new Error(
        `publicRenderReady=true is written outside the content factory:\n${summary}\n\n` +
          "All public-render flips must go through src/lib/content-factory/persist.ts " +
          "so strict QA gates them.",
      );
    }
  });

  it("no source file outside content-factory / content-qa writes 'isThresholdEligible: true' via Prisma", () => {
    const offenders = findOffenders("isThresholdEligible");
    if (offenders.length > 0) {
      const summary = offenders.map((o) => `${o.path}:${o.line}  ${o.snippet}`).join("\n");
      throw new Error(
        `isThresholdEligible=true is written outside the content factory:\n${summary}\n\n` +
          "Threshold eligibility may only be set by the factory's persistBuiltPackage(), " +
          "after the strict QA pipeline has accepted the package.",
      );
    }
  });
});
