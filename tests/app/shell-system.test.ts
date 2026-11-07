/**
 * What the site's shell promises in its stylesheet and its navigation data, pinned
 * where a browser is not needed to check it. e2e/shell.spec.ts measures the same
 * promises in a real page.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { NAV_GROUPS, PRIMARY_NAV } from "@/components/layout/HeaderNav";
import { eyebrowClass } from "@/components/ui/eyebrow";

const css = readFileSync("src/app/globals.css", "utf8");
const header = readFileSync("src/components/layout/Header.tsx", "utf8");

/** The value of a custom property in a block, by the block's opening selector. */
function token(block: string, name: string): string {
  const start = css.indexOf(block);
  expect(start, block).toBeGreaterThanOrEqual(0);
  const match = css.slice(start).match(new RegExp(`${name}:\\s*([^;]+);`));
  expect(match, name).not.toBeNull();
  return match![1];
}

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

type Rgba = [number, number, number, number];

function parse(color: string): Rgba {
  const hex = color.match(/^#(..)(..)(..)$/);
  if (hex) return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16), 1];
  const parts = color
    .match(/rgba?\(([^)]+)\)/)![1]
    .split(",")
    .map(Number);
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

function over(top: Rgba, under: Rgba): Rgba {
  const a = top[3];
  return [
    top[0] * a + under[0] * (1 - a),
    top[1] * a + under[1] * (1 - a),
    top[2] * a + under[2] * (1 - a),
    1,
  ];
}

