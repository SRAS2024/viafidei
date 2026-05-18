/**
 * Spec-pin test for source-document cleanup.
 *
 * The spec lists exactly the noise categories source cleanup must
 * strip from a raw page body:
 *
 *   * Navigation
 *   * Footers
 *   * Donation blocks
 *   * Newsletter forms
 *   * Social share blocks
 *   * Livestream widgets
 *   * Video embeds
 *   * Related article blocks
 *   * Cookie banners
 *   * Ads
 *   * Sidebar clutter
 *   * Event cards (UNLESS the package is an approved Church history)
 *
 * Each test passes a representative noise line through
 * `cleanSourceBody` and asserts the line was removed AND its category
 * was reported. A future regex regression on any single category
 * fails this test.
 */

import { describe, expect, it } from "vitest";
import { cleanSourceBody } from "@/lib/content-factory/source-document";

function cleanAndAssertRemoved(line: string, expectedKind: string): void {
  const body = `${line}\nThis is the real article body.`;
  const result = cleanSourceBody(body, {});
  expect(result.cleaned).not.toContain(line);
  expect(result.cleaned).toContain("real article body");
  const kinds = new Set(result.removed.map((r) => r.kind));
  expect(kinds.has(expectedKind)).toBe(true);
}

describe("cleanSourceBody strips every spec-required noise category", () => {
  it("Navigation: 'Skip to main content'", () => {
    cleanAndAssertRemoved("Skip to main content", "navigation");
  });

  it("Footer: '© 2026 All rights reserved'", () => {
    cleanAndAssertRemoved("© 2026 All rights reserved", "footer");
  });

  it("Donation block: 'Donate now'", () => {
    cleanAndAssertRemoved("Donate now", "donation");
  });

  it("Newsletter form: 'Subscribe to our newsletter'", () => {
    cleanAndAssertRemoved("Subscribe to our newsletter", "newsletter");
  });

  it("Share block: 'Share this'", () => {
    cleanAndAssertRemoved("Share this", "share");
  });

  it("Livestream widget: 'Watch live'", () => {
    cleanAndAssertRemoved("Watch live tonight at 7", "livestream");
  });

  it("Video embed: 'Watch video'", () => {
    cleanAndAssertRemoved("Watch video below", "video");
  });

  it("Related articles: 'Related articles'", () => {
    cleanAndAssertRemoved("Related articles section", "related");
  });

  it("Cookie banner: 'cookie policy'", () => {
    cleanAndAssertRemoved("This site uses cookie preferences to track you", "cookie");
  });

  it("Ad: 'Advertisement'", () => {
    cleanAndAssertRemoved("Advertisement: Buy now", "ad");
  });

  it("Sidebar clutter: 'Recent posts'", () => {
    cleanAndAssertRemoved("Recent posts", "sidebar");
  });
});

describe("Event card handling — spec carve-out for Church history packages", () => {
  it("strips event-card lines from a non-history page (allowEventCards=false)", () => {
    const body = "Join us for this special event\nThis is the real article body.";
    const result = cleanSourceBody(body, {});
    expect(result.cleaned).not.toContain("Join us for this");
    expect(result.cleaned).toContain("real article body");
    expect(result.removed.some((r) => r.kind === "event_card")).toBe(true);
  });

  it("keeps event-card lines when the caller opts in via allowEventCards=true (history-package carve-out)", () => {
    const body = "Event listing: Second Vatican Council\nKey outcomes of the council.";
    const result = cleanSourceBody(body, { allowEventCards: true });
    // Spec carve-out: history pages legitimately list historical events,
    // so the caller may opt out of the event-card strip in that context.
    expect(result.cleaned).toContain("Event listing");
    expect(result.cleaned).toContain("Vatican Council");
    expect(result.removed.some((r) => r.kind === "event_card")).toBe(false);
  });
});

describe("cleanSourceBody preserves real article content", () => {
  it("does not strip an actual prayer body", () => {
    const body = [
      "Skip to main content",
      "Hail Mary, full of grace, the Lord is with thee.",
      "Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus.",
      "Holy Mary, Mother of God, pray for us sinners.",
      "Donate now",
    ].join("\n");
    const result = cleanSourceBody(body, {});
    expect(result.cleaned).toContain("Hail Mary");
    expect(result.cleaned).toContain("Holy Mary");
    expect(result.cleaned).not.toContain("Skip to main content");
    expect(result.cleaned).not.toContain("Donate now");
  });
});

describe("removed lines are categorised (provenance for the strip decision)", () => {
  it("every removed entry has a kind + the offending text", () => {
    const body = [
      "Skip to main content",
      "© 2026 All rights reserved",
      "Subscribe to our newsletter",
      "This is the article body.",
    ].join("\n");
    const result = cleanSourceBody(body, {});
    expect(result.removed.length).toBeGreaterThan(0);
    for (const r of result.removed) {
      expect(typeof r.kind).toBe("string");
      expect(r.kind.length).toBeGreaterThan(0);
      expect(typeof r.text).toBe("string");
      expect(r.text.length).toBeGreaterThan(0);
    }
  });
});
