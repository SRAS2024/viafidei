/**
 * Schema-correct web payloads (R1).
 *
 * The web path published raw extractor fields for every type except PRAYER:
 * a saint went live as {saintName, background} (no canonicalName, biography or
 * citations), an apparition as {apparitionTitle, approvalStatus}. These pin the
 * per-type registry that maps extractor fields onto src/lib/checklist/schemas
 * and validates them — and that it never invents a value: a field the
 * extraction did not produce stays missing and the payload is refused, a
 * citation shortfall is told apart from an extraction gap.
 */

import { describe, expect, it } from "vitest";

import { validatePayload } from "@/lib/checklist/schemas";
import { RosaryExtractor, canonizationStatusFromHonorific } from "@/lib/admin-worker/extractors";
import {
  buildWebPublishPayload,
  hasWebSchemaMapping,
  webPublishType,
} from "@/lib/admin-worker/web-publish-payloads";
import { corroboratingCitations } from "@/lib/admin-worker/web-extraction-helpers";

const SRC = "https://www.catholic.org/saints/saint.php?saint_id=50";
const CORROBORATION = "https://www.vatican.va/content/francesco/en/saints/francis.html";

const base = (fields: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  fields,
  title: "Untitled",
  slug: "test-slug",
  host: "www.catholic.org",
  sourceUrl: SRC,
  corroboratingUrls: [CORROBORATION],
  ...over,
});

const BIO =
  "Francis of Assisi was born in 1181 in Assisi, renounced his inheritance, founded the Friars Minor, and died in 1226 at the Portiuncula.";

describe("SAINT", () => {
  const fields = {
    saintName: "Saint Francis of Assisi - Saints & Angels - Catholic Online",
    saintType: "saint",
    feastDay: "10-04",
    background: BIO,
    patronage: "animals, ecology and Italy",
  };

  it("maps onto the SAINT schema with two real citations", () => {
    const out = buildWebPublishPayload("SAINT", base(fields, { slug: "st-francis-of-assisi" }));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.payload).toMatchObject({
      slug: "st-francis-of-assisi",
      canonicalName: "Saint Francis of Assisi",
      feastDay: "10-04",
      feastMonth: 10,
      feastDayOfMonth: 4,
      biography: BIO,
      canonizationStatus: "canonized",
      citations: [SRC, CORROBORATION],
      sourceUrl: SRC,
    });
    expect(out.title).toBe("Saint Francis of Assisi");
    // The extractor's own field names are gone.
    expect(out.payload).not.toHaveProperty("saintName");
    expect(out.payload).not.toHaveProperty("background");
    expect(validatePayload("SAINT", out.payload).ok).toBe(true);
  });

  it("only the page itself → INSUFFICIENT_CITATIONS (another witness, not another extraction)", () => {
    const out = buildWebPublishPayload("SAINT", base(fields, { corroboratingUrls: [] }));
    expect(out).toMatchObject({ ok: false, code: "INSUFFICIENT_CITATIONS" });
  });

  it("a biography under the schema's 100 characters is an extraction gap", () => {
    const out = buildWebPublishPayload("SAINT", base({ ...fields, background: "Short." }));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.code).toBe("SCHEMA_FIELDS_MISSING");
    expect(out.errors.join(" ")).toMatch(/biography/);
  });

  it("a bare name states no canonization status, so none is assumed", () => {
    const out = buildWebPublishPayload(
      "SAINT",
      base({ ...fields, saintName: "Francis of Assisi" }, { title: "Francis of Assisi" }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors.join(" ")).toMatch(/canonizationStatus/);
  });

  // A page classified SAINT whose title opens with an honorific but names no
  // person used to publish as a beatified or canonized saint: "Blessed Virgin
  // Mary" became canonizationStatus "beatified".
  it.each(["Blessed Virgin Mary", "Blessed Mother", "Blessed Sacrament", "St. Patrick's Day"])(
    "%j names no one beatified or canonized, so the payload is refused",
    (name) => {
      const out = buildWebPublishPayload("SAINT", base({ ...fields, saintName: name }));
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.errors.join(" ")).toMatch(/canonizationStatus/);
    },
  );
});

