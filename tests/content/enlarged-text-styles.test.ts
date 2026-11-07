/**
 * What keeps guides, novenas and their prayers readable at 200% text on a phone is
 * in the stylesheet, where jsdom cannot see it working. e2e/guide-reading.spec.ts
 * measures it in a browser; this holds the rules themselves in the ordinary test run,
 * so that a value put back to a plain rem fails here first.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** The declarations of the first rule for exactly this selector. */
function rule(selector: string): string {
  const at = css.indexOf(`\n  ${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}

describe("a disclosure on a narrow screen", () => {
  it("does not let its side padding grow with the text", () => {
    expect(rule(".vf-disclosure-body")).toMatch(/padding: [^;]*min\(1\.125rem, 5vw\)/);
    expect(rule(".vf-disclosure-trigger")).toMatch(/padding: [^;]*min\(1\.125rem, 5vw\)/);
    expect(rule(".vf-disclosure-trigger")).toMatch(/gap: min\(1rem, 4vw\)/);
    expect(rule(".vf-inline-prayer-head")).toMatch(/padding: [^;]*min\(1\.125rem, 5vw\)/);
  });
});

describe("a line of prayer on a narrow screen", () => {
  it("hangs by what the width can spare, the indent and its padding the same", () => {
    const line = rule(".vf-prayer-line");
    expect(line).toMatch(/padding-left: min\(1\.25em, 7vw\)/);
    expect(line).toMatch(/text-indent: calc\(-1 \* min\(1\.25em, 7vw\)\)/);
  });

  it("gives a marked line's margin no more than the width can spare, with its marker to fit", () => {
    expect(rule(".vf-prayer")).toMatch(/--vf-prayer-hang: min\(2\.125rem, 11vw\)/);
    expect(rule(".vf-prayer-marker")).toMatch(/font-size: min\(0\.8125rem, 5vw\)/);
  });

  // "Ant. " is 2.24 of its own em, and the margin 2.2 of them: the marker may outgrow it
  // by a hair, and the words after it move over rather than run into it.
  it("lets a marker wider than the margin push its line along", () => {
    const marker = rule(".vf-prayer-marker");
    expect(marker).toMatch(/min-width: var\(--vf-prayer-hang\)/);
    expect(marker).not.toMatch(/(?:^|\s)width:/);
  });

  it("keeps a prayer's chevron and the punctuation after it on one line, not underlined", () => {
    const end = rule(".vf-inline-prayer-end");
    expect(end).toMatch(/display: inline-block/);
    expect(end).toMatch(/white-space: nowrap/);
    expect(rule(".vf-inline-prayer-mark")).toMatch(/display: inline-block/);
  });
});

describe("words set apart to be said", () => {
  it("do not let their indent grow with the text on a narrow screen", () => {
    expect(rule(".vf-spoken")).toMatch(/padding-left: min\(1rem, 5vw\)/);
  });
});

describe("a sequence inside a step", () => {
  it("sets its own numbers at full height, which a list marker does not inherit", () => {
    expect(rule(".vf-substeps > li::marker")).toMatch(/font-variant-numeric: lining-nums/);
  });

  it("does not let its margin, or the numbers in it, grow with the text on a narrow screen", () => {
    expect(rule(".vf-reading ol.vf-substeps")).toMatch(/padding-left: min\(1\.5em, 9vw\)/);
    expect(rule(".vf-substeps > li::marker")).toMatch(/font-size: min\(1em, 6vw\)/);
  });
});

describe("the Rosary's mystery picker", () => {
  it("asks its column, in rem, how many sets go across, and never three", () => {
    expect(css).toMatch(/\.vf-mysteries \{\s*container-type: inline-size;/);
    expect(rule(".vf-mysteries-picker")).toMatch(/grid-template-columns: minmax\(0, 1fr\)/);
    const two =
      /@container \(min-width: 11rem\) \{\s*\.vf-mysteries-picker \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/;
    const four =
      /@container \(min-width: 30rem\) \{\s*\.vf-mysteries-picker \{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/;
    expect(css).toMatch(two);
    expect(css).toMatch(four);
    expect(css).not.toMatch(/\.vf-mysteries-picker \{[^}]*repeat\(3/);
  });
});
