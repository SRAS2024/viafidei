/**
 * Deterministic content-subtype classifier. Pins that every published item can
 * be tagged with a catalog subtype (so the coverage model tracks per-subtype
 * breadth instead of reading everything as "untagged"), that single-subtype
 * types are 100% correct, no-subtype types are null, and doctrinally-sensitive
 * multi-subtype types are never guessed.
 */
import { describe, expect, it } from "vitest";

import { resolveContentSubtype } from "@/lib/admin-worker/content-subtype";

describe("resolveContentSubtype", () => {
  it("stamps the sole subtype for single-subtype types (100% correct)", () => {
    expect(resolveContentSubtype("SAINT", { title: "St. Teresa" })).toBe("saint_biography");
    expect(resolveContentSubtype("POPE", { title: "Pope Leo XIII" })).toBe("pope_biography");
    expect(resolveContentSubtype("DOCTOR", { title: "St. Augustine" })).toBe("doctor_profile");
    expect(resolveContentSubtype("PARISH", { title: "St. Mary's" })).toBe("parish_profile");
  });

  it("returns null for types with no catalog subtypes", () => {
    for (const t of ["CREED", "HOMEPAGE_BLOCK", "HOLY_DAY"]) {
      expect(resolveContentSubtype(t, { title: "x" })).toBeNull();
    }
  });

  it("never guesses a payload-field subtype when the field is absent", () => {
    for (const t of [
      "DEVOTION",
      "MARIAN_TITLE",
      "SACRAMENT",
      "RITE",
      "GUIDE",
      "SPIRITUAL_PRACTICE",
      "LITURGICAL",
    ]) {
      expect(resolveContentSubtype(t, { title: "x" })).toBeNull();
    }
  });

  it("reads the payload's own schema field first (kind, devotionType, practiceKind, …)", () => {
    expect(resolveContentSubtype("LITURGICAL", { title: "Christmas", kind: "solemnity" })).toBe(
      "solemnity",
    );
    expect(resolveContentSubtype("LITURGICAL", { title: "Colors", kind: "glossary_term" })).toBe(
      "glossary_term",
    );
    expect(resolveContentSubtype("GUIDE", { title: "Rosary", kind: "rosary" })).toBe("rosary");
    expect(resolveContentSubtype("DEVOTION", { title: "x", devotionType: "eucharistic" })).toBe(
      "eucharistic",
    );
    expect(resolveContentSubtype("SPIRITUAL_PRACTICE", { practiceKind: "examen" })).toBe("examen");
    expect(resolveContentSubtype("SACRAMENT", { sacramentKey: "baptism" })).toBe(
      "sacrament_of_initiation",
    );
    expect(resolveContentSubtype("SACRAMENT", { sacramentKey: "matrimony" })).toBe(
      "sacrament_of_service",
    );
    expect(resolveContentSubtype("RITE", { riteKey: "roman" })).toBe("liturgical_rite");
    expect(resolveContentSubtype("RITE", { riteKey: "melkite" })).toBe("church_sui_iuris");
    expect(resolveContentSubtype("RITE", { riteKey: "ambrosian" })).toBe("latin_use");
    expect(resolveContentSubtype("MARIAN_TITLE", { slug: "immaculate-conception" })).toBe(
      "marian_dogma",
    );
    expect(resolveContentSubtype("MARIAN_TITLE", { slug: "our-lady-of-sorrows" })).toBe(
      "devotional_title",
    );
    expect(resolveContentSubtype("PRAYER", { title: "x", prayerType: "litany" })).toBe(
      "full_litany",
    );
  });

  it("classifies prayers by clear signals, defaulting to common_prayer", () => {
    expect(resolveContentSubtype("PRAYER", { title: "Hail Mary" })).toBe("marian_prayer");
    expect(resolveContentSubtype("PRAYER", { title: "Anima Christi" })).toBe("eucharistic_prayer");
    expect(resolveContentSubtype("PRAYER", { title: "Vespers Antiphon" })).toBe(
      "liturgical_prayer",
    );
    expect(resolveContentSubtype("PRAYER", { title: "Our Father" })).toBe("common_prayer");
  });

  it("treats a published novena as the full novena and reads the apparition's approvedStatus", () => {
    expect(resolveContentSubtype("NOVENA", { title: "Novena to St. Jude" })).toBe("full_novena");
    // The schema field is `approvedStatus`; an apparition with no status is
    // never defaulted to "approved".
    expect(
      resolveContentSubtype("APPARITION", {
        title: "Our Lady of Lourdes",
        approvedStatus: "approved",
      }),
    ).toBe("approved_apparition");
    expect(resolveContentSubtype("APPARITION", { title: "Our Lady of Lourdes" })).toBeNull();
    expect(resolveContentSubtype("APPARITION", { approvedStatus: "under_investigation" })).toBe(
      "apparition_under_review",
    );
    expect(resolveContentSubtype("APPARITION", { approvedStatus: "non_constat" })).toBe(
      "unapproved_apparition",
    );
    expect(resolveContentSubtype("APPARITION", { approvedStatus: "not_supernatural" })).toBe(
      "condemned_apparition",
    );
    expect(resolveContentSubtype("APPARITION", { title: "X", approvalStatus: "condemned" })).toBe(
      "condemned_apparition",
    );
  });

  it("classifies church documents by kind, never guessing when unclear", () => {
    expect(resolveContentSubtype("CHURCH_DOCUMENT", { title: "Rerum Novarum (Encyclical)" })).toBe(
      "encyclical",
    );
    expect(
      resolveContentSubtype("CHURCH_DOCUMENT", { title: "Evangelii Gaudium Exhortation" }),
    ).toBe("apostolic_exhortation");
    // No signal → null (do not mislabel a doctrinal document).
    expect(resolveContentSubtype("CHURCH_DOCUMENT", { title: "Some Vatican Text" })).toBeNull();
    // The payload's documentType wins over prose scanning.
    expect(
      resolveContentSubtype("CHURCH_DOCUMENT", {
        title: "Rerum Novarum",
        documentType: "encyclical",
      }),
    ).toBe("encyclical");
    expect(
      resolveContentSubtype("CHURCH_DOCUMENT", {
        title: "Catechism of the Catholic Church",
        documentType: "catechism_section",
      }),
    ).toBe("catechism_paragraph");
    expect(
      resolveContentSubtype("CHURCH_DOCUMENT", {
        title: "Lumen Gentium",
        documentType: "council_document",
        issuingAuthority: "Pope Paul VI / Second Vatican Council",
        summary: "The Dogmatic Constitution on the Church.",
      }),
    ).toBe("council_constitution");
    expect(
      resolveContentSubtype("CHURCH_DOCUMENT", {
        title: "Council of Trent",
        documentType: "council_document",
        issuingAuthority: "Catholic Church",
        summary: "Its Decree on Justification answered the Reformers.",
      }),
    ).toBe("council_document");
  });

  it("honours an explicit subtype already on the payload", () => {
    expect(resolveContentSubtype("PRAYER", { title: "x", contentSubtype: "saint_prayer" })).toBe(
      "saint_prayer",
    );
  });
});
