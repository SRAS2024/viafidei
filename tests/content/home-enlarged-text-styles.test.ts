/**
 * What keeps words whole and on the screen at 200% text on a phone, and headings larger
 * than what stands under them, is in the stylesheet, where jsdom cannot see it working.
 * e2e/home-enlarged-text.spec.ts, e2e/enlarged-text-order.spec.ts and e2e/not-found.spec.ts
 * measure it in a browser; this holds the rules themselves in the ordinary test run, so
 * that a value put back to a plain rem fails here first.
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

/** How wide a rule's type may get, in vw, whatever the reader's text size. */
function ruleCap(selector: string): number {
  const cap = /font-size: min\(.*, ([\d.]+)vw\);/.exec(rule(selector))?.[1];
  expect(cap, selector).toBeDefined();
  return Number(cap);
}

/** The same for a size token on :root. */
function tokenCap(token: string): number {
  const cap = new RegExp(`\\n\\s+${token}: min\\(.*, ([\\d.]+)vw\\);`).exec(css)?.[1];
  expect(cap, token).toBeDefined();
  return Number(cap);
}

describe("the homepage on a narrow screen", () => {
  it.each([".vf-home-begin-intro", ".vf-home-begin-links", ".vf-home-part", ".vf-home-panel"])(
    "%s does not let its side padding grow with the text",
    (selector) => {
      expect(rule(selector)).toMatch(/padding: [^;]*min\(1\.375rem, 6vw\)/);
    },
  );

  it("caps a section's title by what the width can spare", () => {
    expect(rule(".vf-section-title")).toMatch(/font-size: min\(var\(--fs-section\), 10\.5vw\)/);
    expect(rule(".vf-section-title")).toMatch(/overflow-wrap: break-word/);
  });

  it("caps a link row's type and its gap to the arrow by what the width can spare", () => {
    expect(rule(".vf-link-row")).toMatch(/gap: min\(1rem, 3vw\)/);
    expect(rule(".vf-link-row")).toMatch(/font-size: min\(1\.3125rem, 9\.5vw\)/);
    expect(rule(".vf-link-rows--compact .vf-link-row")).toMatch(
      /font-size: min\(1\.1875rem, 8\.5vw\)/,
    );
  });

  // "apprendre," and "Pananampalataya" ran off the screen at 200% text.
  it("caps the hero's title and tagline for the longest word any language has there", () => {
    expect(rule(".vf-home-title")).toMatch(/font-size: min\(var\(--fs-display\), 18\.5vw\)/);
    expect(rule(".vf-home-title")).toMatch(/overflow-wrap: break-word/);
    expect(ruleCap(".vf-home-tagline")).toBe(13);
    expect(rule(".vf-home-tagline")).toMatch(/overflow-wrap: break-word/);
  });
});

describe("the type scale at 200% text on a phone", () => {
  // Each cap below the one before: a cap on one step alone left a section title smaller
  // than the subsection headings under it, and a page title smaller than its sections.
  it("steps down as the sizes do, from a page title to the text it heads", () => {
    const page = ruleCap(".vf-detail-title");
    expect(ruleCap(".vf-page-hero-title")).toBe(page);
    const section = ruleCap(".vf-section-title");
    const subsection = tokenCap("--fs-subsection");
    expect(page).toBeGreaterThan(section);
    expect(section).toBeGreaterThan(subsection);
    for (const below of [
      ruleCap(".vf-subhead-sm"),
      ruleCap(".vf-step-title"),
      tokenCap("--fs-lede"),
      tokenCap("--fs-body"),
      tokenCap("--fs-prayer"),
    ]) {
      expect(subsection).toBeGreaterThan(below);
      expect(below).toBeGreaterThanOrEqual(tokenCap("--fs-body"));
    }
    expect(tokenCap("--fs-body")).toBeGreaterThan(tokenCap("--fs-note"));
  });

  it("sizes a subsection heading from the capped token, and a step no larger than its head", () => {
    expect(rule(".vf-subhead")).toMatch(/font-size: var\(--fs-subsection\)/);
    expect(rule(".vf-subhead-sm")).toMatch(/font-size: min\(1\.375rem, 10vw\)/);
    expect(rule(".vf-step-title")).toMatch(/font-size: min\(1\.375rem, 10vw\)/);
  });
});

