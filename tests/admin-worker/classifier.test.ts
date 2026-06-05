/**
 * Deterministic content classifier (spec §7). Proves the URL/title/body
 * rules pick the right content type and reject junk URLs short-circuit.
 */

import { describe, expect, it } from "vitest";

import { classify, toChecklistContentType } from "@/lib/admin-worker/classifier";

describe("classify", () => {
  it("rejects junk URL patterns short-circuit", () => {
    const res = classify({ url: "https://example.com/livestream/sunday-mass" });
    expect(res.contentType).toBe("WRONG");
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  it("rejects donation and store URLs", () => {
    expect(classify({ url: "https://x.org/donate" }).contentType).toBe("WRONG");
    expect(classify({ url: "https://x.org/store/products" }).contentType).toBe("WRONG");
  });

  it("classifies a clear prayer page", () => {
    const res = classify({
      url: "https://catholic.example/prayers/our-father",
      title: "The Our Father Prayer",
      bodyText:
        "Our Father, who art in heaven, hallowed be thy name. Thy kingdom come. Through Christ our Lord. Amen.",
    });
    expect(res.contentType).toBe("PRAYER");
    expect(res.confidence).toBeGreaterThanOrEqual(0.55);
  });

  it("classifies a saint biography", () => {
    const res = classify({
      url: "https://catholic.example/saints/saint-therese",
      title: "Saint Thérèse of Lisieux",
      headings: ["Feast day", "Patron saint", "Biography"],
      bodyText:
        "Saint Thérèse was born in 1873 in France. She was canonized in 1925. Her feast day is October 1. She is the patroness of missions.",
    });
    expect(res.contentType).toBe("SAINT");
  });

  it("classifies a pope-focused page as POPE, not SAINT", () => {
    const res = classify({
      url: "https://catholic.example/popes/pope-leo-xiii",
      title: "Pope Leo XIII",
      headings: ["Pontificate", "Election"],
      bodyText:
        "He was elected pope in 1878. During his pontificate he wrote Rerum Novarum. As Bishop of Rome he reigned for 25 years.",
    });
    expect(res.contentType).toBe("POPE");
  });

  it("classifies a Doctor of the Church page as DOCTOR", () => {
    const res = classify({
      url: "https://catholic.example/doctors/saint-augustine",
      title: "Saint Augustine, Doctor of the Church",
      headings: ["Doctor of the Church"],
      bodyText:
        "Augustine of Hippo was declared a Doctor of the Church. He is one of the great Doctors of the Church.",
    });
    expect(res.contentType).toBe("DOCTOR");
  });

  it("classifies a liturgical rite page as RITE, not LITURGICAL", () => {
    const res = classify({
      url: "https://catholic.example/rites/byzantine-rite",
      title: "The Byzantine Rite",
      headings: ["Liturgical tradition", "Eastern Catholic"],
      bodyText:
        "The Byzantine Rite is a liturgical tradition of the Eastern Catholic Churches, each a sui iuris particular church.",
    });
    expect(res.contentType).toBe("RITE");
  });

  it("keeps an ordinary saint as SAINT even though popes/doctors are saints too", () => {
    const res = classify({
      url: "https://catholic.example/saints/saint-francis-of-assisi",
      title: "Saint Francis of Assisi",
      headings: ["Feast day", "Patron"],
      bodyText:
        "Saint Francis was born in 1181. He was canonized in 1228. His feast day is October 4. He is the patron of animals.",
    });
    expect(res.contentType).toBe("SAINT");
  });

  it("classifies a Marian apparition", () => {
    const res = classify({
      url: "https://catholic.example/apparitions/our-lady-of-fatima",
      title: "Our Lady of Fatima",
      bodyText:
        "Our Lady appeared to three shepherd children in Fatima, Portugal. The apparition was approved by the Holy See.",
    });
    expect(res.contentType).toBe("APPARITION");
  });

  it("classifies a Novena", () => {
    const res = classify({
      url: "https://catholic.example/novenas/divine-mercy-novena",
      title: "Divine Mercy Novena",
      headings: ["Day 1", "Day 9"],
      bodyText: "Pray this novena over nine consecutive days. Day 1, Day 2, Day 9.",
    });
    expect(res.contentType).toBe("NOVENA");
  });

  it("classifies a Rosary page", () => {
    const res = classify({
      url: "https://catholic.example/rosary/joyful-mysteries",
      title: "How to Pray the Rosary - Joyful Mysteries",
      bodyText:
        "How to pray the Rosary. The joyful mysteries include the Annunciation and the Visitation. The sorrowful mysteries include the Agony in the Garden.",
    });
    expect(res.contentType).toBe("ROSARY");
  });

  it("classifies a sacrament page", () => {
    const res = classify({
      url: "https://catholic.example/sacraments/baptism",
      title: "The Sacrament of Baptism",
      bodyText:
        "Baptism is one of the seven sacraments. The Catechism of the Catholic Church explains it.",
    });
    expect(res.contentType).toBe("SACRAMENT");
  });

  it("returns UNUSABLE for content that scores below threshold", () => {
    const res = classify({
      url: "https://example.com/random",
      title: "Random Page",
      bodyText: "Some random content with no Catholic markers.",
    });
    expect(res.contentType).toBe("UNUSABLE");
  });

  it("gives every type a numeric score in perTypeScores", () => {
    const res = classify({
      url: "https://catholic.example/prayers/our-father",
      title: "The Our Father",
      bodyText: "Amen.",
    });
    expect(typeof res.perTypeScores.PRAYER).toBe("number");
    expect(typeof res.perTypeScores.SAINT).toBe("number");
  });

  it("applies a TRUSTED reputation bonus", () => {
    const baseline = classify({
      url: "https://x.example/prayers/x",
      title: "A prayer",
      bodyText: "Amen.",
    });
    const trusted = classify({
      url: "https://x.example/prayers/x",
      title: "A prayer",
      bodyText: "Amen.",
      sourceReputationTier: "TRUSTED",
    });
    expect(trusted.confidence).toBeGreaterThanOrEqual(baseline.confidence);
  });

  it("penalises PAUSED sources", () => {
    const paused = classify({
      url: "https://x.example/prayers/x",
      title: "A prayer",
      bodyText: "Amen.",
      sourceReputationTier: "PAUSED",
    });
    expect(paused.confidence).toBeLessThanOrEqual(0.85);
  });
});

describe("toChecklistContentType", () => {
  it("collapses ROSARY/CONSECRATION onto SPIRITUAL_PRACTICE", () => {
    expect(toChecklistContentType("ROSARY")).toBe("SPIRITUAL_PRACTICE");
    expect(toChecklistContentType("CONSECRATION")).toBe("SPIRITUAL_PRACTICE");
  });

  it("returns null for WRONG / UNUSABLE", () => {
    expect(toChecklistContentType("WRONG")).toBeNull();
    expect(toChecklistContentType("UNUSABLE")).toBeNull();
  });

  it("passes through ChecklistContentType values unchanged", () => {
    expect(toChecklistContentType("PRAYER")).toBe("PRAYER");
    expect(toChecklistContentType("SAINT")).toBe("SAINT");
  });
});