describe("canonizationStatusFromHonorific", () => {
  it.each([
    ["Saint Thérèse of Lisieux", "canonized"],
    ["St. John of the Cross", "canonized"],
    ["St Rose of Lima", "canonized"],
    ["Saint Mary Magdalene", "canonized"],
    ["Saint Patrick - Saint of the Day", "canonized"],
    ["Blessed Miguel Pro", "beatified"],
    ["Bl. Mary of the Divine Heart", "beatified"],
    ["Venerable Fulton J. Sheen", "venerable"],
    ["Servant of God Frank Duff", "servant_of_god"],
  ])("%j → %s", (name, status) => {
    expect(canonizationStatusFromHonorific(name)).toBe(status);
  });

  it.each([
    "Blessed Virgin Mary",
    "Blessed Mother",
    "Blessed Mother of God",
    "Blessed Mary, Mother of God",
    "Blessed Mary Ever Virgin",
    "Blessed Lady",
    "Blessed Sacrament",
    "Blessed Trinity",
    "Blessed be God",
    "Blessed Are the Poor in Spirit",
    "Blessed Salt",
    "Saint Mary",
    "St. Patrick's Day",
    "St. Peter's Basilica",
    "Saint Benedict Medal",
    "St. Michael Prayer",
    "Saint Joseph Altar",
    "Francis of Assisi",
    "Saint",
    "",
  ])("%j yields no status", (name) => {
    expect(canonizationStatusFromHonorific(name)).toBeUndefined();
  });
});

describe("APPARITION", () => {
  const fields = {
    apparitionTitle: "Our Lady of Lourdes",
    apparitionLocation: "Lourdes, France",
    apparitionDate: "February 11, 1858",
    approvalStatus: "approved",
    background:
      "The Blessed Virgin appeared eighteen times to Bernadette Soubirous at the grotto of Massabielle.",
  };

  it("splits the place from a country the source named, and maps the approval", () => {
    const out = buildWebPublishPayload("APPARITION", base(fields));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.payload).toMatchObject({
      title: "Our Lady of Lourdes",
      location: "Lourdes",
      country: "France",
      approvedStatus: "approved",
      yearOfApparition: 1858,
    });
  });

  it("never infers a country or a canonical ruling the page did not state", () => {
    const out = buildWebPublishPayload(
      "APPARITION",
      base({ ...fields, apparitionLocation: "Fatima", approvalStatus: "not approved" }),
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    const errors = out.errors.join(" ");
    expect(errors).toMatch(/country/);
    expect(errors).toMatch(/approvedStatus/);
  });
});

describe("types the extractors cannot complete stay refused (nothing invented)", () => {
  it("NOVENA: nine day prayers but no per-day meditation", () => {
    const days: Record<string, { title: string; prayer: string }> = {};
    for (let i = 1; i <= 9; i++) {
      days[`day${i}`] = { title: `Day ${i}`, prayer: `Day ${i}: O Saint Jude, pray for us. Amen.` };
    }
    const out = buildWebPublishPayload(
      "NOVENA",
      base({
        novenaTitle: "Novena to St. Jude",
        purpose: "For the hopeless and the despairing.",
        days,
      }),
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.code).toBe("SCHEMA_FIELDS_MISSING");
    expect(out.errors.join(" ")).toMatch(/meditation/);
  });

  it("CHURCH_DOCUMENT: no issuing authority or themes are guessed", () => {
    const out = buildWebPublishPayload(
      "CHURCH_DOCUMENT",
      base({
        historyType: "encyclicals",
        title: "Rerum Novarum",
        dateOrEra: "May 15, 1891",
        summary:
          "Rerum Novarum is the encyclical on capital and labour that opened modern Catholic social teaching in the industrial age.",
        body: "…",
      }),
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    const errors = out.errors.join(" ");
    expect(errors).toMatch(/issuingAuthority/);
    expect(errors).toMatch(/keyThemes/);
    // The date and type it DID read are mapped (no error for them).
    expect(errors).not.toMatch(/issuedDate/);
    expect(errors).not.toMatch(/documentType/);
  });

  it("ROSARY: the extractor's fixed how-to text never becomes published instructions", () => {
    const extracted = RosaryExtractor({
      url: "https://www.example.org/rosary",
      host: "www.example.org",
      title: "The Holy Rosary",
      bodyText:
        "Joyful Mysteries 1. The Annunciation 2. The Visitation 3. The Nativity 4. The Presentation 5. The Finding in the Temple",
    });
    const out = buildWebPublishPayload("ROSARY", base(extracted.fields as Record<string, unknown>));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.errors.join(" ")).toMatch(/instructions/);
    expect(webPublishType("ROSARY")).toBe("SPIRITUAL_PRACTICE");
  });
});

describe("LITURGICAL", () => {
  const fields = (liturgyTitle: string) => ({
    liturgyTitle,
    liturgyType: "mass",
    summary:
      "The liturgical year is the cycle of seasons and feasts through which the Church celebrates the mystery of Christ.",
    formationBody:
      "The liturgical year is the cycle of seasons and feasts through which the Church celebrates the whole mystery of Christ.",
  });

  it("takes the kind from what the title names", () => {
    const out = buildWebPublishPayload(
      "LITURGICAL",
      base(fields("Liturgical Year and Calendar | USCCB"), { host: "www.usccb.org" }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.payload).toMatchObject({
        title: "Liturgical Year and Calendar",
        kind: "liturgical_year",
      });
      expect(out.title).toBe("Liturgical Year and Calendar");
    }
  });

  it("does not map the extractor's default 'mass' onto a page that names no kind", () => {
    const out = buildWebPublishPayload("LITURGICAL", base(fields("Liturgy of the Hours")));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors.join(" ")).toMatch(/kind/);
  });
});

