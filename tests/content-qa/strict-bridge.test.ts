/**
 * End-to-end strict QA bridge tests. These exercise the path the runner
 * actually uses: take an IngestedItem, run it through the bridge +
 * strict pipeline, and verify the contract result.
 */

import { describe, expect, it } from "vitest";
import { buildCandidate, classifyForStrictQA } from "@/lib/ingestion/strict-qa-bridge";
import { runStrictPipelineSync } from "@/lib/content-qa/pipeline";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";
import type { IngestedItem } from "@/lib/ingestion/types";

describe("strict-qa-bridge end-to-end", () => {
  it("classifies a prayer kind as Prayer", () => {
    const item: IngestedItem = {
      kind: "prayer",
      slug: "test-prayer",
      defaultTitle: "Test Prayer",
      category: "Marian",
      body: "Hail Mary, full of grace. Amen.",
      externalSourceKey: "https://www.vatican.va/prayer",
    };
    expect(classifyForStrictQA(item)).toBe("Prayer");
  });

  it("routes a saint guide to Sacrament when content matches a sacrament", () => {
    const item: IngestedItem = {
      kind: "guide",
      slug: "baptism-guide",
      title: "The Sacrament of Baptism",
      summary: "Baptism is the sacrament instituted by Christ.",
      bodyText:
        "Baptism is a sacrament that confers sanctifying grace. The matter is water; the form is the Trinitarian formula. Catechism 1213.",
      guideKind: "GENERAL",
      externalSourceKey: "https://www.usccb.org/baptism",
    };
    expect(classifyForStrictQA(item)).toBe("Sacrament");
  });

  it("routes a guide whose body normalizes to Reconciliation as Sacrament", () => {
    const item: IngestedItem = {
      kind: "guide",
      slug: "confession-guide",
      title: "The Sacrament of Confession",
      summary: "Confession is a sacrament of healing.",
      bodyText:
        "The sacrament of Reconciliation, also known as Confession, restores sanctifying grace. The minister is a priest. Catechism 1422.",
      guideKind: "CONFESSION",
      externalSourceKey: "https://www.usccb.org/confession",
    };
    expect(classifyForStrictQA(item)).toBe("Sacrament");
  });

  it("routes a Rosary guide to Rosary", () => {
    const item: IngestedItem = {
      kind: "guide",
      slug: "how-to-rosary",
      title: "How to Pray the Rosary",
      summary: "A guide to praying the Rosary.",
      bodyText:
        "Sign of the Cross. Apostles' Creed. Our Father. Hail Mary. Glory Be. Hail Holy Queen.",
      guideKind: "ROSARY",
      externalSourceKey: "https://www.ewtn.com/rosary",
    };
    expect(classifyForStrictQA(item)).toBe("Rosary");
  });

  it("routes a Novena devotion to Novena", () => {
    const item: IngestedItem = {
      kind: "devotion",
      slug: "divine-mercy-novena",
      title: "Divine Mercy Novena",
      summary: "A nine-day novena to the Divine Mercy.",
      externalSourceKey: "https://www.thedivinemercy.org/novena",
    };
    expect(classifyForStrictQA(item)).toBe("Novena");
  });

  it("routes a Vatican council slug to History", () => {
    const item: IngestedItem = {
      kind: "liturgy",
      slug: "council-of-trent",
      title: "Council of Trent",
      liturgyKind: "COUNCIL_TIMELINE",
      body: "The Council of Trent was held from 1545-1563. It was convened by Pope Paul III in response to the Protestant Reformation. The council promulgated doctrine on justification, sacraments, and the canon.",
      externalSourceKey: "https://www.vatican.va/council-of-trent",
    };
    expect(classifyForStrictQA(item)).toBe("History");
  });

  it("the full bridge + pipeline accepts a valid Prayer from vatican.va", () => {
    const item: IngestedItem = {
      kind: "prayer",
      slug: "memorare",
      defaultTitle: "The Memorare",
      category: "Marian",
      body: "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thy intercession, was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother; to thee do I come, before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen.",
      externalSourceKey: "https://www.vatican.va/memorare",
    };
    const candidate = buildCandidate(item);
    expect(candidate.contentType).toBe("Prayer");
    expect(candidate.sourceHost).toBe("www.vatican.va");
    const result = runStrictPipelineSync(candidate, staticPurposesForHost(candidate.sourceHost!));
    expect(result.decision).toBe("publish");
    expect(result.publicRenderReady).toBe(true);
    expect(result.isThresholdEligible).toBe(true);
  });

  it("the full bridge + pipeline rejects a livestream prayer", () => {
    const item: IngestedItem = {
      kind: "prayer",
      slug: "newton-livestream",
      defaultTitle: "Livestream from Newton",
      category: "Daily",
      body: "Watch live every Sunday on YouTube. Click here to register now for our prayer service livestream.",
      externalSourceKey: "https://www.vatican.va/livestream",
    };
    const candidate = buildCandidate(item);
    const result = runStrictPipelineSync(candidate, staticPurposesForHost(candidate.sourceHost!));
    expect(["delete", "reject"]).toContain(result.decision);
  });

  it("the full bridge + pipeline rejects a Saint from a parish-only source", () => {
    const item: IngestedItem = {
      kind: "saint",
      slug: "saint-anthony",
      canonicalName: "Saint Anthony of Padua",
      patronages: ["lost things"],
      biography:
        "Saint Anthony of Padua was born in 1195 in Lisbon. He became a Franciscan friar and died in 1231. He is a Doctor of the Church and patron of lost things.",
      feastMonth: 6,
      feastDayOfMonth: 13,
      externalSourceKey: "https://parishesonline.com/saint",
    };
    const candidate = buildCandidate(item);
    const result = runStrictPipelineSync(candidate, staticPurposesForHost(candidate.sourceHost!));
    expect(result.decision).toBe("reject");
    expect(result.reason).toMatch(/not approved to ingest saints/);
  });
});
