/**
 * Prayer text normalizer tests (spec §6).
 *
 * The normalizer strips noise that wraps real-world prayer bodies
 * so the cross-source validator can compare the actual prayer text.
 * Pinning:
 *   - intro and closing lines are removed
 *   - repeated title lines collapse to one
 *   - footer host lines disappear
 *   - "Amen!!" collapses to "Amen."
 *   - the stripped list surfaces every removed line
 */

import { describe, expect, it } from "vitest";
import {
  looksLikeArticleAbout,
  normalizePrayerText,
} from "@/lib/content-factory/normalize/prayer-text";

describe("normalizePrayerText()", () => {
  it("strips intro lines before the body", () => {
    const raw = `Below is the prayer:
Our Father, who art in heaven, hallowed be thy name.`;
    const result = normalizePrayerText(raw);
    expect(result.text).toBe("Our Father, who art in heaven, hallowed be thy name.");
    expect(result.stripped).toContain("Below is the prayer:");
  });

  it("strips closing source / copyright lines", () => {
    const raw = `Hail Mary, full of grace, the Lord is with thee. Amen.
Imprimatur: Bishop John Doe, 1965
© 2024 EWTN
All rights reserved.`;
    const result = normalizePrayerText(raw);
    expect(result.text).toContain("Hail Mary");
    expect(result.text).not.toContain("Imprimatur");
    expect(result.text).not.toContain("All rights reserved");
    expect(result.stripped.length).toBeGreaterThanOrEqual(3);
  });

  it("removes repeated title lines (e.g. Hail Mary\\nHail Mary)", () => {
    const raw = `Hail Mary
Hail Mary
Hail Mary, full of grace, the Lord is with thee.`;
    const result = normalizePrayerText(raw, { titleHint: "Hail Mary" });
    // First title kept, subsequent dupes stripped.
    expect(result.text.match(/^Hail Mary$/gm)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(result.text).toContain("full of grace");
  });

  it("removes source footer lines that reference a known host", () => {
    const raw = `Glory be to the Father, and to the Son, and to the Holy Spirit. Amen.
Read more at https://www.ewtn.com/prayer-life
Visit vatican.va for more.`;
    const result = normalizePrayerText(raw);
    expect(result.text).not.toMatch(/ewtn/i);
    expect(result.text).not.toMatch(/vatican\.va/i);
  });

  it('collapses "Amen!!" to "Amen."', () => {
    const result = normalizePrayerText("Hail Mary, full of grace. Amen!!");
    expect(result.text.endsWith("Amen.")).toBe(true);
  });

  it("collapses runs of paragraph breaks to a single \\n\\n", () => {
    const raw = "Our Father.\n\n\n\n\nWho art in heaven.";
    const result = normalizePrayerText(raw);
    expect(result.text).toBe("Our Father.\n\nWho art in heaven.");
  });
});

describe("looksLikeArticleAbout()", () => {
  it("detects an article *about* a prayer (vs. the prayer body)", () => {
    const text = `According to scholars, the Hail Mary developed over many centuries.
As theologian John Smith explains in his book, the prayer comes from two passages in Luke.
Click here to subscribe to our newsletter.`;
    expect(looksLikeArticleAbout(text)).toBe(true);
  });

  it("returns false for an actual prayer body", () => {
    const text = "Our Father, who art in heaven, hallowed be thy name. Thy kingdom come. Amen.";
    expect(looksLikeArticleAbout(text)).toBe(false);
  });
});