function contrast(a: Rgba, b: Rgba): number {
  const luminance = ([r, g, b]: Rgba) => {
    const linear = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("the header", () => {
  const remPx = (value: string, rem: number) => {
    const [, rems, px] = value.match(/calc\(([\d.]+)rem \+ ([\d.]+)px\)/)!;
    return Number(rems) * rem + Number(px);
  };

  it("declares its real height: 118px with the tabs at the usual text size", () => {
    expect(remPx(token(":root {", "--header-h"), 16)).toBe(118);
  });

  it("declares what it really is at enlarged text too, since its logo is fixed in pixels", () => {
    // Masthead 60px + 0.75rem, tabs 1.25rem + 1.5rem, two 1px rules.
    expect(remPx(token(":root {", "--header-h"), 20)).toBe(132);
  });

  it("declares the phone bar's height at the same width the bar takes over", () => {
    const phone = css.match(
      /@media not all and \(min-width: ([\d.]+rem)\) \{\s*:root \{\s*--header-h: ([^;]+);/,
    );
    expect(phone).not.toBeNull();
    expect(phone![1]).toBe("56.25rem");
    expect(remPx(phone![2], 16)).toBeCloseTo(64.83, 1);
    expect(css).toContain("@container vf-header (min-width: 56.25rem)");
  });

  it("changes layout by a width in rem, which enlarged text moves, and never in pixels", () => {
    expect(header).toContain("vf-header-bar");
    expect(header).toContain("vf-header-tabs");
    expect(header).not.toMatch(/min-\[\d+px\]/);
    expect(readFileSync("src/components/layout/HeaderMobileMenu.tsx", "utf8")).not.toMatch(
      /min-\[\d+px\]/,
    );
  });

  it("is opaque, so reading text does not ghost through the tabs", () => {
    expect(header).toMatch(/<header className="[^"]*\bbg-paper\b(?!\/)/);
    expect(header).not.toMatch(/backdrop-blur/);
  });
});

describe("the navigation", () => {
  it("reaches Devotions and Novenas, under Prayers", () => {
    const prayers = NAV_GROUPS.find((entry) => entry.href === "/prayers");
    expect(prayers?.kind).toBe("group");
    const hrefs = prayers?.kind === "group" ? prayers.items.map((item) => item.href) : [];
    expect(hrefs).toEqual(expect.arrayContaining(["/litanies", "/devotions", "/novenas"]));
    expect(PRIMARY_NAV.map((item) => item.href)).toEqual(
      expect.arrayContaining(["/devotions", "/novenas"]),
    );
  });

  it.each(["en", "es", "fr", "de", "it", "pt", "pl", "la", "tl", "vi", "ko", "zh"])(
    "has its words written out in %s",
    (locale) => {
      const dictionary = readFileSync(`src/lib/i18n/dictionaries/${locale}.ts`, "utf8");
      for (const key of [
        "nav.devotions",
        "nav.novenas",
        "share.action",
        "share.item",
        "share.copied",
        "share.failed",
      ]) {
        expect(dictionary, key).toContain(`"${key}":`);
      }
      expect(dictionary).toMatch(/"share\.item":\s*"[^"]*\{title\}[^"]*"/);
    },
  );
});

describe("the dark theme", () => {
  it("has no purple left in it, in tokens or rules", () => {
    expect(css).not.toMatch(/accent-purple/);
    expect(css).not.toMatch(/#5b2d8e|#7847a8|#a88bd4/i);
    expect(css).not.toMatch(/91,\s*45,\s*142|168,\s*139,\s*212/);
    expect(css).not.toMatch(/--liturgical-blue-rgb: 91 45 142/);
  });

  it("marks the current tab with the same line colour the light theme's rule names", () => {
    expect(rule('.vf-nav-link-active,\n  .vf-nav-link[aria-current="page"]')).toContain(
      "text-decoration-color: var(--link)",
    );
    const dark = css.slice(css.indexOf('html[data-theme="dark"] .vf-nav-link-active,'));
    expect(dark.slice(0, 200)).not.toContain("text-decoration-color");
  });
});

describe("text field boundaries", () => {
  const paper = parse(token(":root {", "--paper"));
  const lightEdge = parse(token(":root {", "--rule-control"));
  const lightField = over([255, 255, 255, 0.85], paper);

  it("hold 3:1 against the paper and the field in the light theme", () => {
    const edge = over(lightEdge, lightField);
    expect(contrast(edge, paper)).toBeGreaterThanOrEqual(3);
    expect(contrast(edge, lightField)).toBeGreaterThanOrEqual(3);
  });

  it("hold 3:1 against every charcoal surface a field stands on in the dark theme", () => {
    const edgeColor = parse(token('html[data-theme="dark"] {', "--rule-control"));
    for (const surface of ["#2e2e2e", "#343434", "#363636", "#3a3a3a"]) {
      const under = parse(surface);
      const field = over([0, 0, 0, 0.22], under);
      const edge = over(edgeColor, field);
      expect(contrast(edge, under), surface).toBeGreaterThanOrEqual(3);
      expect(contrast(edge, field), surface).toBeGreaterThanOrEqual(3);
    }
  });

  it("grow stronger under the pointer, never fainter", () => {
    const alpha = (color: string) => parse(color)[3];
    const hover = rule(".vf-input:hover").match(/border-color: ([^;]+);/)![1];
    expect(alpha(hover)).toBeGreaterThan(lightEdge[3]);
    const darkHover = css
      .slice(css.lastIndexOf('html[data-theme="dark"] .vf-input:hover'))
      .match(/border-color: ([^;]+);/)![1];
    expect(alpha(darkHover)).toBeGreaterThan(
      parse(token('html[data-theme="dark"] {', "--rule-control"))[3],
    );
  });

  it("leave no outlined button fainter under the pointer in the dark theme", () => {
    const hover = rule('html[data-theme="dark"] .vf-btn-ghost:hover:not(:disabled)');
    expect(hover).toContain("border-color: var(--ink)");
    expect(hover).not.toContain("--border-hover");
  });

  it("include the header search's, which has no other edge", () => {
    expect(rule(".vf-header-search")).toContain("border-bottom: 1px solid var(--rule-control)");
    expect(css).not.toMatch(/html\[data-theme="dark"\] \.vf-header-search \{/);
  });
});

describe("type", () => {
  it("sets full-height figures once, on the body, and for form controls", () => {
    expect(css).toMatch(/body \{\s*font-variant-numeric: lining-nums;/);
    expect(css).toMatch(/textarea \{\s*font-variant-numeric: inherit;/);
  });

  it("keeps a card's action at supporting size, 14px or more", () => {
    const size = rule(".vf-entry-action").match(/font-size: ([\d.]+)rem/);
    expect(Number(size![1])).toBeGreaterThanOrEqual(0.875);
  });

  it("does not space its labels and buttons widely", () => {
    const tracking = (selector: string) =>
      Number(rule(selector).match(/letter-spacing: ([\d.]+)em/)![1]);
    expect(tracking(".vf-eyebrow")).toBeLessThanOrEqual(0.08);
    expect(tracking(".vf-btn")).toBeLessThanOrEqual(0.06);
    expect(tracking(".vf-mobile-menu-link")).toBeLessThanOrEqual(0.08);
  });

  it("keeps spaced capitals for short labels, and sentence type for phrases", () => {
    expect(eyebrowClass("The Magisterium")).toBe("vf-eyebrow");
    expect(eyebrowClass("How to pray & practice")).toBe("vf-eyebrow");
    expect(eyebrowClass("Sacrament at the Service of Communion")).toContain("vf-eyebrow-long");
    expect(eyebrowClass("Title of the Blessed Virgin Mary")).toContain("vf-eyebrow-long");
    expect(rule(".vf-eyebrow-long")).toContain("text-transform: none");
  });
});

describe("a filter's open panel", () => {
  it("is sized from the window, leaving room for the header and its trigger", () => {
    const panel = rule(".vf-filter-panel");
    expect(panel).toMatch(/max-height:[^;]*100dvh/);
    expect(panel).toMatch(/max-height:[^;]*var\(--header-h\)/);
  });

  it("has no floor taller than the room a short window has at enlarged text", () => {
    const panel = rule(".vf-filter-panel");
    expect(panel).toMatch(/max\(\s*min\(11rem,\s*calc\(100dvh - var\(--header-h\) - \d/);
  });
});

describe("what forced colours leave of a chosen row or control", () => {
  const start = css.indexOf("Forced colours take the fill and the edge away");
  const block = css.slice(start, css.indexOf("}", css.indexOf("@media (forced-colors", start)));

  it("is drawn in the system's own selected colours, wherever selection is a fill", () => {
    expect(start).toBeGreaterThanOrEqual(0);
    for (const selector of [
      ".vf-menu-item[aria-current]",
      ".vf-menu-item-active",
      ".vf-mobile-menu-link[aria-current]",
      ".vf-filter-active",
      '.vf-btn-ghost[aria-pressed="true"]',
    ]) {
      expect(block).toContain(selector);
    }
    expect(block).toMatch(/background: Highlight/);
    expect(block).toMatch(/color: HighlightText/);
  });

  it("opts out of the plate the browser paints behind words, or they could not be read", () => {
    expect(block).toContain("forced-color-adjust: none");
  });
});
