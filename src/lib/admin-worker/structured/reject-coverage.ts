/**
 * Static "a null must report" scanner for the structured-ingest directory.
 *
 * The typed `MapResult` contract already makes a bare `return null` inside a
 * mapper a COMPILE error, which is the real guarantee. This scanner is the
 * second line of defence, and it catches the two things the compiler cannot:
 *
 *   1. a future `map()` (or `MapResult`-returning helper) written back to
 *      `CuratedEntry | null`, where `return null` type-checks again — the exact
 *      regression that produced the production symptom this work fixes:
 *      68 rows fetched, 66 discarded, not one recorded reason;
 *   2. a `reject("...")` naming a code outside `REJECTION_CODES` — impossible
 *      today, but trivial to reintroduce by widening the parameter to `string`,
 *      after which the histogram silently grows buckets nobody counts.
 *
 * It is a source scanner, in the spirit of `src/lib/security/admin-route-
 * coverage.ts`: it reads files from disk so CI fails the moment the rule is
 * broken. Nothing on the request path imports it, so `node:fs` never reaches a
 * bundled route — it is imported by
 * `tests/admin-worker/structured-reject-coverage.test.ts` and by the operator
 * diagnostic script.
 *
 * Deliberately syntactic, not a type checker: comments and string literals are
 * blanked (spaces, offsets preserved) before any pattern is applied, so prose
 * about `return null` in a doc comment is never mistaken for code.
 */

import fs from "node:fs";
import path from "node:path";

import { REJECTION_CODES, isRejectionCode } from "./reject";

/** Directory the rule applies to, relative to the repo root. */
export const STRUCTURED_DIR = "src/lib/admin-worker/structured";

/**
 * Files exempt from the region scan.
 *
 * Only the two files that TALK about the rule rather than obeying it: the
 * contract itself and this scanner. Neither declares a mapper, and both contain
 * the literal patterns being searched for.
 */
export const SCAN_EXEMPT_FILES: ReadonlySet<string> = new Set(["reject.ts", "reject-coverage.ts"]);

/** A function body that must never discard a row without a reason. */
export interface RejectRegion {
  /** Repo-relative POSIX path. */
  file: string;
  /** `map` for an ingestor mapper, else the declared function name. */
  name: string;
  /** Why this body is in scope: an ingestor mapper, or its declared type. */
  kind: "mapper" | "map-result-helper";
  /** 1-indexed line the body opens on. */
  startLine: number;
  /** 1-indexed line the body closes on. */
  endLine: number;
}

/** A bare `return null` / `return undefined` inside a reporting region. */
export interface BareReturn {
  file: string;
  /** 1-indexed. */
  line: number;
  /** The region it was found in. */
  region: string;
  /** The offending source line, trimmed. */
  text: string;
}

/** A `reject(...)` call naming something outside the closed code set. */
export interface UnknownCode {
  file: string;
  line: number;
  code: string;
}

export interface RejectCoverageReport {
  /** Files scanned (repo-relative POSIX). */
  files: string[];
  regions: RejectRegion[];
  /** THE assertion: this must stay empty. */
  bareReturns: BareReturn[];
  /** Distinct rejection codes actually used in the directory, sorted. */
  codesUsed: string[];
  /** Codes declared in `REJECTION_CODES` but never used anywhere. */
  codesUnused: string[];
  /** THE other assertion: this must stay empty. */
  unknownCodes: UnknownCode[];
}

/**
 * Replace comment bodies (and, when asked, string bodies) with spaces,
 * preserving every offset and newline, so later regexes see code only.
 *
 * Template literals get real handling rather than "find the next backtick":
 * `ingestors.ts` builds a pope's summary from a template whose `${…}` holds
 * ANOTHER template, and a naive scanner desynchronises there, unbalances the
 * braces, and silently loses the whole pope mapper from the scan — a guard
 * that quietly stops covering a file is worse than no guard. Literal segments
 * are blanked; the `{`/`}` of each substitution are KEPT so brace matching
 * still balances, and the code inside a substitution is scanned normally.
 *
 * A single/double-quoted "string" that would run past a newline is not a
 * string (JS forbids it) — that is a quote character inside a regex literal,
 * so it is stepped over rather than allowed to swallow the rest of the file.
 */
