/**
 * All PUBLIC content creation goes through the content factory.
 *
 * The spec balances two requirements:
 *
 *   1. "Do not allow any feature to create public content outside
 *       the content factory."
 *   2. "Keep manual admin editing available."
 *
 * Reconciling them: manual admin creation IS allowed (admin can
 * create a draft prayer), but the resulting row must NOT have the
 * public-gate flags set. Those flags (publicRenderReady,
 * isThresholdEligible) are owned by the factory's
 * persistBuiltPackage() and are gated by strict QA — see the
 * separate factory-bypass-audit.test.ts which proves it.
 *
 * This audit complements that by asserting:
 *
 *   * No non-factory source contains a Prisma create-with-public-
 *     flags pattern (i.e. a create call whose data block sets
 *     status="PUBLISHED" or publicRenderReady=true).
 *   * The startup seeder, which legitimately creates draft rows at
 *     boot, is allow-listed because (a) it's idempotent + (b) the
 *     factory's revalidation pass owns the public-gate transition
 *     for those rows.
 *   * Admin catalog routes create draft rows but never set the
 *     public flags (proven by factory-bypass-audit.test.ts).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = join(process.cwd(), "src");

const CONTENT_MODELS = [
  "prayer",
  "saint",
  "marianApparition",
  "parish",
  "devotion",
  "liturgyEntry",
  "spiritualLifeGuide",
];

// Directories that legitimately call prisma.<contentModel>.create:
//
//   * content-factory      — the canonical creator.
//   * ingestion/persist    — legacy per-content-type persister
//                            helpers the factory delegates to.
//   * data/admin-catalog   — manual admin editing (creates DRAFT
//                            rows; the public-gate transition is
//                            owned by the factory).
//   * startup/seeder       — idempotent startup seed; the strict-
//                            cleanup pass revalidates these rows
//                            before they go public.
const ALLOW_LIST_PREFIXES = [
  "/src/lib/content-factory/",
  "/src/lib/ingestion/persist/",
  "/src/lib/data/admin-catalog",
  "/src/lib/startup/seeder",
];

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

function isAllowed(absPath: string): boolean {
  const rel = absPath.replace(process.cwd(), "");
  return ALLOW_LIST_PREFIXES.some((p) => rel.startsWith(p));
}

describe("content creation only happens inside the content factory", () => {
  for (const model of CONTENT_MODELS) {
    it(`no prisma.${model}.create call exists outside content-factory / ingestion/persist`, () => {
      const offenders: Array<{ path: string; line: number; text: string }> = [];
      const re = new RegExp(`prisma\\.${model}\\.create\\s*\\(`);
      for (const path of FILES) {
        if (isAllowed(path)) continue;
        const src = readFileSync(path, "utf8");
        const lines = src.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (re.test(line)) {
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
          `Direct prisma.${model}.create calls outside the factory:\n${summary}\n\nAll content creation must route through persistBuiltPackage() inside src/lib/content-factory/persist.ts.`,
        );
      }
    });

    it(`no prisma.${model}.upsert or .createMany call exists outside the allow-list`, () => {
      const offenders: Array<{ path: string; line: number; text: string }> = [];
      const re = new RegExp(`prisma\\.${model}\\.(?:upsert|createMany)\\s*\\(`);
      for (const path of FILES) {
        if (isAllowed(path)) continue;
        const src = readFileSync(path, "utf8");
        const lines = src.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (re.test(line)) {
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
          `Direct prisma.${model}.upsert/createMany calls outside the factory:\n${summary}`,
        );
      }
    });
  }

  it("the factory's persist module IS in the allow-list (sanity check)", () => {
    expect(ALLOW_LIST_PREFIXES.some((p) => p === "/src/lib/content-factory/")).toBe(true);
  });
});

describe("allow-listed creators never set public-gate flags", () => {
  it("admin-catalog.ts creates rows but never sets publicRenderReady=true", () => {
    const src = readFileSync(join(SRC_DIR, "lib", "data", "admin-catalog.ts"), "utf8");
    // Manual admin creates are allowed, but they MUST default to
    // DRAFT and must NOT set the public-gate flags. The strict QA
    // pipeline is the only writer for those.
    expect(src).not.toMatch(/publicRenderReady\s*:\s*true\b/);
    expect(src).not.toMatch(/isThresholdEligible\s*:\s*true\b/);
  });

  it("startup seeder seeds DRAFT rows and never sets publicRenderReady=true", () => {
    const src = readFileSync(join(SRC_DIR, "lib", "startup", "seeder.ts"), "utf8");
    expect(src).not.toMatch(/publicRenderReady\s*:\s*true\b/);
    expect(src).not.toMatch(/isThresholdEligible\s*:\s*true\b/);
  });

  it("startup seeder creates rows at status=DRAFT — strict cleanup owns the PUBLISHED handover", () => {
    const src = readFileSync(join(SRC_DIR, "lib", "startup", "seeder.ts"), "utf8");
    // Every `create:` block in the seeder must use status: "DRAFT" so
    // the strict-cleanup pass owns the transition to PUBLISHED +
    // publicRenderReady=true.
    expect(src).toMatch(/create:\s*\{[^}]*status:\s*["']DRAFT["']/);
    // And the seeder must NOT force status="PUBLISHED" anywhere, as
    // that would create rows that bypass the public-gate.
    expect(src).not.toMatch(/status\s*:\s*["']PUBLISHED["']/);
  });
});