describe("other web types", () => {
  it("DEVOTION maps background / how-to onto the schema", () => {
    const out = buildWebPublishPayload(
      "DEVOTION",
      base({
        devotionTitle: "Chaplet of Divine Mercy",
        devotionType: "chaplet",
        background: "The Chaplet of Divine Mercy was given to Saint Faustina Kowalska in 1935.",
        howToPractice:
          "Begin with the Sign of the Cross, one Our Father, one Hail Mary and the Apostles' Creed.",
      }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.payload).toMatchObject({
        title: "Chaplet of Divine Mercy",
        devotionType: "chaplet",
        practiceInstructions: expect.stringMatching(/^Begin with/),
      });
    }
  });

  it("SPIRITUAL_PRACTICE: kind from the title, summary = the body's first sentence", () => {
    const body =
      "Lectio divina is the slow, prayerful reading of Scripture handed down by the monastic tradition. It moves through reading, meditation, prayer and contemplation.";
    const out = buildWebPublishPayload(
      "SPIRITUAL_PRACTICE",
      base({
        title: "Lectio Divina",
        body,
        howToPractice:
          "Choose a short passage, read it slowly twice, and stay with the word or phrase that strikes you.",
      }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.payload).toMatchObject({
        practiceKind: "lectio_divina",
        summary:
          "Lectio divina is the slow, prayerful reading of Scripture handed down by the monastic tradition.",
      });
    }
  });

  it("POPE / DOCTOR / RITE need one citation; a prose feast becomes MM-DD", () => {
    const pope = buildWebPublishPayload(
      "POPE",
      base(
        { popeName: "Pope Leo XIII", papacyStart: "1878", papacyEnd: "1903" },
        {
          corroboratingUrls: [],
        },
      ),
    );
    expect(pope).toMatchObject({ ok: true });
    const doctor = buildWebPublishPayload(
      "DOCTOR",
      base(
        { doctorName: "Saint Teresa of Avila", feastDay: "October 15" },
        {
          corroboratingUrls: [],
        },
      ),
    );
    expect(doctor.ok).toBe(true);
    if (doctor.ok) {
      expect(doctor.payload).toMatchObject({
        feastDay: "10-15",
        feastMonth: 10,
        feastDayOfMonth: 15,
      });
    }
    expect(
      buildWebPublishPayload(
        "RITE",
        base({ riteName: "Ambrosian Rite" }, { corroboratingUrls: [] }),
      ),
    ).toMatchObject({ ok: true });
  });

  it("PRAYER keeps its existing builder and lists the corroboration after the page", () => {
    const out = buildWebPublishPayload(
      "PRAYER",
      base({
        prayerTitle: "The Memorare",
        prayerType: "marian",
        prayerText:
          "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection was left unaided. Amen.",
        category: "PRAYER",
      }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.payload.citations).toEqual([SRC, CORROBORATION]);
      expect(out.payload.sourceUrl).toBe(SRC);
    }
  });

  it("an unmapped type is refused as such", () => {
    expect(buildWebPublishPayload("PARISH", base({}))).toMatchObject({
      ok: false,
      code: "NO_SCHEMA_MAPPING",
    });
    expect(hasWebSchemaMapping("PARISH")).toBe(false);
    expect(hasWebSchemaMapping("SAINT")).toBe(true);
  });
});

describe("corroboratingCitations — the second witness the stricter schemas need", () => {
  it("keeps confirming pages on another source, once per source", () => {
    expect(
      corroboratingCitations(
        [
          { matchResult: "MATCH", validationSourceUrl: CORROBORATION },
          // Same source as the first: one witness, not two.
          { matchResult: "MATCH", validationSourceUrl: "https://press.vatican.va/x.html" },
          // The artifact's own site cannot corroborate it.
          { matchResult: "MATCH", validationSourceUrl: "https://catholic.org/other" },
          // A homepage that happened to carry the value confirms nothing citable.
          { matchResult: "MATCH", validationSourceUrl: "https://www.usccb.org/" },
          // Not a confirmation.
          { matchResult: "MISSING", validationSourceUrl: "https://www.ewtn.com/x" },
          {
            matchResult: "PASS",
            validationSourceUrl: "https://www.newadvent.org/cathen/06221a.htm",
          },
        ],
        SRC,
      ),
    ).toEqual([CORROBORATION, "https://www.newadvent.org/cathen/06221a.htm"]);
  });
});
