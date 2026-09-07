/**
 * Per-type content-subtitle spec. The generator is deterministic and reads
 * only fields already in the content schemas; run over the whole curated
 * registry it must produce genuinely descriptive, varied subtitles — never one
 * identical sentence per type, never "Bishop" for a Doctor who was not one.
 */

import { describe, expect, it } from "vitest";

import { ALL_CURATED_ENTRIES } from "@/lib/checklist";
import {
  formatFeastDate,
  generateContentSubtitle,
  shortContentSubtitle,
} from "@/lib/content-shared/content-subtitle";

const sub = (contentType: string, fields: Record<string, unknown>, contentSubtype?: string) =>
  generateContentSubtitle({ contentType, contentSubtype: contentSubtype ?? null, fields });

describe("generateContentSubtitle — per-type spec", () => {
  it("SAINT: type label, first patronage, feast", () => {
    expect(
      sub("SAINT", {
        saintType: "apostle",
        canonizationStatus: "canonized",
        patronages: ["the papacy", "fishermen"],
        feastDay: "06-29",
      }),
    ).toBe("Apostle, patron of the papacy · Feast June 29");
    expect(
      sub("SAINT", { saintType: "martyr", canonizationStatus: "beatified", feastDay: "08-14" }),
    ).toBe("Blessed · Martyr · Feast August 14");
    expect(sub("SAINT", { saintType: "lay", canonizationStatus: "servant_of_god" })).toBe(
      "Servant of God · Lay faithful",
    );
    expect(sub("SAINT", {})).toBe("A saint of the Catholic Church");
  });

  it("POPE: papacy span, optional ordinal", () => {
    expect(sub("POPE", { papacyStart: "1978", papacyEnd: "2005" })).toBe("Pope from 1978 to 2005");
    expect(sub("POPE", { papacyStart: "2025" })).toBe("Pope since 2025");
    expect(sub("POPE", { papacyStart: "1978", papacyEnd: "2005", ordinal: 264 })).toBe(
      "264th Pope · 1978–2005",
    );
    expect(sub("POPE", {})).toBe("Pope, Bishop of Rome");
  });

  it("DOCTOR: epithet + feast; 'Bishop' only when ecclesialRole says so", () => {
    expect(sub("DOCTOR", { doctorTitle: "Angelic Doctor", feastDay: "01-28" })).toBe(
      "Doctor of the Church — Angelic Doctor · Feast January 28",
    );
    expect(
      sub("DOCTOR", { doctorTitle: "Doctor of Grace", feastDay: "08-28", ecclesialRole: "bishop" }),
    ).toBe("Bishop · Doctor of the Church — Doctor of Grace · Feast August 28");
    expect(sub("DOCTOR", { doctorTitle: "Doctor of the Church", feastDay: "12-07" })).toBe(
      "Doctor of the Church · Feast December 7",
    );
    expect(sub("DOCTOR", { doctorTitle: "Doctor of Grace", feastDay: "August 28" })).toBe(
      "Doctor of the Church — Doctor of Grace · Feast August 28",
    );
    expect(sub("DOCTOR", {})).toBe("Doctor of the Church");
  });

  it("APPARITION: status label from approvedStatus + place + year", () => {
    expect(
      sub("APPARITION", {
        approvedStatus: "approved",
        location: "Lourdes",
        country: "France",
        yearOfApparition: 1858,
      }),
    ).toBe("Church-approved Marian apparition · Lourdes, France, 1858");
    expect(sub("APPARITION", { approvedStatus: "under_investigation" })).toBe(
      "Marian apparition under Church review",
    );
    expect(sub("APPARITION", { approvedStatus: "non_constat" })).toBe(
      "Marian apparition not confirmed by the Church",
    );
    expect(sub("APPARITION", { approvedStatus: "not_supernatural" })).toBe(
      "Reported apparition judged not supernatural",
    );
    expect(sub("APPARITION", { approvedStatus: "private_revelation" })).toBe("Private revelation");
    expect(sub("APPARITION", { approvedStatus: "nihil_obstat", country: "Bosnia" })).toBe(
      "Marian apparition granted nihil obstat · Bosnia",
    );
    expect(sub("APPARITION", { approvedStatus: "approved", subject: "christ" })).toBe(
      "Church-approved apparition of Christ",
    );
    // Legacy field names still work; nothing is ever assumed approved.
    expect(sub("APPARITION", { approvalStatus: "approved" })).toMatch(/^Church-approved/);
    expect(sub("APPARITION", {})).toBe("Reported Marian apparition");
  });

  it("MARIAN_TITLE: the four dogmas, else title + feast + region", () => {
    expect(sub("MARIAN_TITLE", { slug: "mother-of-god" })).toBe("Marian dogma · defined 431");
    expect(sub("MARIAN_TITLE", { slug: "immaculate-conception" })).toBe(
      "Marian dogma · defined 1854",
    );
    expect(sub("MARIAN_TITLE", { slug: "assumption-of-mary" })).toBe("Marian dogma · defined 1950");
    expect(sub("MARIAN_TITLE", { slug: "perpetual-virginity" })).toBe("Marian dogma · defined 649");
    expect(sub("MARIAN_TITLE", { slug: "x", dogmaDefinedYear: 1964 })).toBe(
      "Marian dogma · defined 1964",
    );
    expect(
      sub("MARIAN_TITLE", { slug: "our-lady-of-lujan", feastDay: "05-08", region: "Argentina" }),
    ).toBe("Title of the Blessed Virgin Mary · Feast May 8 · Argentina");
    expect(sub("MARIAN_TITLE", { slug: "x" })).toBe("Title of the Blessed Virgin Mary");
  });

  it("SACRAMENT: the Catechism's grouping by sacramentKey", () => {
    expect(sub("SACRAMENT", { sacramentKey: "baptism" })).toBe("Sacrament of Christian Initiation");
    expect(sub("SACRAMENT", { sacramentKey: "anointing_of_the_sick" })).toBe(
      "Sacrament of Healing",
    );
    expect(sub("SACRAMENT", { sacramentKey: "matrimony" })).toBe(
      "Sacrament at the Service of Communion",
    );
  });

  it("PRAYER: prayerType label + Latin / translations", () => {
    expect(sub("PRAYER", { prayerType: "marian", latin: "Ave Maria" })).toBe(
      "Marian prayer · Latin text",
    );
    expect(sub("PRAYER", { prayerType: "litany" })).toBe("Litany — invocations and responses");
    expect(sub("PRAYER", { prayerType: "meal" })).toBe("Grace before/after meals");
    expect(
      generateContentSubtitle({
        contentType: "PRAYER",
        title: "Act of Contrition",
        fields: { prayerType: "act", translations: [{ language: "es", text: "x" }] },
      }),
    ).toBe("Act of contrition · 1 translations");
    // No prayerType → the subtype-based sentence still works.
    expect(sub("PRAYER", {}, "marian_prayer")).toMatch(/Marian prayer/);
  });

  it("NOVENA: saint, start date or feast, theme fallback", () => {
    expect(sub("NOVENA", { associatedSaintSlug: "saint-jude-thaddeus" })).toBe(
      "Nine-day novena to Saint Jude Thaddeus",
    );
    expect(sub("NOVENA", { relatedFeastSlug: "solemnity-pentecost" })).toBe(
      "Nine-day novena · before Pentecost",
    );
    expect(
      sub("NOVENA", { associatedSaintSlug: "saint-joseph", typicalStartDate: "March 10" }),
    ).toBe("Nine-day novena to Saint Joseph · begins March 10");
    expect(sub("NOVENA", { intentionTheme: "the seven gifts of the Holy Spirit" })).toBe(
      "Nine-day novena for the seven gifts of the Holy Spirit",
    );
    expect(sub("NOVENA", { durationDays: 25, intentionTheme: "Christmas" })).toBe(
      "25-day novena for Christmas",
    );
  });

  it("DEVOTION: devotionType label + duration", () => {
    expect(sub("DEVOTION", { devotionType: "eucharistic", durationMinutes: 60 })).toBe(
      "Eucharistic devotion · 60 min",
    );
    expect(sub("DEVOTION", { devotionType: "christological" })).toBe("Devotion to Christ");
    expect(sub("DEVOTION", { devotionType: "reparation" })).toBe("Devotion of reparation");
  });

  it("CHURCH_DOCUMENT: kind of issuer (year); councils; the Catechism", () => {
    expect(
      sub("CHURCH_DOCUMENT", {
        documentType: "encyclical",
        issuingAuthority: "Pope Leo XIII",
        issuedDate: "1891-05-15",
      }),
    ).toBe("Encyclical of Pope Leo XIII (1891)");
    expect(
      sub("CHURCH_DOCUMENT", {
        documentType: "council_document",
        issuingAuthority: "Catholic Church",
        issuedDate: "0325-01-01",
      }),
    ).toBe("Ecumenical Council · 325");
    expect(
      sub("CHURCH_DOCUMENT", {
        documentType: "council_document",
        issuingAuthority: "Pope Paul VI / Second Vatican Council",
        issuedDate: "1964-11-21",
      }),
    ).toBe("Document of the Second Vatican Council (1964)");
    expect(
      sub("CHURCH_DOCUMENT", { documentType: "catechism_section", issuedDate: "1992-10-11" }),
    ).toBe("Catechism of the Catholic Church · promulgated 1992");
    // Subtype + pope fallback (no documentType / issuedDate on the payload).
    expect(sub("CHURCH_DOCUMENT", { pope: "Leo XIII" }, "encyclical")).toBe(
      "Encyclical of Pope Leo XIII",
    );
  });

  it("LITURGICAL: rank · date/movable · season; non-calendar kinds", () => {
    expect(sub("LITURGICAL", { kind: "solemnity", feastDate: "12-25", season: "christmas" })).toBe(
      "Solemnity · December 25 · Christmas season",
    );
    expect(sub("LITURGICAL", { kind: "solemnity", movableFeast: true, season: "easter" })).toBe(
      "Solemnity · movable · Easter season",
    );
    expect(sub("LITURGICAL", { kind: "optional_memorial", feastDate: "08-05" })).toBe(
      "Optional memorial · August 5",
    );
    expect(sub("LITURGICAL", { kind: "liturgical_season" })).toBe("Season of the liturgical year");
    expect(sub("LITURGICAL", { kind: "mass_structure" })).toBe("Order of Mass");
    expect(sub("LITURGICAL", { kind: "funeral_rite" })).toBe("Liturgical rite");
    expect(sub("LITURGICAL", { kind: "glossary_term" })).toBe("Liturgical glossary");
    // The subtype (stamped from `kind` at publish) is honoured when kind is absent.
    expect(sub("LITURGICAL", {}, "symbolism")).toBe("Liturgical symbolism");
  });

  it("RITE: family and what the entry describes", () => {
    expect(sub("RITE", { riteKey: "roman" })).toBe("Latin liturgical rite");
    expect(sub("RITE", { riteKey: "ambrosian" })).toBe("Latin liturgical use · Milan");
    expect(sub("RITE", { riteKey: "mozarabic" })).toBe("Latin liturgical use · Toledo");
    expect(sub("RITE", { riteKey: "byzantine" })).toBe("Byzantine liturgical rite");
    expect(sub("RITE", { riteKey: "melkite" })).toBe("Byzantine tradition · Church sui iuris");
    expect(sub("RITE", { riteKey: "maronite" })).toBe(
      "West Syriac (Antiochene) tradition · Church sui iuris",
    );
    expect(sub("RITE", { riteKey: "chaldean" })).toBe(
      "East Syriac (Chaldean) tradition · Church sui iuris",
    );
    expect(sub("RITE", { riteKey: "coptic" })).toBe("Alexandrian tradition · Church sui iuris");
    expect(sub("RITE", { family: "armenian", entryKind: "liturgical_rite" })).toBe(
      "Armenian tradition",
    );
  });

  it("PARISH: designation · place · diocese", () => {
    expect(
      sub("PARISH", {
        designation: "major-basilica",
        city: "Vatican City",
        country: "Vatican City State",
        diocese: "Diocese of Rome",
      }),
    ).toBe("Major basilica · Vatican City, Vatican City State · Diocese of Rome");
    expect(sub("PARISH", { designation: "cathedral", city: "New York", state: "NY" })).toBe(
      "Cathedral · New York, NY",
    );
    expect(sub("PARISH", { city: "Springfield" })).toBe("Parish · Springfield");
  });

  it("GUIDE: kind-aware label · N steps", () => {
    const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ order: i + 1 }));
    expect(sub("GUIDE", { kind: "rosary", steps: steps(6) })).toBe(
      "How to pray the Rosary · 6 steps",
    );
    expect(
      sub("GUIDE", { kind: "confession", sacramentKey: "reconciliation", steps: steps(6) }),
    ).toBe("Preparing for Confession · 6 steps");
    expect(sub("GUIDE", { kind: "adoration", steps: steps(4) })).toBe(
      "Eucharistic Adoration · 4 steps",
    );
    expect(sub("GUIDE", { kind: "lent_preparation", steps: steps(5) })).toBe(
      "Lenten guide · 5 steps",
    );
    expect(sub("GUIDE", { kind: "ocia", steps: steps(8) })).toBe(
      "Becoming Catholic (OCIA) · 8 steps",
    );
    expect(sub("GUIDE", { kind: "general", sacramentKey: "baptism", steps: steps(7) })).toBe(
      "Preparing for Baptism · 7 steps",
    );
    expect(sub("GUIDE", { kind: "general", category: "liturgy", steps: steps(4) })).toBe(
      "Mass and liturgy · 4 steps",
    );
    expect(sub("GUIDE", { kind: "general", steps: steps(1) })).toBe("Guide · 1 step");
  });

  it("SPIRITUAL_PRACTICE: practiceKind label · tradition", () => {
    expect(sub("SPIRITUAL_PRACTICE", { practiceKind: "examen", tradition: "Ignatian" })).toBe(
      "Daily examen · Ignatian tradition",
    );
    expect(sub("SPIRITUAL_PRACTICE", { practiceKind: "lectio_divina" })).toBe("Lectio divina");
    expect(sub("SPIRITUAL_PRACTICE", { practiceKind: "stations_of_the_cross" })).toBe(
      "Way of the Cross",
    );
  });

  it("formats feast dates and keeps short subtitles short", () => {
    expect(formatFeastDate("06-29")).toBe("June 29");
    expect(formatFeastDate("August 28")).toBe("August 28");
    expect(shortContentSubtitle({ contentType: "SAINT" }).length).toBeLessThanOrEqual(40);
  });
});

