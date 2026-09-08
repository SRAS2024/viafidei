/**
 * THE RATCHET: a structured mapper may never discard a row without a reason.
 *
 * Production, 2026-09-07: `wikidata-spiritual-practices` fetched 68 rows,
 * recognised 1 as already live, and DISCARDED 66 — with no reason recorded for
 * any of them, in the log line, the log payload, or the worker's own
 * self-diagnosis. `ingestors.ts` held 65 `return null` statements and nobody
 * could tell a correct rejection from a bug.
 *
 * Two independent guards keep that from coming back, and this file exercises
 * both:
 *
 *   1. TYPE — a mapper answers `MapResult`, so `return null` is a compile
 *      error. The behavioural half of this file proves the runtime side of
 *      that: every registered ingestor, handed a row it cannot possibly map,
 *      answers an ATTRIBUTED rejection whose code is in the closed set.
 *   2. SOURCE — `scanStructuredRejectCoverage` re-reads the directory from
 *      disk and fails if any mapper (or `MapResult`-returning helper) can
 *      reach a bare `return null`, or if any rejection code outside
 *      `REJECTION_CODES` is named. Modelled on
 *      `tests/security/admin-gate-coverage.test.ts`: prove the scanner
 *      actually detects a violation FIRST, so the clean real-repo assertions
 *      below cannot pass vacuously.
 *
 * Fully offline: ADMIN_WORKER_SKIP_NETWORK=1, no fetch, no database.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { STRUCTURED_INGESTORS } from "@/lib/admin-worker/structured/ingestors";
import {
  REJECTION_CODES,
  formatRejections,
  isRejection,
  isRejectionCode,
  reject,
  tallyRejection,
  topRejections,
  totalRejections,
  type RejectionHistogram,
} from "@/lib/admin-worker/structured/reject";
import { scanStructuredRejectCoverage } from "@/lib/admin-worker/structured/reject-coverage";

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;

beforeEach(() => {
  savedSkip = process.env[SKIP];
  process.env[SKIP] = "1";
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
});

/** A throwaway repo whose structured directory holds exactly `files`. */
function fixtureDir(files: Record<string, string>): { rootDir: string; dir: string } {
  const rootDir = mkdtempSync(join(tmpdir(), "vf-reject-scan-"));
  const dir = "structured";
  mkdirSync(join(rootDir, dir), { recursive: true });
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(rootDir, dir, name), contents, "utf8");
  }
  return { rootDir, dir };
}

describe("the reject-coverage scanner actually works", () => {
  it("FLAGS a mapper that can reach a bare return null", () => {
    const fx = fixtureDir({
      "bad.ts": [
        "const ingestor = {",
        "  async map(row) {",
        "    const label = row.label;",
        "    if (!label) return null;",
        "    return { slug: label };",
        "  },",
        "};",
      ].join("\n"),
    });
    const report = scanStructuredRejectCoverage(fx);

    expect(report.regions).toHaveLength(1);
    expect(report.regions[0]!.kind).toBe("mapper");
    expect(report.bareReturns).toHaveLength(1);
    expect(report.bareReturns[0]!.line).toBe(4);
    expect(report.bareReturns[0]!.text).toBe("if (!label) return null;");
  });

  it("FLAGS a bare return null in a MapResult-returning helper too", () => {
    const fx = fixtureDir({
      "helper.ts": [
        "async function resolveThing(row): Promise<Thing | MapRejection> {",
        "  if (!row) return null;",
        '  return { rejected: true, code: "no_source_url" };',
        "}",
      ].join("\n"),
    });
    const report = scanStructuredRejectCoverage(fx);

    expect(report.regions.map((r) => r.kind)).toEqual(["map-result-helper"]);
    expect(report.regions[0]!.name).toBe("resolveThing");
    expect(report.bareReturns.map((b) => b.line)).toEqual([2]);
  });

  it("PASSES a mapper that attributes every rejection", () => {
    const fx = fixtureDir({
      "good.ts": [
        "const ingestor = {",
        "  async map(row) {",
        '    if (!row.label) return reject("no_english_label", "label");',
        '    return { slug: "x" };',
        "  },",
        "};",
      ].join("\n"),
    });
    const report = scanStructuredRejectCoverage(fx);

    expect(report.regions).toHaveLength(1);
    expect(report.bareReturns).toEqual([]);
    expect(report.codesUsed).toEqual(["no_english_label"]);
    expect(report.unknownCodes).toEqual([]);
  });

  it("does not mistake prose about `return null` in a comment for code", () => {
    const fx = fixtureDir({
      "commented.ts": [
        "const ingestor = {",
        "  async map(row) {",
        "    // Historically this did `return null;` with no reason recorded.",
        "    /* return null; */",
        '    return reject("slug_unresolvable");',
        "  },",
        "};",
      ].join("\n"),
    });
    expect(scanStructuredRejectCoverage(fx).bareReturns).toEqual([]);
  });

  it("does not treat the bodiless interface declaration as a region", () => {
    const fx = fixtureDir({
      "iface.ts": [
        "export interface StructuredIngestor {",
        "  map(row: SparqlBinding, ctx: IngestContext): Promise<MapResult>;",
        "}",
      ].join("\n"),
    });
    const report = scanStructuredRejectCoverage(fx);
    expect(report.regions).toEqual([]);
    expect(report.bareReturns).toEqual([]);
  });

  it("FLAGS a rejection code outside the closed set", () => {
    const fx = fixtureDir({
      "typo.ts": [
        "const ingestor = {",
        "  async map(row) {",
        '    return reject("feast_unparsable");', // one letter off
        "  },",
        "};",
      ].join("\n"),
    });
    const report = scanStructuredRejectCoverage(fx);
    expect(report.unknownCodes).toEqual([
      { file: "structured/typo.ts", line: 3, code: "feast_unparsable" },
    ]);
  });

  it("ignores its own two exempt files (the contract and this scanner)", () => {
    const fx = fixtureDir({
      "reject.ts": "async function map(x) { return null; }",
      "reject-coverage.ts": "async function map(x) { return null; }",
    });
    const report = scanStructuredRejectCoverage(fx);
    expect(report.files).toEqual([]);
    expect(report.bareReturns).toEqual([]);
  });
});

