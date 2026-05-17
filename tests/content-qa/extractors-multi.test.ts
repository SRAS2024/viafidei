/**
 * Section 8 — Prayer, Rosary, Consecration, Saint extractors.
 * Verifies each extractor produces a complete typed package from
 * representative source text and reports per-field provenance.
 */

import { describe, expect, it } from "vitest";
import { extractPrayer } from "@/lib/content-qa/extractors/prayer";
import { extractRosary } from "@/lib/content-qa/extractors/rosary";
import { extractConsecration } from "@/lib/content-qa/extractors/consecration";
import { extractSaint } from "@/lib/content-qa/extractors/saint";

describe("extractPrayer", () => {
  it("extracts a complete Marian prayer", () => {
    const result = extractPrayer({
      title: "Hail Mary",
      body: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women. Holy Mary, Mother of God, pray for us sinners now and at the hour of our death. Amen.",
      sourceUrl: "https://www.vatican.va/hail-mary",
    });
    expect(result.complete).toBe(true);
    expect(result.payload.prayerType).toBe("Marian prayer");
    expect(result.payload.prayerName).toBe("Hail Mary");
    expect(result.payload.sourceHost).toBe("www.vatican.va");
    expect(result.payload.language).toBe("en");
    expect(result.payload.contentChecksum).toBeTruthy();
    expect(result.provenance.prayerName).toBeDefined();
    expect(result.provenance.contentChecksum).toBe("computed");
  });

  it("classifies an Eucharistic prayer correctly", () => {
    const result = extractPrayer({
      title: "Anima Christi",
      body: "Soul of Christ, sanctify me. Body of Christ, save me. Blood of Christ, inebriate me. Before the Blessed Sacrament, I adore you. Amen.",
    });
    expect(result.payload.prayerType).toBe("Eucharistic prayer");
  });

  it("flags missingFields when body is too short", () => {
    const result = extractPrayer({ title: "Stub", body: "" });
    expect(result.complete).toBe(false);
    expect(result.missingFields).toContain("prayerText");
  });
});

describe("extractRosary", () => {
  it("extracts every required prayer + three mystery sets", () => {
    const body = [
      "The Rosary is a Marian devotion praying with scripture.",
      "How to pray: Begin with the Sign of the Cross, then say the Apostles' Creed.",
      "Sign of the Cross. Apostles' Creed. Our Father. Hail Mary. Glory Be. Hail Holy Queen.",
      "",
      "Joyful Mysteries",
      "The Annunciation — Luke 1:26",
      "The Visitation — Luke 1:39",
      "The Nativity — Luke 2:1",
      "The Presentation — Luke 2:22",
      "The Finding in the Temple — Luke 2:41",
      "",
      "Sorrowful Mysteries",
      "The Agony in the Garden — Matt 26:36",
      "The Scourging at the Pillar — Matt 27:26",
      "The Crowning with Thorns — Matt 27:29",
      "The Carrying of the Cross — John 19:17",
      "The Crucifixion — John 19:18",
      "",
      "Glorious Mysteries",
      "The Resurrection — Matt 28:1",
      "The Ascension — Luke 24:51",
      "The Descent of the Holy Spirit — Acts 2:1",
      "The Assumption — Rev 12:1",
      "The Coronation — Rev 12:1",
    ].join("\n");
    const result = extractRosary({ title: "The Holy Rosary", body });
    expect(result.complete).toBe(true);
    expect(result.payload.openingPrayers).toEqual(
      expect.arrayContaining([
        "Sign of the Cross",
        "Apostles' Creed",
        "Our Father",
        "Hail Mary",
        "Glory Be",
        "Hail Holy Queen",
      ]),
    );
    expect(result.payload.mysterySets).toHaveLength(3);
    for (const set of result.payload.mysterySets!) {
      expect(set.mysteries).toHaveLength(5);
    }
    expect(result.missingPrayers).toEqual([]);
    expect(result.missingMysterySets).toEqual([]);
  });

  it("flags missing required prayer", () => {
    const result = extractRosary({
      title: "Rosary",
      body: "Our Father. Hail Mary. Glory Be. Hail Holy Queen.",
    });
    expect(result.missingPrayers).toContain("Sign of the Cross");
    expect(result.missingPrayers).toContain("Apostles' Creed");
    expect(result.complete).toBe(false);
  });
});

describe("extractConsecration", () => {
  it("extracts a 9-day consecration with daily prayers", () => {
    const body = [
      "St. Louis de Montfort's 33-day preparation for total consecration to Jesus through Mary.",
      ...Array.from({ length: 9 }, (_, i) => {
        const n = i + 1;
        return `Day ${n}\nPrayer: O Mary, on day ${n} I offer my heart. Amen.`;
      }),
      "",
      "Final Consecration Prayer: I, NN, a faithless sinner, renew today the promises of my Baptism.",
    ].join("\n\n");
    const result = extractConsecration({
      title: "Consecration to Mary",
      body,
    });
    expect(result.complete).toBe(true);
    expect(result.payload.durationDays).toBe(9);
    expect(result.payload.dailyPrayers).toHaveLength(9);
    expect(result.payload.finalConsecrationPrayer).toMatch(/faithless\s+sinner/);
    expect(result.provenance.finalConsecrationPrayer).toBeDefined();
  });

  it("flags incomplete consecration when days are missing", () => {
    const body = [
      "A consecration",
      "Day 1\nPrayer: Day one.",
      "Day 3\nPrayer: Day three.",
      "Final Consecration Prayer: Receive me.",
    ].join("\n\n");
    const result = extractConsecration({ title: "Test", body });
    expect(result.complete).toBe(false);
    expect(result.missingDays).toContain(2);
  });
});

describe("extractSaint", () => {
  it("extracts a complete saint biography", () => {
    const result = extractSaint({
      title: "Saint Anthony of Padua",
      body: "Saint Anthony of Padua was born in 1195 in Lisbon. He became a Franciscan friar and Doctor of the Church. Feast day: June 13. Patron saint of lost things and the poor. He died in 1231.",
      sourceUrl: "https://www.vatican.va/anthony",
    });
    expect(result.complete).toBe(true);
    expect(result.payload.saintName).toBe("Saint Anthony of Padua");
    expect(result.payload.saintType).toBe("Doctor of the Church");
    expect(result.payload.feastDay).toBe("June 13");
    expect(result.payload.feastMonth).toBe(6);
    expect(result.payload.feastDayOfMonth).toBe(13);
    expect(result.payload.patronages).toEqual(expect.arrayContaining(["lost things"]));
    expect(result.payload.sourceHost).toBe("www.vatican.va");
  });

  it("flags a parish-page disguised as a saint biography", () => {
    const result = extractSaint({
      title: "Saint Mary Parish",
      body: "Welcome to Saint Mary parish. Mass schedule: Sunday 8am. Office hours: Mon-Fri 9-5.",
      sourceUrl: "https://parish.example/mary",
    });
    expect(result.complete).toBe(false);
    expect(result.missingFields).toContain("biography");
  });
});