describe("generateContentSubtitle over the curated registry", () => {
  const byType = new Map<string, string[]>();
  for (const entry of ALL_CURATED_ENTRIES) {
    const subtitle = generateContentSubtitle({
      contentType: entry.contentType,
      contentSubtype: null,
      title: typeof entry.payload.title === "string" ? entry.payload.title : null,
      fields: entry.payload,
    });
    byType.set(entry.contentType, [...(byType.get(entry.contentType) ?? []), subtitle]);
  }

  it("is deterministic and never empty", () => {
    for (const entry of ALL_CURATED_ENTRIES) {
      const a = generateContentSubtitle({ contentType: entry.contentType, fields: entry.payload });
      const b = generateContentSubtitle({ contentType: entry.contentType, fields: entry.payload });
      expect(a).toBe(b);
      expect(a.length).toBeGreaterThan(0);
    }
  });

  it("yields at least 6 distinct subtitles for every type with more than 10 entries", () => {
    for (const [type, subtitles] of byType) {
      if (subtitles.length <= 10) continue;
      const distinct = new Set(subtitles).size;
      expect(
        distinct,
        `${type}: ${[...new Set(subtitles)].slice(0, 8).join(" | ")}`,
      ).toBeGreaterThanOrEqual(6);
    }
  });

  it("never calls a non-bishop Doctor of the Church a Bishop", () => {
    const doctors = ALL_CURATED_ENTRIES.filter((e) => e.contentType === "DOCTOR");
    expect(doctors.length).toBe(37);
    for (const d of doctors) {
      const subtitle = generateContentSubtitle({ contentType: "DOCTOR", fields: d.payload });
      const role = d.payload.ecclesialRole;
      if (role !== "bishop") expect(subtitle, d.slug).not.toMatch(/\bBishop\b/);
      else expect(subtitle, d.slug).toMatch(/^Bishop · /);
      expect(subtitle).toMatch(/Doctor of the Church/);
    }
    const aquinas = doctors.find((d) => d.slug === "doctor-thomas-aquinas")!;
    expect(generateContentSubtitle({ contentType: "DOCTOR", fields: aquinas.payload })).toBe(
      "Religious · Doctor of the Church — Angelic Doctor · Feast January 28",
    );
  });

  it("labels every curated apparition as Church-approved (approvedStatus, not approvalStatus)", () => {
    for (const s of byType.get("APPARITION") ?? []) {
      expect(s).toMatch(/^Church-approved Marian apparition · .+, \d{3,4}$/);
    }
  });

  it("gives the Mass structure and the colors glossary their own liturgical subtitles", () => {
    const find = (slug: string) => ALL_CURATED_ENTRIES.find((e) => e.slug === slug)!;
    expect(
      generateContentSubtitle({
        contentType: "LITURGICAL",
        fields: find("structure-roman-rite-mass").payload,
      }),
    ).toBe("Order of Mass");
    expect(
      generateContentSubtitle({
        contentType: "LITURGICAL",
        fields: find("glossary-liturgical-colors").payload,
      }),
    ).toBe("Liturgical glossary");
    expect(
      generateContentSubtitle({
        contentType: "LITURGICAL",
        fields: find("solemnity-christmas").payload,
      }),
    ).toBe("Solemnity · December 25 · Christmas season");
  });

  it("names the issuing pope and year on every curated encyclical", () => {
    const encyclicals = ALL_CURATED_ENTRIES.filter(
      (e) => e.contentType === "CHURCH_DOCUMENT" && e.payload.documentType === "encyclical",
    );
    expect(encyclicals.length).toBeGreaterThan(10);
    for (const e of encyclicals) {
      expect(
        generateContentSubtitle({ contentType: "CHURCH_DOCUMENT", fields: e.payload }),
        e.slug,
      ).toMatch(/^Encyclical of Pope .+ \(\d{4}\)$/);
    }
  });
});
