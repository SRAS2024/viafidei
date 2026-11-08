/**
 * What the second independent check of the visual system found, held in the rules
 * themselves, where jsdom cannot see them working. e2e/visual-system.spec.ts measures
 * the same things in a browser; this fails first in the ordinary test run when a value
 * goes back.
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

/** The vw cap of a rule's type: min(<rem>, <cap>vw). */
function cap(selector: string): number {
  const found = /font-size: min\([^,]+, ([\d.]+)vw\);/.exec(rule(selector))?.[1];
  expect(found, selector).toBeDefined();
  return Number(found);
}

describe("the homepage's way into the day's readings", () => {
  // From 980 to 1039 wide the three equal parts left the button 251-266px, and
  // "Read today's Mass readings" wrapped to two lines at 53px.
  it("keeps the readings part wide enough for its button's label on one line", () => {
    expect(css).toMatch(
      /@container vf-home \(min-width: 58rem\) \{\s*\.vf-home-today \{\s*grid-template-columns: minmax\(19\.75rem, 1fr\) repeat\(2, minmax\(0, 1fr\)\);/,
    );
  });
});

describe("a field marked invalid", () => {
  // The error edge stayed and the outline was none: two pink fields looked the same
  // with and without focus.
  it("shows the site's focus ring when it has focus, outside its error edge", () => {
    const focused = rule('.vf-input[aria-invalid="true"]:focus');
    expect(focused).toMatch(/outline: 2px solid var\(--focus-ring\)/);
    expect(focused).toMatch(/outline-offset: 2px/);
  });
});

describe("a chosen control in the dark theme", () => {
  // The #4a6fc4 fill alone is 2.7:1 against the page.
  it("takes the light edge the menu rows have, at rest and under the pointer", () => {
    const at = css.indexOf('html[data-theme="dark"]\n    :is(\n      .vf-filter-active,');
    expect(at).toBeGreaterThan(-1);
    const block = css.slice(at, css.indexOf("}", at));
    for (const selector of [
      '.vf-btn-ghost[aria-pressed="true"]',
      '.vf-btn-ghost[aria-current="true"]',
      '.vf-btn-ghost[aria-current="page"]',
    ]) {
      expect(block).toContain(selector);
    }
    expect(block).toContain("):hover:not(:disabled) {");
    expect(block).toMatch(/border-color: var\(--link\);$/m);
  });

  it("draws an open or landed-on timeline row's marker in the slider's light blue", () => {
    const marker = rule(
      ".vf-timeline-event[open] > .vf-timeline-summary::before,\n  .vf-timeline-current::before",
    );
    expect(marker).toMatch(/background: var\(--slider-fill, var\(--accent-fill\)\)/);
    expect(marker).toMatch(/border-color: var\(--slider-fill, var\(--accent-fill\)\)/);
  });
});

describe("buttons in one row", () => {
  // 4.6vw and 5vw left Get directions at 17px beside Share at 28px, at 200% on a phone.
  it("share one label size: Get directions and Use my location have no cap of their own", () => {
    expect(rule(".vf-entry-action > .vf-btn,\n  .vf-detail-actions > .vf-btn")).not.toMatch(
      /font-size/,
    );
    expect(rule(".vf-locator-actions > .vf-btn")).not.toMatch(/font-size/);
  });

  it("set the Show password toggle at the 14px of every other control", () => {
    expect(rule(".vf-field-toggle")).not.toMatch(/font-size/);
    expect(rule(".vf-link-action")).toMatch(/font-size: 0\.875rem/);
  });
});

describe("a heading over its text, on a phone with enlarged text", () => {
  // At 375 with 200% text an event's title was 36.4px over 37.5px of text, and card,
  // step and novena-day titles were the same size as the text under them.
  it("caps the text a step below its heading, so the heading always leads", () => {
    expect(cap(".vf-timeline-body")).toBeLessThan(cap(".vf-timeline-title"));
    expect(cap(".vf-entry-summary")).toBeLessThan(cap(".vf-entry-title"));
    expect(rule(".vf-step-title + .vf-step-body.vf-reading")).toMatch(
      /font-size: min\(var\(--fs-body\), 9vw\)/,
    );
    // Only a guide's reading text: a rosary mystery's facts keep their smaller size.
    expect(css).not.toContain("\n  .vf-step-title + .vf-step-body {");
    expect(rule(".vf-mystery-facts")).toMatch(/font-size: var\(--fs-note\)/);
    expect(cap(".vf-step-title")).toBeGreaterThan(9);
    expect(rule(".vf-disclosure-body")).toMatch(/font-size: min\(var\(--fs-prayer\), 9vw\)/);
    expect(rule(".vf-disclosure-body .vf-prayer")).toMatch(
      /font-size: min\(var\(--fs-prayer\), 9vw\)/,
    );
    expect(cap(".vf-disclosure-title")).toBeGreaterThan(9);
  });
});

describe("a fact's label", () => {
  // The day's German labels ("Wochentagslesejahr") pushed the homepage 78px sideways
  // at 300% text on a 375 phone.
  it("is capped by the width, and a word longer than the line wraps rather than runs off", () => {
    const label = rule(".vf-facts dt");
    expect(label).toMatch(/font-size: min\(0\.875rem, 7\.5vw\)/);
    expect(label).toMatch(/overflow-wrap: break-word/);
  });
});

describe("a centred lede on an account form", () => {
  // Pretty wrapping left "reset link." alone under a full line on /forgot-password.
  it("is balanced, like the heroes' ledes", () => {
    expect(rule(".vf-account-lede")).toMatch(/text-wrap: balance/);
  });
});

describe("the church history year readout at 320 wide and 300% text", () => {
  // "Enlightenment" at 1rem (48px) was 281px in a 238px box, and the page scrolled sideways.
  it("caps the era name so its longest word fits, and breaks a word only as a last resort", () => {
    expect(rule(".vf-history-readout")).toMatch(/overflow-wrap: break-word/);
    expect(css).toMatch(
      /@container history-panel \(max-width: 21rem\) \{[^@]*?\.vf-history-readout \{\s*font-size: min\(1rem, 12\.5vw\);/,
    );
  });
});

describe("the church history slider's year labels at 320 wide and 300% text", () => {
  // 0.875rem (42px) ran "1000" into "2026" under the track.
  it("are capped to the viewport, with no change at 200% text or less", () => {
    expect(cap(".vf-history-anchor")).toBe(9);
  });
});

describe("the church history pager at 320 wide", () => {
  // Seven 36px chips needed about 312px of 288, and Next wrapped onto a row alone.
  it("takes the smaller chips from 20rem down", () => {
    expect(css).toMatch(
      /@container history-list \(max-width: 20rem\) \{\s*\.vf-history-pager \.vf-chip \{\s*min-width: 1\.875rem;\s*\}\s*\.vf-history-pager a:not\(\[rel\]\) \{\s*padding-inline: 0\.25rem;/,
    );
  });
});
