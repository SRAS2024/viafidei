/**
 * The booster scripts write to the production database, so their flags are
 * strict (scripts/booster/cli-args.ts). Pinned: `--apply=false`, `--apply=0`
 * and a bare `apply` never turn --apply on; unknown, repeated and value-less
 * flags are usage errors; numbers are whole and at least their floor, so a
 * `--limit=0` or `--batch=0` can no longer send the sweep round the same page.
 */
import { describe, expect, it } from "vitest";

import { parseBoosterFlags, wholeNumberFlag } from "../../scripts/booster/cli-args";

const CLEANUP = {
  switches: ["apply", "unpublish-suspects"],
  values: ["only", "audit-limit", "report"],
};

describe("booster flags", () => {
  it("reads switches and values", () => {
    const parsed = parseBoosterFlags(
      ["--apply", "--only=orthodox,restatus", "--report=/tmp/r.json"],
      CLEANUP,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.flags.get("apply")).toBe(true);
    expect(parsed.flags.get("only")).toBe("orthodox,restatus");
    expect(parsed.flags.get("report")).toBe("/tmp/r.json");
    expect(parsed.flags.has("unpublish-suspects")).toBe(false);
  });

  it.each([["--apply=false"], ["--apply=0"], ["--apply="]])("never reads %s as --apply", (arg) => {
    const parsed = parseBoosterFlags([arg], CLEANUP);
    expect(parsed).toEqual({ ok: false, error: "--apply takes no value" });
  });

  it.each([
    [["apply"], /not an option/],
    [["-apply"], /not an option/],
    [["--unpublish-suspect"], /unknown option --unpublish-suspect/],
    [["--only"], /--only needs a value/],
    [["--only="], /--only needs a value/],
    [["--apply", "--apply"], /given twice/],
  ])("refuses %j", (args, error) => {
    const parsed = parseBoosterFlags(args, CLEANUP);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(error);
  });

  it("checks whole numbers against their floor", () => {
    const parsed = parseBoosterFlags(["--limit=0", "--batch=200", "--spacing-ms=0"], {
      switches: [],
      values: ["limit", "batch", "spacing-ms", "max-pages"],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(wholeNumberFlag(parsed.flags, "limit", 1).error).toMatch(/at least 1/);
    expect(wholeNumberFlag(parsed.flags, "batch", 1)).toEqual({ value: 200 });
    expect(wholeNumberFlag(parsed.flags, "spacing-ms", 0)).toEqual({ value: 0 });
    expect(wholeNumberFlag(parsed.flags, "max-pages", 1)).toEqual({});
    for (const raw of ["1.5", "-3", "ten", "1e3"]) {
      const p = parseBoosterFlags([`--limit=${raw}`], { switches: [], values: ["limit"] });
      expect(p.ok && wholeNumberFlag(p.flags, "limit", 1).error).toMatch(/whole number/);
    }
  });
});
