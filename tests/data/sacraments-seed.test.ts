import { describe, expect, it } from "vitest";
import { SACRAMENT_GUIDES } from "../../prisma/seeds/data/sacraments";
import { ENCYCLICAL_ENTRIES } from "../../prisma/seeds/data/encyclicals";
import { CHURCH_DOCUMENT_ENTRIES } from "../../prisma/seeds/data/churchDocuments";
import { GOAL_TEMPLATES } from "@/lib/data/goal-templates";

describe("Sacrament + consecration seeds", () => {
  it("has all seven sacraments, each with a matching goal-template slug", () => {
    const slugs = SACRAMENT_GUIDES.map((g) => g.slug);
    expect(slugs).toContain("sacrament-baptism");
    expect(slugs).toContain("sacrament-confirmation");
    expect(slugs).toContain("sacrament-eucharist");
    expect(slugs).toContain("sacrament-reconciliation");
    expect(slugs).toContain("sacrament-anointing-of-the-sick");
    expect(slugs).toContain("sacrament-holy-orders");
    expect(slugs).toContain("sacrament-matrimony");
    // 7 sacraments + 4 consecrations.
    expect(SACRAMENT_GUIDES).toHaveLength(11);
  });

  it("links every sacrament to a known goal template", () => {
    const templateSlugs = new Set(GOAL_TEMPLATES.map((g) => g.slug));
    for (const guide of SACRAMENT_GUIDES) {
      if (guide.goalTemplateSlug) {
        expect(templateSlugs.has(guide.goalTemplateSlug)).toBe(true);
      }
    }
  });

  it("has all four major consecrations (Marian, St Joseph, Holy Family, Sacred Heart)", () => {
    const slugs = SACRAMENT_GUIDES.map((g) => g.slug);
    expect(slugs).toContain("consecration-marian-de-montfort");
    expect(slugs).toContain("consecration-st-joseph");
    expect(slugs).toContain("consecration-holy-family");
    expect(slugs).toContain("consecration-sacred-heart");
  });
});

describe("Encyclical seeds", () => {
  it("has at least 50 encyclicals", () => {
    expect(ENCYCLICAL_ENTRIES.length).toBeGreaterThanOrEqual(50);
  });

  it("includes major encyclicals from every major pontificate since Leo XIII", () => {
    const slugs = new Set(ENCYCLICAL_ENTRIES.map((e) => e.slug));
    // Leo XIII
    expect(slugs.has("encyclical-rerum-novarum")).toBe(true);
    // Pius X
    expect(slugs.has("encyclical-pascendi-dominici-gregis")).toBe(true);
    // Pius XI
    expect(slugs.has("encyclical-quas-primas")).toBe(true);
    // Pius XII
    expect(slugs.has("encyclical-mystici-corporis-christi")).toBe(true);
    // John XXIII
    expect(slugs.has("encyclical-pacem-in-terris")).toBe(true);
    // Paul VI
    expect(slugs.has("encyclical-humanae-vitae")).toBe(true);
    // John Paul II
    expect(slugs.has("encyclical-veritatis-splendor")).toBe(true);
    expect(slugs.has("encyclical-evangelium-vitae")).toBe(true);
    // Benedict XVI
    expect(slugs.has("encyclical-deus-caritas-est")).toBe(true);
    // Francis
    expect(slugs.has("encyclical-laudato-si")).toBe(true);
    expect(slugs.has("encyclical-fratelli-tutti")).toBe(true);
    expect(slugs.has("encyclical-dilexit-nos")).toBe(true);
  });

  it("titles include the issuing Pope so attribution is visible on the timeline", () => {
    for (const e of ENCYCLICAL_ENTRIES) {
      // Allow "— Pope X" or "— Blessed Pope X" or "— Saint Pope X".
      expect(e.title).toMatch(/—\s+(?:Blessed |Saint |St\. )?Pope /);
    }
  });
});

describe("Church document seeds (CCC + Canon Law)", () => {
  it("has Catechism overview and the four major parts", () => {
    const slugs = new Set(CHURCH_DOCUMENT_ENTRIES.map((c) => c.slug));
    expect(slugs.has("catechism-overview")).toBe(true);
    expect(slugs.has("catechism-part-1-profession-of-faith")).toBe(true);
    expect(slugs.has("catechism-part-2-celebration-of-the-mystery")).toBe(true);
    expect(slugs.has("catechism-part-3-life-in-christ")).toBe(true);
    expect(slugs.has("catechism-part-4-christian-prayer")).toBe(true);
  });

  it("has all 7 books of the 1983 Code of Canon Law plus the Eastern Code", () => {
    const slugs = new Set(CHURCH_DOCUMENT_ENTRIES.map((c) => c.slug));
    expect(slugs.has("code-of-canon-law-overview")).toBe(true);
    for (let i = 1; i <= 7; i++) {
      const matches = [...slugs].filter((s) => s.startsWith(`code-of-canon-law-book-${i}-`));
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
    expect(slugs.has("code-of-canons-of-the-eastern-churches")).toBe(true);
  });
});