function blank(source: string, opts: { strings: boolean }): string {
  const out = source.split("");
  const n = source.length;
  const erase = (from: number, to: number): void => {
    for (let k = Math.max(0, from); k < to && k < n; k += 1) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };

  /** End of a `//` or block comment starting at `i` (blanked), exclusive. */
  const skipComment = (i: number): number => {
    if (source[i + 1] === "/") {
      let j = i + 2;
      while (j < n && source[j] !== "\n") j += 1;
      erase(i, j);
      return j;
    }
    let j = i + 2;
    while (j < n && !(source[j] === "*" && source[j + 1] === "/")) j += 1;
    const end = Math.min(j + 2, n);
    erase(i, end);
    return end;
  };

  /**
   * A quoted string starting at `i`, or `i + 1` when the quote turns out to be
   * an ordinary character (an apostrophe inside a regex literal, say).
   */
  const skipQuoted = (i: number): number => {
    const quote = source[i];
    let j = i + 1;
    while (j < n) {
      if (source[j] === "\\") {
        j += 2;
        continue;
      }
      if (source[j] === "\n") return i + 1; // not a string after all
      if (source[j] === quote) break;
      j += 1;
    }
    if (j >= n) return i + 1;
    if (opts.strings) erase(i, j + 1);
    return j + 1;
  };

  /** Index just past the template literal opening at `i`. */
  const skipTemplate = (i: number): number => {
    let j = i + 1;
    let segStart = i;
    while (j < n) {
      const c = source[j];
      if (c === "\\") {
        j += 2;
        continue;
      }
      if (c === "`") {
        if (opts.strings) erase(segStart, j + 1);
        return j + 1;
      }
      if (c === "$" && source[j + 1] === "{") {
        // Blank the literal text and the `$`, KEEP the `{` so braces balance.
        if (opts.strings) erase(segStart, j + 1);
        const close = skipSubstitution(j + 1);
        segStart = close + 1;
        j = close + 1;
        continue;
      }
      j += 1;
    }
    if (opts.strings) erase(segStart, n);
    return n;
  };

  /** Index of the `}` closing the substitution whose `{` is at `open`. */
  const skipSubstitution = (open: number): number => {
    let depth = 0;
    let k = open;
    while (k < n) {
      const c = source[k];
      const next = source[k + 1];
      if (c === "/" && (next === "/" || next === "*")) {
        k = skipComment(k);
        continue;
      }
      if (c === '"' || c === "'") {
        k = skipQuoted(k);
        continue;
      }
      if (c === "`") {
        k = skipTemplate(k);
        continue;
      }
      if (c === "{") depth += 1;
      else if (c === "}") {
        depth -= 1;
        if (depth === 0) return k;
      }
      k += 1;
    }
    return n - 1;
  };

  let i = 0;
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "/" && (next === "/" || next === "*")) {
      i = skipComment(i);
      continue;
    }
    if (c === '"' || c === "'") {
      i = skipQuoted(i);
      continue;
    }
    if (c === "`") {
      i = skipTemplate(i);
      continue;
    }
    i += 1;
  }
  return out.join("");
}