describe("no structured mapper can silently discard a row", () => {
  const report = scanStructuredRejectCoverage();

  it("finds the real mappers (sanity — the assertions below are not vacuous)", () => {
    const mappers = report.regions.filter((r) => r.kind === "mapper");
    expect(mappers.length).toBe(STRUCTURED_INGESTORS.length);
    expect(report.files).toContain("src/lib/admin-worker/structured/ingestors.ts");
    expect(report.regions.some((r) => r.kind === "map-result-helper")).toBe(true);
  });

  it("has ZERO bare `return null` in any mapper or MapResult helper", () => {
    // If this fails, the message names the file, line and source text.
    expect(report.bareReturns).toEqual([]);
  });

  it("names no rejection code outside the closed set", () => {
    expect(report.unknownCodes).toEqual([]);
    for (const code of report.codesUsed) expect(isRejectionCode(code)).toBe(true);
  });

  it("actually uses the codes it declares (no dead buckets)", () => {
    // A declared-but-never-used code is a bucket that can never be counted —
    // either the rule it names was deleted or the call site forgot it.
    expect(report.codesUnused).toEqual([]);
  });

  it("declares codes that are unique and machine-readable", () => {
    expect(new Set(REJECTION_CODES).size).toBe(REJECTION_CODES.length);
    for (const code of REJECTION_CODES) expect(code).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

describe("every ingestor attributes a reason for a row it cannot map", () => {
  it.each(STRUCTURED_INGESTORS.map((i) => [i.id, i] as const))(
    "%s rejects an empty row with a code from the closed set",
    async (_id, ingestor) => {
      const result = await ingestor.map({}, {} as Record<string, never>);
      expect(isRejection(result)).toBe(true);
      const rejection = isRejection(result) ? result : null;
      expect(rejection).not.toBeNull();
      expect(isRejectionCode(rejection!.code)).toBe(true);
    },
  );
});

describe("the reason histogram", () => {
  it("counts codes, never free text, and renders a stable top-N line", () => {
    const hist: RejectionHistogram = {};
    for (let i = 0; i < 41; i += 1) tallyRejection(hist, "narrative_too_short");
    for (let i = 0; i < 18; i += 1) tallyRejection(hist, "not_catholic_context");
    for (let i = 0; i < 7; i += 1) tallyRejection(hist, "unrecognized_type");

    expect(totalRejections(hist)).toBe(66);
    expect(topRejections(hist, 2)).toEqual([
      { code: "narrative_too_short", count: 41 },
      { code: "not_catholic_context", count: 18 },
    ]);
    expect(formatRejections(hist, 3)).toBe(
      "narrative_too_short 41, not_catholic_context 18, unrecognized_type 7",
    );
  });

  it("breaks count ties alphabetically so a log line is reproducible", () => {
    const hist: RejectionHistogram = {};
    tallyRejection(hist, "slug_unresolvable");
    tallyRejection(hist, "invalid_url");
    expect(formatRejections(hist)).toBe("invalid_url 1, slug_unresolvable 1");
  });

  it("renders nothing at all when nothing was rejected", () => {
    expect(formatRejections({})).toBe("");
    expect(totalRejections({})).toBe(0);
  });

  it("keeps the human detail bounded and out of the aggregation key", () => {
    const r = reject("narrative_too_short", `  ${"x".repeat(500)}  `);
    expect(r.code).toBe("narrative_too_short");
    expect(r.detail!.length).toBe(200);
    expect(reject("map_threw").detail).toBeUndefined();
  });
});
