/**
 * What keeps the calendar's two fields readable, and the words of a line of facts apart
 * for a voice, is in the stylesheet, where jsdom cannot see it working.
 * e2e/liturgical-today.spec.ts measures it in a browser; this holds the rules themselves
 * in the ordinary test run.
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

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The chevron's colour, read out of the rule's inline image. */
function chevron(selector: string): string {
  const stroke = rule(selector).match(/stroke='%23([0-9a-f]{3,6})'/i)?.[1];
  expect(stroke, selector).toBeTruthy();
  const hex = stroke!.length === 3 ? [...stroke!].map((c) => c + c).join("") : stroke!;
  return `#${hex}`;
}

describe("words for a voice alone, inside a line", () => {
  it("stay in the line, or Safari's accessibility tree takes them out of it", () => {
    const voice = rule(".vf-sr-inline");
    expect(voice).not.toMatch(/position:|display:|float:/);
    // Nothing to see, nothing added to the line's height, and left out of a copy.
    expect(voice).toMatch(/opacity: 0/);
    expect(voice).toMatch(/line-height: 0/);
    expect(voice).toMatch(/user-select: none/);
  });

  it("keep a size, since a screen reader may pass over text with none", () => {
    expect(rule(".vf-sr-inline")).toMatch(/font-size: 1px/);
  });
});

describe("the calendar's date and rite fields", () => {
  it("stack by the text's size, not by the window's", () => {
    expect(rule(".vf-calendar-controls")).toMatch(
      /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 14rem\), 1fr\)\)/,
    );
    // A media query does not move when only the root font size changes.
    expect(css).not.toMatch(/@media[^{]*\{\s*\.vf-calendar-controls \{/);
  });

  it("let the type stop growing where the longest rite would no longer fit a phone", () => {
    expect(rule(".vf-calendar-controls .vf-input")).toMatch(/font-size: min\(1rem, 7\.4vw\)/);
  });
});

describe("the rite field's chevron, the only sign that it opens", () => {
  it("holds 3:1 on the field in both themes", () => {
    // The dark field as painted, and the light field at its darkest.
    expect(
      contrast(chevron('html[data-theme="dark"] .vf-calendar-controls select.vf-input'), "#2c2c2c"),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(chevron(".vf-calendar-controls select.vf-input"), "#f4efe6"),
    ).toBeGreaterThanOrEqual(3);
  });
});