/** Index of the `}` matching the `{` at `open`, or -1. */
function matchBrace(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    const c = code[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 1-indexed line number of a character offset. */
function lineAt(prefixLines: number[], offset: number): number {
  let lo = 0;
  let hi = prefixLines.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (prefixLines[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Start offset of each line, for offset → line lookups. */
function lineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

/**
 * An ingestor mapper: `map(row, ctx) { … }` or `async map(row, ctx): T { … }`.
 * A `map(` that ends in `;` (the interface declaration) has no body and is not
 * a region.
 */
const MAPPER_RE = /(^|[\s,{])(?:async\s+)?map\s*\(/g;

/**
 * A function whose RETURN TYPE mentions `MapResult` / `MapRejection` — the
 * helpers that share the mapper's obligation (`resolveSourcedNarrative` today).
 */
const MAP_RESULT_RETURN_RE = /\)\s*:\s*([^;{=]*\b(?:MapResult|MapRejection)\b[^;{=]*?)(=>\s*)?\{/g;

/** A bare discard: `return null` / `return undefined`, with no reason. */
const BARE_RETURN_RE = /\breturn\s+(?:null|undefined)\s*(?:as\s+[^;]*)?[;)]/g;

/**
 * A rejection code named anywhere it can be named: `reject("…")`, the
 * orchestrator's `note("…")`, `tallyRejection(h, "…")`, and a `code: "…"`
 * field on a result object. All four are checked against the closed set, so
 * widening any of those parameters to `string` cannot smuggle in a bucket.
 */
const REJECT_CALL_RE =
  /\b(?:reject|note)\(\s*["']([^"']+)["']|\btallyRejection\([^,]+,\s*["']([^"']+)["']|\bcode:\s*["']([^"']+)["']/g;

/** The declared name closest before `at` (for reporting), else "anonymous". */
function nameBefore(code: string, at: number): string {
  const head = code.slice(Math.max(0, at - 240), at);
  const m = [...head.matchAll(/(?:function|const|let|var)\s+([A-Za-z0-9_$]+)/g)].pop();
  return m?.[1] ?? "anonymous";
}

/**
 * Scan the structured directory for reporting regions and rule violations.
 *
 * Never throws on a missing directory or an unreadable file: a scanner that
 * crashes is a scanner someone deletes.
 */
export function scanStructuredRejectCoverage(
  opts: { rootDir?: string; dir?: string } = {},
): RejectCoverageReport {
  const rootDir = opts.rootDir ?? process.cwd();
  const dir = path.join(rootDir, opts.dir ?? STRUCTURED_DIR);
  const report: RejectCoverageReport = {
    files: [],
    regions: [],
    bareReturns: [],
    codesUsed: [],
    codesUnused: [],
    unknownCodes: [],
  };

  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
  } catch {
    return report;
  }

  const used = new Set<string>();
  for (const entry of entries.sort()) {
    if (SCAN_EXEMPT_FILES.has(entry)) continue;
    let source: string;
    try {
      source = fs.readFileSync(path.join(dir, entry), "utf8");
    } catch {
      continue;
    }
    const rel = `${opts.dir ?? STRUCTURED_DIR}/${entry}`;
    report.files.push(rel);
    const starts = lineStarts(source);
    // Code only (no comments, no string bodies) for structural patterns …
    const code = blank(source, { strings: true });
    // … and comment-free-but-strings-intact for reading the code literals.
    const withStrings = blank(source, { strings: false });

    const bodies: Array<{ open: number; close: number; name: string; kind: RejectRegion["kind"] }> =
      [];

    MAPPER_RE.lastIndex = 0;
    for (let m = MAPPER_RE.exec(code); m; m = MAPPER_RE.exec(code)) {
      // Step past the parameter list, then require a body brace (an interface
      // declaration ends in `;` and is skipped).
      let i = code.indexOf("(", m.index);
      let depth = 0;
      for (; i < code.length; i += 1) {
        if (code[i] === "(") depth += 1;
        else if (code[i] === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      let j = i + 1;
      while (j < code.length && code[j] !== "{" && code[j] !== ";") j += 1;
      if (code[j] !== "{") continue;
      const close = matchBrace(code, j);
      if (close < 0) continue;
      bodies.push({ open: j, close, name: "map", kind: "mapper" });
    }

    MAP_RESULT_RETURN_RE.lastIndex = 0;
    for (let m = MAP_RESULT_RETURN_RE.exec(code); m; m = MAP_RESULT_RETURN_RE.exec(code)) {
      const open = code.indexOf("{", m.index + m[0].length - 1);
      if (open < 0) continue;
      const close = matchBrace(code, open);
      if (close < 0) continue;
      if (bodies.some((b) => b.open === open)) continue;
      bodies.push({
        open,
        close,
        name: nameBefore(code, m.index),
        kind: "map-result-helper",
      });
    }

    for (const b of bodies) {
      report.regions.push({
        file: rel,
        name: b.name,
        kind: b.kind,
        startLine: lineAt(starts, b.open),
        endLine: lineAt(starts, b.close),
      });
      const body = code.slice(b.open, b.close);
      BARE_RETURN_RE.lastIndex = 0;
      for (let r = BARE_RETURN_RE.exec(body); r; r = BARE_RETURN_RE.exec(body)) {
        const at = b.open + r.index;
        const line = lineAt(starts, at);
        report.bareReturns.push({
          file: rel,
          line,
          region: b.name,
          text: (source.split("\n")[line - 1] ?? "").trim(),
        });
      }
    }

    REJECT_CALL_RE.lastIndex = 0;
    for (let m = REJECT_CALL_RE.exec(withStrings); m; m = REJECT_CALL_RE.exec(withStrings)) {
      const code_ = m[1] ?? m[2] ?? m[3] ?? "";
      used.add(code_);
      if (!isRejectionCode(code_)) {
        report.unknownCodes.push({ file: rel, line: lineAt(starts, m.index), code: code_ });
      }
    }
  }

  report.codesUsed = [...used].sort();
  report.codesUnused = REJECTION_CODES.filter((c) => !used.has(c)).sort();
  return report;
}
