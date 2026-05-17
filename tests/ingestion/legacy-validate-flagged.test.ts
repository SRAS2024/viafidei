/**
 * Section 6 structural test. The pre-strict-QA validator
 * (src/lib/ingestion/validate.ts) is allowed to remain in the tree
 * but MUST be marked as LEGACY so a future refactor finds it. This
 * test fails if the deprecation header is removed.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const VALIDATE = join(process.cwd(), "src/lib/ingestion/validate.ts");
const STRICT_PIPELINE = join(process.cwd(), "src/lib/content-qa/pipeline.ts");

describe("legacy validator is marked + non-authoritative", () => {
  it("validate.ts carries a LEGACY deprecation header", () => {
    const src = readFileSync(VALIDATE, "utf-8");
    expect(src).toMatch(/LEGACY\b/);
    expect(src).toMatch(/Section\s*6/i);
  });

  it("the strict QA pipeline does NOT import the legacy validate module", () => {
    const src = readFileSync(STRICT_PIPELINE, "utf-8");
    expect(src.includes('from "../ingestion/validate"')).toBe(false);
    expect(src.includes('from "@/lib/ingestion/validate"')).toBe(false);
  });

  it("the strict cleanup loop does NOT import the legacy validate module", () => {
    const cleanup = readFileSync(join(process.cwd(), "src/lib/content-qa/cleanup.ts"), "utf-8");
    expect(cleanup.includes('from "../ingestion/validate"')).toBe(false);
    expect(cleanup.includes('from "@/lib/ingestion/validate"')).toBe(false);
  });
});