describe("a button, at text far larger than it was set for", () => {
  // "Spiritual Life" on the homepage pushed the page sideways at 300% on a phone. Then a
  // rule that broke words anywhere split CREATE ACCOUNT into ACCOU / NT and CLEAR SEARCH
  // into SEARC / H, where the word stood whole inside the button with the padding given up.
  it("stays within what holds it, and never breaks a word, whatever it sits in", () => {
    const button = rule(".vf-btn");
    expect(button).toMatch(/max-width: 100%/);
    // Said, not left to inherit: /search's list of results breaks its words anywhere.
    expect(button).toMatch(/overflow-wrap: normal/);
    for (const selector of [
      ".vf-btn-sm",
      ".vf-entry-action > .vf-btn,\n  .vf-detail-actions > .vf-btn",
      ".vf-locator-actions > .vf-btn",
      ".vf-message > .vf-btn",
    ]) {
      expect(rule(selector), selector).not.toMatch(/overflow-wrap|word-break: break-all/);
    }
  });

  it("gives way in its padding and type first, and changes nothing from 320 wide at 100%", () => {
    const button = rule(".vf-btn");
    // 6.25vw of 320 is 20px, which is 1.25rem. 9vw of 320 is far above 14px.
    expect(button).toMatch(/padding: 0\.5rem min\(1\.25rem, 6\.25vw\)/);
    expect(button).toMatch(/font-size: min\(0\.875rem, 9vw\)/);
    // 4.4vw of 320 is 14.08px, just above the 0.875rem it was.
    expect(rule(".vf-btn-sm")).toMatch(/padding: 0\.375rem min\(0\.875rem, 4\.4vw\)/);
  });

  it("has room in a dialog: the dialog's padding gives way too, and nothing moves at 320", () => {
    // 5vw of 320 is 16px, which is 1rem; 7.5vw of 320 is 24px, which is 1.5rem.
    expect(rule(".vf-modal-backdrop")).toMatch(/padding: min\(1rem, 5vw\)/);
    expect(css).toMatch(/\.vf-modal \{[^}]*padding: 1\.5rem min\(1\.5rem, 7\.5vw\);/);
    expect(css).toMatch(/\.vf-modal \{[^}]*max-height: calc\(100dvh - 2 \* min\(1rem, 5vw\)\);/);
  });
});

describe("supporting text on a control", () => {
  it("is at least 14px, the same on a small button as on any other", () => {
    expect(rule(".vf-btn")).toMatch(/font-size: min\(0\.875rem, 9vw\)/);
    expect(rule(".vf-btn-sm")).not.toMatch(/font-size/);
    // Caps of their own at 4.6vw and 5vw left Get directions and Use my location at
    // 17px beside Share, Search and Filter at 28px with 200% text on a phone.
    expect(rule(".vf-entry-action > .vf-btn,\n  .vf-detail-actions > .vf-btn")).not.toMatch(
      /font-size/,
    );
    expect(rule(".vf-locator-actions > .vf-btn")).not.toMatch(/font-size/);
    expect(rule(".vf-chip-count")).toMatch(/font-size: 0\.875rem/);
  });
});

describe("an empty list's way back", () => {
  // "Suche zurücksetzen" and "All of Apostolic Age" did not fit inside 1.5rem of padding
  // either side at 200% and 250% text on a phone, and their words were broken.
  it("has the room to keep its words whole, and nothing moves from 320 wide at 100%", () => {
    expect(rule(".vf-timeline-empty")).toMatch(/padding: 2rem min\(1\.5rem, 5vw\)/);
    expect(readFileSync(join(process.cwd(), "src/components/ui/ListSearch.tsx"), "utf8")).toMatch(
      /"vf-card rounded-sm px-\[min\(1\.5rem,5vw\)\] py-8/,
    );
  });
});

describe("an account page's title", () => {
  // "Connexion" pushed /login sideways at 300% text on a phone.
  it("is capped by the width as a section title is", () => {
    expect(rule(".vf-account-title")).toMatch(/font-size: min\(var\(--fs-section\), 10\.5vw\)/);
  });
});

describe("a not-found page's way back", () => {
  // "Kirchenlehrern" and "przewodników" pushed the page sideways at 200% text.
  it("does not let its padding or type outgrow a narrow screen", () => {
    const button = rule(".vf-message > .vf-btn");
    expect(button).toMatch(/max-width: 100%/);
    expect(button).toMatch(/padding-inline: min\(1\.25rem, 6\.25vw\)/);
    expect(button).toMatch(/font-size: min\(0\.875rem, 6\.5vw\)/);
    // Hangul only: keep-all lets Safari break "l'Église" after its apostrophe.
    expect(button).not.toMatch(/word-break/);
    expect(rule(".vf-message > .vf-btn:lang(ko)")).toMatch(/word-break: keep-all/);
  });
});
